# Variant Stock & Visibility — How It Works

> **Question:** "What if in the Medium size I only have a Black pot available — will it be visible?"
>
> **Short answer:** Yes. **Medium** is visible if the *Medium size option itself* has `stock > 0`, and **Black** is visible if the *Black colour option itself* has `stock > 0`. Any option with `stock = 0` (like White) is now **hidden completely** — it no longer shows blurred/dimmed. So if White has 0 stock, the only colour that can be chosen for Medium is Black, and that combo is purchasable.

---

## 1. The data model — stock is **per option**, not per combination

Each variant **group** (e.g. "Select Size", "Select Colour") has **options**, and **every option carries its own stock number**:

```json
{
  "variant_groups": [
    {
      "id": "vg_size",
      "label": "Select Size",
      "options": [
        { "id": "opt_small",  "name": "Small",  "price": 0, "stock": 5,  "images": [] },
        { "id": "opt_medium", "name": "Medium", "price": 100, "stock": 3, "images": [] },
        { "id": "opt_large",  "name": "Large",  "price": 200, "stock": 0, "images": [] }
      ]
    },
    {
      "id": "vg_colour",
      "label": "Select Colour",
      "options": [
        { "id": "opt_black", "name": "Black", "price": 0, "stock": 10, "images": [] },
        { "id": "opt_white", "name": "White", "price": 0, "stock": 0,  "images": [] }
      ]
    }
  ]
}
```

**There is no per-combination stock.** The admin does not enter stock for "Medium + Black" as a pair — only for "Medium" and for "Black" separately. The admin's "Variant Combinations & Images" table only manages **photos**, not stock.

---

## 2. Visibility rules (current behaviour)

Applied on the product detail page (`ProductDetailPage.tsx`):

1. **An option is hidden entirely if its own `stock <= 0`.** It is not rendered, not disabled, not blurred.
2. **A group is hidden entirely if *all* of its options are out of stock.**
3. An option is shown only if `stock > 0`.

In the example above the customer sees:

| Group | Visible options | Hidden |
|-------|-----------------|--------|
| Select Size | Small, Medium | Large (stock 0) |
| Select Colour | Black | White (stock 0) |

Since White is hidden, choosing Medium *forces* Black — effectively "Medium comes in Black only."

---

## 3. How the effective stock of a combination is calculated

`available stock of a combo = min(stock of every selected option)`

| Selection | Math | Buyable? |
|-----------|------|----------|
| Medium + Black | `min(3, 10) = 3` | Yes (up to 3) |
| Small + Black | `min(5, 10) = 5` | Yes (up to 5) |

Because every *visible* option has `stock > 0`, `min(...)` is always `> 0` — **every combination you can actually select is purchasable.** This is the key benefit of hiding instead of blurring: a customer can no longer land on an out-of-stock combo.

- When nothing is selected yet, the page auto-selects the **first in-stock option of each group**, so a valid combo is always pre-selected.
- The **product-level** `stock_qty` shown on listing cards is `min over groups of (sum of that group's option stocks)` — the maximum number of complete units the product can sell before some group runs dry.

---

## 4. Your exact scenario, step by step

You want: **Medium size has only a Black pot in stock.**

Set it up like this in admin:

1. **Select Size** group: give **Medium** any `stock > 0` (e.g. 3). Set Small/Large stock normally.
2. **Select Colour** group: give **Black** `stock > 0` (e.g. 10), and set **White `stock = 0`**.

Result:
- **Medium** → visible ✅ (its own stock is 3)
- **Black** → visible ✅ (its own stock is 10)
- **White** → hidden entirely ❌
- Customer picks **Medium + Black**, available qty = `min(3, 10) = 3`. ✅

### ⚠️ Important limitation of per-option stock

Because stock is tracked **per option**, setting White to `0` hides White **for every size**, not just Medium. The current model **cannot** express:

> "Medium is available only in Black, but Small is available in both Black and White."

That kind of per-combination control would require a new per-combination stock model (e.g. a `stock_map` keyed by `optId1__optId2`). Today the stock numbers are *independent shared margins*: Black's 10 units can be consumed by Small OR Medium.

---

## 5. What happens on purchase

When an order is placed, the backend (`order_service._reserve_product_for_order`):

- Decrements **only the selected options' stocks** by the quantity bought.
- Recomputes `stock_qty = min over groups of (sum of option stocks)`.
- Validates stock against the selected configuration before confirming.

---

## 6. Checklist for "hide this variant"

| Want the variant hidden? | Set |
|--------------------------|-----|
| A specific option (e.g. White pot) | That option's `stock = 0` |
| A whole group | `stock = 0` on **every** option in the group |
| A product entirely | Product-level `stock_qty = 0` (shows "Out of Stock" on cards) |

There is no per-option "enabled/disabled" toggle today — **`stock = 0` is the single source of truth for hiding.**
