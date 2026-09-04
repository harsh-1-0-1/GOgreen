# Plan: Per-Combination Variant Stock

> **Context:** current database contains only test/seed data. This plan deliberately
> removes the rollback, feature-flag, and lazy-fallback machinery that only makes sense
> when protecting real transactions/inventory. Deploying is: migrate once → ship new code.
> If it's wrong, fix and redeploy.

## Problem

Stock is currently tracked **per option** (e.g. Medium: 3, Black: 10, White: 0), not per
combination. This means setting an option's stock to 0 hides it **for every combination**,
not just a specific one. We cannot express:

> "Medium is available only in Black, but Small is available in both Black and White."

We also have a correctness risk: combinations that share an option (e.g. Small+Black and
Medium+Black both draw from Black's stock of 10) each show as available and can be
purchased independently, overselling past the real shared limit — because stock is not
actually reserved per combination today.

## Goal

Move stock tracking from **per-option** to **per-combination**, reusing the existing
**Variant Combinations & Images** key space — no new table, no schema column. Every
combination gets an independent stock count, so:

- An option is visible only if some purchasable combination includes it.
- Reservation decrements only the exact matched combination's stock.
- `stock_qty` = total sellable units = sum of all combination rows' stock.

---

## Review decisions (made against the current codebase)

| Question | Decision | Why |
|---|---|---|
| Storage shape | **New sibling field `variants.stock_map: Record<comboKey, int>`**; `image_map` stays `Record<string, string[]>` untouched | `image_map` values are string arrays, not row objects. Reshaping them to `{images, stock}` would break the serializer, `_clean_and_validate_variants`, `_assert_relative_keys`, admin seeding/payload, and `ProductDetailPage` image lookup. A sibling map is one new JSON key with zero blast radius on the photo flow. |
| `combo_key` generation | Add a **server-side canonical builder**; mirror it in the frontend | `buildComboRows` (`ProductsAdminPage.tsx:654`) is the only place keys are made today (option IDs joined by `__` in `variant_groups` array order). `combination_key()` in `cart_service.py:82` is old-format only. Reservation must build the identical key or it will miss rows. |
| Matrix dense vs sparse | Stock map is **dense** (all cartesian combos); image map stays sparse | `buildComboRows` already renders the full cartesian product (cap 50). Public API `image_map` only contains combos with photos, so sparse stock would hide unpurchasable-by-lookup options. |
| Migration + fallback | **One-off migration, run before deploy; no lazy fallback in new code** | Only test data exists. New code requires `stock_map` to be present for every `variant_groups` product and **fails loudly** (never silently falls back) if it's missing — removing a whole class of "silent fallback on key mismatch" bugs at the cost of a strict ordering requirement: migrate before ship. |
| Concurrency | Keep the existing product-row lock (`with_for_update` at `order_service.py:64-66`); decrement the combo row under it | Already serializes concurrent checkouts. Per-combo stock removes the *shared-pool* logical oversell; the lock covers same-combo races. This is a code-correctness property and applies regardless of data — kept even with test data. |
| Validation timing | Keep `validate_stock=True` before confirm (`order_service.py:71-73`, `cart_service.py:353,393`); point it at the matched combo row | Confirmed validation already precedes confirmation. |

---

## 1. Data model change

No schema change. Add one key inside the existing `variants` JSON:

```json
{
  "variant_groups": [
    { "id": "vg_size", "label": "Select Size", "options": [
        { "id": "opt_small",  "name": "Small",  "price": 0, "stock": 5,  "images": [] },
        { "id": "opt_medium", "name": "Medium", "price": 100, "stock": 3, "images": [] }
    ]},
    { "id": "vg_colour", "label": "Select Colour", "options": [
        { "id": "opt_black", "name": "Black", "price": 0, "stock": 10, "images": [] },
        { "id": "opt_white", "name": "White", "price": 0, "stock": 0,  "images": [] }
    ]}
  ],
  "image_map": {
    "opt_medium__opt_black": ["img.jpg"]
  },
  "stock_map": {
    "opt_small__opt_black":  5,
    "opt_small__opt_white":  0,
    "opt_medium__opt_black": 3,
    "opt_medium__opt_white": 0
  },
  "default_image": "default.jpg"
}
```

- `combo_key` format is **unchanged**: option IDs joined by `__` in `variant_groups`
  array order (same as `buildComboRows` today).
- `stock_map` is **dense** — a row exists for every cartesian combination (including
  `0` values).
- `variant_groups[].options[].stock` is retained in the schema but is **no longer read** by
  the new code paths (source of truth for the migration only).
- `image_map` remains sparse and untouched.

---

## 2. Backend — canonical combo key builder

New helper (in `variant_pricing.py` or a shared `variant_keys.py`), used by both the
pricing/validation path and reservation:

```python
def build_combo_key(variant_groups: list[dict], selected_option_ids: list[str]) -> str | None:
    """Return option IDs joined by '__' in variant_groups array order."""
    if not variant_groups:
        return None
    parts = []
    for group in variant_groups:
        sel = [o for o in group.get("options", []) if o.get("id") in selected_option_ids]
        if len(sel) != 1:
            return None  # group must contribute exactly one selected option
        parts.append(sel[0]["id"])
    return "__".join(parts)
```

- Must match `buildComboRows` ordering exactly: iterate groups in array order.
- Frontend mirror lives next to the current `buildComboRows` (`ProductsAdminPage.tsx:642`)
  and in `ProductDetailPage.tsx` (which already builds a `comboKey` for images at
  `:599-605` — reuse that same construction).

### Ordering-assumption guard (verified, safe today)

`build_combo_key` relies on `variant_groups` array order staying stable after keys are
written. Verified against the codebase: **no group/option reordering exists today** —
dnd-kit sortable is only used in `BannersAdminPage.tsx`, and the variant admin only
appends (Add Variant Type / Add Option push to the end; there are no move/up-down
controls in `ProductsAdminPage.tsx`). Group order is effectively immutable once set, so
existing `image_map` keys and future `stock_map` keys are stable.

If reordering is ever added to the variant admin, `stock_map`/`image_map` keys would
silently go stale (same option set, different join order) — make rebuilding combo keys a
required step of any such feature. Note the keys contain option IDs, so a reorder only
changes string order, never the option set, which makes a future migration
straightforward.

---

## 3. Stock resolution — `variant_pricing.calculate_variant_price`

Replace the per-option `min_stock` availability with a combo-row lookup:

1. Build `combo_key` from the selected options (via the canonical builder).
2. `available_stock = stock_map[combo_key]`.
3. **No fallback.** If `stock_map` is missing or the key is absent, raise a dedicated
   `ValueError` — a missing key is a bug (stale data / key mismatch), not a condition to
   quietly work around. **Defined failure mode at the boundary:** the API layer catches
   this specific error and returns a `500` with a distinct error code (e.g.
   `STOCK_MAP_MISSING`) rather than a generic trace, so it's greppable in logs and testable
   in one assert, not a silent wrong-answer path.
4. Keep `validate_stock=True` semantics: reject if `available_stock <= 0` or
   `quantity > available_stock`.
5. Price, snapshot, and image resolution logic are unchanged.

This automatically updates every consumer: cart add/update, `build_cart_response`
(`available_stock` / `stock_warning`), and order reservation validation.

---

## 4. Order reservation — `order_service._reserve_product_for_order`

**Current (new-format branch, `:84-97`):** decrements each selected option's stock.

**New:**
1. Build `combo_key` from `details["selected_options"]`.
2. `stock_map[combo_key] -= quantity`, floor at 0. **No per-option decrement, no fallback**
   — a missing key raises (stale data is caught loudly at checkout, never reserved against
   the wrong pool).
3. Recompute `product.stock_qty = sum(stock_map.values())` (see §6).
4. Keep the `with_for_update()` lock and `flag_modified(product, "variants")`.

This closes the shared-pool oversell: each combination now has its own independent pool.

### Multi-item lock ordering & deadlock hardening

**Verified in code — deterministic lock ordering already exists.** Both checkout loops sort
line items by `product_id` *before* acquiring any `with_for_update()` locks:

- `checkout` — `order_service.py:188`: `for ci in sorted(cart.items, key=lambda ci: ci.product_id)`
- `direct_checkout` — `order_service.py:251`: same pattern

Both carry a comment stating the purpose is consistent lock-acquisition order to prevent
deadlocks on the FOR UPDATE rows. So the classic multi-item deadlock (Cart A locks X→Y,
Cart B locks Y→X) cannot occur today: every transaction acquires product locks in the same
global order, making circular waits impossible. **This must be preserved** — when touching
`_reserve_product_for_order`, do not reorder or dedupe items inside the loop in a way that
breaks the sort (e.g. collapsing duplicate `product_id` entries still locks each product
once, which is fine; locking *different* products out of sorted order is not).

**Belt-and-suspenders hardening (optional, additive):** even with deterministic ordering,
Postgres can deadlock against unrelated locks in the same transaction. Add defensively:
- Catch `SQLAlchemyError` with `orig.pgcode == "40P01"` (deadlock_detected) around the
  reservation/checkout transaction; retry the whole checkout once or twice with small
  backoff before surfacing an error to the user.
- Set `lock_timeout` (e.g. 3–5s) on the transaction so a stuck lock fails fast and retries
  instead of hanging checkout indefinitely.
- Note this is Postgres-specific; SQLite (used in dev/tests) is single-writer and serializes
  naturally, but the retry wrapper is harmless there.

**Test to add:** two concurrent checkouts with the *same two products in reverse line
order* (A = `[X, Y]`, B = `[Y, X]`) — assert both complete in sequence (or one retries and
succeeds), with no hang and no oversell. This exercises the sort invariant directly.

---

## 5. Visibility & auto-select — `ProductDetailPage.tsx`

### Visibility (§2 of the draft)

Currently: an option is visible if its own `stock > 0` (filter at `:768`).

New: an option is visible if **at least one combo row containing it, consistent with the
currently-selected options in the other groups, has stock > 0**. Recompute on every
render (derived value, no new state; ≤ 50 rows is cheap):

```
for each group g, for each option o in g.options:
    candidates = stock_map rows matching {other groups' current selections} + o in g
    visible(o) = any(row.stock > 0 for row in candidates)
```

- Assumes `stock_map` is present (migration ran before deploy). **Defined failure mode:**
  if `stock_map` is missing for a `variant_groups` product, the picker catches it at the
  component boundary and renders an explicit "this product isn't configured correctly"
  state (small inline notice + disabled Add to Cart), matching the `STOCK_MAP_MISSING`
  error surfaced by the API in §3 — the rest of the page keeps working, no white-screen
  crash.
- Also hide a whole group when none of its options are visible.

### Auto-select (§3 of the draft)

Currently: first in-stock option chosen independently per group (`:510-528`).

New: pick the **first combo row with `stock > 0`** (optionally preferring a row with an
`image_map` photo — confirmed as optional today; image resolution already falls back
combo → colour → default → gallery), then derive each group's selection from that row's
`combo_key`.

### Display (`effectiveStock`, labels, qty cap)

Replace per-option `min` at `:580-586` with the matched combo row's stock so the "Only X
left" label and the quantity stepper reflect the true per-combination availability.

---

## 6. Product-level `stock_qty`

**New formula:** `stock_qty = sum(stock_map.values())` — total sellable units across all
independent combination pools.

Update in **both** places it is computed:
- Admin save: `ProductsAdminPage.tsx:468-474` (currently min-of-sums over options).
- Reservation: `order_service.py:118-122` (same formula today).

Listing cards (`ProductCard.tsx`) and search read `stock_qty` unchanged.

---

## 7. Admin UI

- The existing **Variant Combinations & Images** table already renders the full cartesian
  product (`buildComboRows`, cap 50) — add a **Stock** column next to Images.
- State: `comboStock: Record<string, number>`, seeded from `stock_map`, edited per row.
- Save path: include `stock_map` in the `variants` payload (`ProductsAdminPage.tsx:430-448`)
  alongside the existing `image_map`; **always send all cartesian combos** (dense), not
  just combos with photos.
- Recompute the product `stock_qty` field from `sum(comboStock.values())` on save.

---

## 8. Migration (run once, before deploy)

One-time script across existing products with `variant_groups`:

1. Walk the cartesian product of options (same iteration as `buildComboRows`, ignoring the
   cap — use all combos).
2. For each combo row: `stock = min(stock of each option referenced in combo_key)`
   (reproduces today's behavior exactly as the starting point).
3. Write `variants.stock_map = {comboKey: stock}` for **every** row, including `0` values;
   `flag_modified`.
4. Recompute `product.stock_qty = sum(stock_map.values())`.

**Idempotent by construction:** the script **always fully overwrites `stock_map`** from the
current `options[].stock` on every run — it never skips products that already have a map
and never accumulates state across runs. Since `options[].stock` is the single migration
source and unchanged by this script, re-running after a DB reset/reseed is safe and
deterministic.

### Deployment ordering (mandatory)

New code **requires** `stock_map` on every `variant_groups` product. Therefore the
migration must run **before** the new code ships, or existing products will fail loudly at
every stock lookup (§3/§4/§5). With test data this is trivial to satisfy — migrate, then
deploy. Add a CI/startup check (scan products with `variant_groups` but no `stock_map`) so
the requirement can't silently regress.

### Migration-state convention

The migration always writes the **full dense map including `0` values**. A present-but-
all-zero map is a valid state (product entirely out of stock) and is never treated as
"needs migration."

---

## 9. Edge cases

- **Product with only one group:** stock_map rows are single-option keys
  (`opt_small`) — a per-option model collapsed into the same code path. Works unchanged.
- **Optional groups / partial selections:** visibility only filters rows consistent with
  what is already selected; combos requiring an unselected optional group aren't forced.
- **Old-format products** (colors/pot_types/sizes): untouched; they keep using
  `_resolve_old_variant_details` and `variants.stock` — this is a separate format path,
  not the removed fallback.
- **Duplicate selected option across groups:** rejected before key building (already
  handled in `calculate_variant_price`).

---

## Known accepted risks (tracked, not footnotes)

- **`COMBO_CAP = 50` overflow (deferred):** products with >50 combinations can't set stock
  for overflow rows in the admin table today (pre-existing for images). Because
  reservation and visibility only consult rows that exist, a >50-combo product would have
  **inconsistent behavior per combo** — combos within the cap get isolated stock, overflow
  combos are unreserved and unpurchasable (no row, so lookup errors loudly). This is a
  real gap in the exact bug this change exists to fix. Acceptable to defer only if the
  store has no >50-combo products; otherwise raise the cap or paginate the matrix as
  follow-up work.

---

## Concurrency scope (verification + testing)

- The existing `with_for_update()` lock in `_reserve_product_for_order`
  (`order_service.py:64-66`) is acquired per product row and held until the endpoint
  commits the session transaction — it is **not released between items** in the checkout
  loop (`order_service.py:188-194`, `:251-256`). Two concurrent checkouts touching the
  same product serialize on that product's row lock, so the combo decrement under the lock
  is race-free for both same-combo and cross-combo orders on the same product.
- **Lock ordering is already deterministic** (both loops sort by `product_id`, see §4), so
  the multi-item deadlock scenario is already prevented. §4 covers the optional retry /
  `lock_timeout` hardening on top.
- Concurrency tests to add:
  1. Two checkouts racing on the **same combo** of one product — assert no oversell and
     consistent `stock_qty`.
  2. Two checkouts racing on **two different combos** of the same product — assert each
     combo's pool is respected independently.
  3. Two multi-item checkouts with the **same two products in reverse order** — assert no
     deadlock/hang and correct totals (exercises the sort invariant).

---

## Rollout note

Current data is test data, so no feature flag, staged rollout, reconciliation script, or
incident rollback is needed — migrate once, ship the new code, fix-and-redeploy if wrong.
**If real inventory is loaded before this ships**, reintroduce the flag + reconciliation
plan (previously §10 of this document's draft) to protect live transactions.

---

## Summary of touch points

| Area | File | Change |
|---|---|---|
| Storage | `variants.stock_map` (JSON) | new dense map, no schema change |
| Canonical key builder | `variant_pricing.py` (new fn) + `ProductDetailPage.tsx` | server + client share one key format |
| Price / availability | `variant_pricing.calculate_variant_price` | `min_stock` → `stock_map[key]`, loud error if missing |
| Cart | `cart_service.py` (via pricing) | auto-updated |
| Cart display | `cart_service.build_cart_response` | verify `available_stock` / `stock_warning` reflect per-combo numbers end to end (comes via pricing, but explicitly check the cart payload, not just the price calc) |
| Reservation | `order_service._reserve_product_for_order` | decrement combo row, `stock_qty = sum` |
| Visibility | `ProductDetailPage.tsx` (`:768`, `:580-586`) | per-option → per-combo-row, recompute on render |
| Auto-select | `ProductDetailPage.tsx` (`:510-528`) | first in-stock combo row |
| Product `stock_qty` | `ProductsAdminPage.tsx:468-474`, `order_service.py:118-122` | `sum(stock_map.values())` |
| Admin UI | `ProductsAdminPage.tsx` combos table | Stock column + `stock_map` in payload |
| Migration | one-off script (repo root or `backend/`) | dense backfill from option stocks; must run before deploy |
| Startup/CI check | new check (repo root or `backend/`) | fail if any `variant_groups` product lacks `stock_map` |

## Explicitly not changing

- `variant_groups[].options[].stock` — retained in the schema as the migration source; no
  longer read by new code paths.
- Combination matrix `combo_key` format and the photo upload flow (`image_map`).
- Pricing model (per-option prices, summed) and order snapshot denormalization.
- Old-format variant products and their `_resolve_old_variant_details` path.
