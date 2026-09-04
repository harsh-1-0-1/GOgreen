# Bug: "Pot change ho rhe ha" — Pot Options Shuffle When Selecting Colour

> **Reported by client (Small-size pots):**
> ```
> Small-gro-pot-white  = 0
> Small-kyoto-red      = 0
> Small-plantoga-black = 0
> ```
> *"Small me har ek pot ka ek ek color nahi hai to sirf color dikhne nahi chahiye"*
> *"Pot change ho rhe ha"*

---

## 1. What the data means

The product has **3 variant groups** (new flexible variant system):

| Group | Options |
|---|---|
| Select Size (`always_show_options = true`) | Small, Medium, Large |
| Select Pot | Gro Pot, Kyoto, Plantoga |
| Select Colour | White, Red, Black |

The `stock_map` marks these combinations as **0 stock** (option IDs joined by `__`):

| Combo key | Meaning |
|---|---|
| `small__gro__white` | Gro Pot does **not** come in White for Small |
| `small__kyoto__red` | Kyoto does **not** come in Red for Small |
| `small__plantoga__black` | Plantoga does **not** come in Black for Small |

So for **Small**, every pot has *some* colours in stock — but a *different* colour is missing per pot:

| Pot | Available colours (Small) | Missing |
|---|---|---|
| Gro Pot | Red, Black | White |
| Kyoto | White, Black | Red |
| Plantoga | White, Red | Black |

Expected behaviour: for the chosen size, **all pots stay visible**, and only the **colours available for the selected pot** are shown.

---

## 2. Recreated error

Reproduced by simulating the exact `ProductDetailPage.tsx` logic (`buildComboRows`, `isOptionVisible`, `selectOption`) against the data above:

| Step | Selection | Pots shown | Colours shown | Notes |
|---|---|---|---|---|
| Page load (auto-select first in-stock combo → Small, Gro, Red) | Small, Gro, Red | **Gro, Plantoga** | Red, Black | **Kyoto hidden** even though `small__kyoto__white` is in stock |
| Click colour **Black** | Small, Gro, Black | **Gro, Kyoto** | Red, Black | Plantoga disappears, Kyoto appears → *"pots keep changing"* |
| Click colour **White** | Small, Gro, White | **Kyoto, Plantoga** | Red, Black | Gro disappears; `small__gro__white = 0` → **Out of Stock / dead state** |

Because the selected colour on load is Red, Kyoto (which only has White/Black for Small) is hidden entirely. Every colour click reshuffles which pots appear.

---

## 3. Why it's happening — root cause

`isOptionVisible` in `frontend/src/pages/ProductDetailPage.tsx:638-651`:

```ts
function isOptionVisible(group: VariantGroup, opt: VariantOption): boolean {
  if (group.always_show_options) return true;
  if (!stockMap) return true;
  return comboRows.some((row) => {
    if (row.groupOption[group.id] !== opt.id) return false;
    if (row.stock <= 0) return false;
    for (const g of variantGroups) {        // ← checks ALL other groups
      if (g.id === group.id) continue;
      const sel = selectedOptions[g.id];
      if (sel && row.groupOption[g.id] !== sel) return false;
    }
    return true;
  });
}
```

The inner loop `for (const g of variantGroups)` filters the option against the current selection of **every other group**. There is **no hierarchy**:

- **Pot visibility depends on the selected colour** → pots appear/disappear as colours are clicked.
- **Colour visibility depends on the selected pot** → colours reshuffle as pots are clicked.

This bidirectional cross-filtering is what makes the pot list unstable and lets pots/colours become unreachable. The client expects a one-directional cascade: **size → pot → colour**.

---

## 4. Resolution

Filter each group only against its **upstream** groups — the always-show groups (size) plus earlier groups in `variant_groups` array order:

- **Size** (always-show) → always visible.
- **Pot** → visible if *any* (selected size + this pot) combo is in stock — **not** filtered by colour.
- **Colour** → visible only if (selected size + selected pot + this colour) is in stock.

Verified against the same data — all 3 pots stay visible for Small, colours filter per pot (Gro→Red/Black, Kyoto→White/Black, Plantoga→White/Red).

### 4.1 `isOptionVisible` — upstream-only filtering

Add a helper and constrain the loop in `frontend/src/pages/ProductDetailPage.tsx`:

```ts
// 1) helper next to isOptionVisible (~line 638)
function isUpstream(g: VariantGroup, group: VariantGroup): boolean {
  if (g.id === group.id) return false;
  if (g.always_show_options) return true;
  return variantGroups.indexOf(g) < variantGroups.indexOf(group);
}

// 2) in isOptionVisible, replace the inner loop (~line 644):
for (const g of variantGroups) {
  if (!isUpstream(g, group)) continue;   // only upstream groups constrain visibility
  const sel = selectedOptions[g.id];
  if (sel && row.groupOption[g.id] !== sel) return false;
}
```

### 4.2 Generalise the stale-selection guard in `selectOption`

The guard today only runs for `always_show_options` groups (`ProductDetailPage.tsx:729-759`). With the 4.1 fix, clicking a pot can still land on a hidden colour (e.g. Small + Gro while White selected → White has no stock for Gro). Extend the same "re-derive to the best in-stock combo, preserving as many current picks as possible" logic to fire for **any** clicked group, not just size. Verified: clicking Gro while White is selected correctly re-derives colour to Red.

### 4.3 What stays unchanged

- `stock_map` / per-combination stock model — untouched.
- Auto-select, image swapping, pricing, Add to Cart gating — untouched.
- Group hiding (`visibleOptions.length === 0 → return null`, line 901) — still valid.

---

## 5. Files to change

| File | Change |
|---|---|
| `frontend/src/pages/ProductDetailPage.tsx` | Add `isUpstream` helper; restrict `isOptionVisible` filtering to upstream groups; generalise `selectOption` stale-selection guard to all groups |

No backend change, no data change, no migration.