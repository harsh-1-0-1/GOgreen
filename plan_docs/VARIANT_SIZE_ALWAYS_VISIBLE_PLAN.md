# Plan: Sizes Always Visible — Colours Filter to Available

> **Problem:** today the storefront hides any option whose combination stock is 0
> (`ProductDetailPage.tsx:629-641`). So if "Medium" has no in-stock pot combo it
> disappears entirely. The client wants **every defined size (Small / Medium / Large
> or other size variation) to always be visible**, then let the customer pick between
> the **available** colours, with the pot options shown below.
>
> **No code changes yet** — this is the agreed plan. The client guarantees a size is
> never defined unless pots are available for it, so always-visible sizes stay
> purchasable.

---

## Approach in one line

Add a **new, independent** `always_show_options` flag on each variant group (default
`false`). Groups with the flag always render every defined option; colour groups keep
hiding out-of-stock options. The existing `required` field keeps its current meaning
and is **completely untouched**.

> **Naming:** `always_show_options` encodes the actual behaviour (vs `is_compulsory`,
> which reads as a synonym for `required` to a future reader). Backend
> `backend/app/schemas/product.py:31`, admin `ProductsAdminPage.tsx`, storefront
> `ProductDetailPage.tsx`, type `types/index.ts`.

---

## Verified behaviour (answered against the current code)

These two properties were the risk points of the plan; both already hold:

1. **Colour filtering is selection-aware and reactive.** `isOptionVisible`
   (`ProductDetailPage.tsx:629-641`) is a plain function called during render
   (`:840`), so it recomputes on every `selectedOptions` change. A colour option is
   visible iff some `stock_map` combo row `stock > 0` **and** the row matches the
   currently-selected option in every other group (`:634-638`). So when the customer
   picks a size, the colour list re-filters to what's in stock *for that size*. The
   plan's core goal is already supported by the existing mechanism — no rewrite of the
   filter needed, just a bypass for flagged groups.

2. **Auto-select cannot land on a dead size.** `:549-553` picks
   `firstInStock = rows.find(stock > 0)` across **all** cartesian combos (not only
   rendered/visible ones). Compulsory sizes change which options render, not which
   combos are considered, so page load still defaults to an in-stock size+colour. The
   only way to land on zero-stock state is a fully sold-out product (`rows[0]`
   fallback), which correctly displays "Out of Stock".

---

## 1. Backend — `backend/app/schemas/product.py`

Add alongside the existing `required` field on the variant group schema (`:31`):

```python
required: bool = True
always_show_options: bool = False   # new — forces all options to render regardless of stock
```

`required` keeps its existing meaning (selection enforcement) and is not touched.

### Read-path note (why "no migration" is safe)

`ProductResponse.serialize_variants` (`product.py:193-196`) only resolves image URLs —
it does **not** re-validate through `ProductVariantsNew`, so the flag round-trips
untouched on read. On write, `VariantGroup.model_config = {"extra": "allow"}`
(`:34`) preserves it through `model_dump()` even before the field exists in the
schema. Adding the schema field is for explicit typing/defaulting, not round-trip
safety. Old records without it → absent → treated as `false` by the frontend.

---

## 2. Admin — `ProductsAdminPage.tsx`

1. Add `always_show_options: boolean` to `VariantGroupDraft` (`:43`), default `false`.
2. Add a **"Always show options"** checkbox/toggle in each group's header row, next to
   the label input and trash button (`:1268`). Tooltip: "Always render every option on
   the product page regardless of stock (e.g. Select Size)."
3. Seed the value when editing a product: read `group.always_show_options`
   (`:280-294`), defaulting to `false` when absent — covers existing test products.
4. Include `always_show_options` in the save payload per group (`:500-513`):
   ```ts
   variants = {
     variant_groups: cleanGroups.map(group => ({
       id: group.id,
       label: group.label.trim(),
       required: group.required,                 // unchanged, existing meaning
       always_show_options: group.always_show_options, // new — drives render behaviour
       options: ...
     })),
     ...
   };
   ```

### Silent opt-in nudge (optional, cheap)

Because the default is `false`, a merchant creating a new size group could forget the
toggle and silently get the old hide-when-out-of-stock behaviour. Add a small hint when
the group label contains "size" (e.g. "Tip: tick 'Always show options' so Small /
Medium / Large always appear"). Admin-only UI text, no behaviour change.

---

## 3. Storefront — `ProductDetailPage.tsx`

1. **`isOptionVisible` (`:629-641`):** if `group.always_show_options === true`, return
   `true` for every option in that group — always render regardless of stock.
   Otherwise keep today's selection-aware per-combo stock visibility (colour groups).
2. **Group hiding (`:847`):** an always-show group never returns `null`, so a defined
   size group always renders all of Small/Medium/Large.
3. **Colour groups keep hiding** unavailable colours (unchanged behaviour) — the
   customer selects only from the pots actually available for the selected size.
4. **NEW — stale-selection guard in `selectOption` (`:710-719`):** picking a size whose
   currently-selected colour is out of stock would otherwise leave `selectedOptions`
   pointing at a now-hidden colour → `effectiveStock = 0` → dead "Out of Stock" state.
   When the clicked option `o` belongs to an always-show group `G`, re-derive the other
   groups via **maximal-preservation tie-breaking**:

   ```
   candidates = comboRows where row.groupOption[G] == o.id  and  row.stock > 0

   if candidates is empty:
       # nothing is in stock for this pick at all → honest sold-out state
       keep selection as-is; existing effectiveStock <= 0 path shows "Out of Stock"
   else:
       # score = how many OTHER groups the row preserves (matches current selection)
   for row in candidates:
       score(row) = |{ g in otherGroups : row.groupOption[g] == selectedOptions[g] }|
   best = row with max score; tie-break by first in cartesian combo order
   set selectedOptions = { G: o.id, ...best.groupOption minus G }
   ```

   **Tie-break ordering (decided):** "first in cartesian combo order" means the order
   produced by `buildComboRows` (`ProductDetailPage.tsx:49-62`) — groups iterated in
   `variant_groups` array order, options in each group's array order, i.e. the order
   the admin defined them. This is the **same order** auto-select's `firstInStock`
   uses (`:550-551`) and the admin combos table renders, so the picked row is
   predictable and matches what's visually first on the page. It is **not**
   `stock_map` key iteration order. **Implementation rule:** iterate `comboRows` in
   defined order and track the best with a strict `score > bestScore` comparison
   (never `>=`) — this selects the first max-scoring row with no explicit sort.

   This keeps **as many of the customer's other picks as still have stock** and only
   falls back the minimum necessary. Example (3 groups: Size + Colour + Pot Material,
   current = Small + Blue + Ceramic; clicking a size where Blue is still in stock):
   Ceramic is preserved if any in-stock row has Small' + Blue + Ceramic — only falling
   back to the first available material if Blue+Ceramic for that size is 0. Scope:
   guard runs only on clicks within always-show groups; normal groups keep today's
   behaviour (the plan doesn't change their flow).
5. **Auto-select (`:534-560`), image swapping, price summing, `effectiveStock`,
   Add to Cart gating:** unchanged — verified above they already operate off
   `stock_map` and don't depend on which options render.

---

## 4. Data/setup (test data)

**No migration needed** (read-path confirmed in §1). Existing products lack the field →
`false` → current behaviour unchanged. To demo: tick "Always show options" on the size
group for the desired test products.

---

## 5. Decisions on review points

| Point | Decision |
|---|---|
| Colour filtering reactive to selected size | Confirmed already selection-aware (`isOptionVisible` recomputes on render vs current selections) — no rewrite needed |
| Auto-select vs always-visible sizes | Confirmed safe — picks first in-stock combo over all rows; only fully-sold-out falls back |
| Stale colour on size switch | Handled — new `selectOption` guard (§3.4) re-derives a valid combo via maximal-preservation tie-break (keeps as many still-valid picks as possible) |
| Multiple always-show groups | **Allowed.** Multi-axis "always show structure" is a legitimate pattern; the `selectOption` guard handles any number of axes uniformly. No admin restriction. Documented, not a side effect |
| Read-path schema | Confirmed — `serialize_variants` passes the dict through; `extra: "allow"` round-trips on write. No migration needed |
| Silent opt-in | Default `false` + optional label-contains-"size" hint in admin (§2) |
| Group ordering | Groups flagged `always_show_options` render **first**, on top of colour/pot groups, regardless of `variant_groups` array order (stable sort in `ProductDetailPage.tsx`; combo keys/pricing still use canonical array order) |

---

## 6. Touch points

| File | Change |
|---|---|
| `backend/app/schemas/product.py` | add `always_show_options: bool = False` to `VariantGroup` |
| `ProductsAdminPage.tsx` | `VariantGroupDraft.always_show_options`, toggle UI, seed, save payload (+ optional size-label hint) |
| `ProductDetailPage.tsx` | `isOptionVisible` respects `always_show_options`; group-hide skipped when true; `selectOption` stale-selection guard |
| `types/index.ts` | add `always_show_options?: boolean` to `VariantGroup` |
| Backend (rest) | none — `required` and pricing/validation untouched |

---

## 7. Verification requirement (hard)

Auto-select and `isOptionVisible` interact at page-load and on every size switch —
exactly the kind of thing that only surfaces by clicking through. **Runtime
verification is required before merge, not just type-checking:**

- Load a product with size flagged always-show: all sizes visible, auto-selected combo
  is in stock.
- Switch sizes and confirm colours re-filter per size; confirm no stale dead state.
- Temporarily zero every combo for one size: size still visible, selecting it shows
  "Out of Stock" + disabled Add to Cart, and switching back to a stocked size recovers.
- **Rapid switch-back** (guard/timing seam): repeatedly switch between two sizes, and
  switch to a size with only one in-stock colour, several times in quick succession —
  confirm the guard never leaves a stale/hidden selection and doesn't fight any
  effect-timing/debounce in the component (recall the guarded render-time effects;
  the failure mode here would only surface on repeated interaction, not a single click).
- Multi-axis case: two always-show groups — confirm the guard still lands on a valid
  combo and preserves a still-valid third-axis pick.
- Admin round-trip: save with the toggle on/off, reload product, confirm the flag
  persists and drives rendering.

---

## 8. Out of scope / explicitly not changing

- Per-option `stock` and per-combination `stock_map` model — untouched.
- Auto-select selection, image resolution, pricing, order reservation.
- `required` semantics in `variant_pricing.py` — unchanged; `always_show_options` only
  drives the render rule above.
- Old-format variant products (`colors`/`pot_types`/`sizes`) — unchanged; those
  merchants keep the old hide-when-out-of-stock behaviour (one-line heads-up to whoever
  fields support tickets).
