"""API endpoints for Do Not Forget to Buy products."""
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.security import require_admin
from app.db.models import DoNotForgetProduct, Product
from app.db.session import get_db
from app.schemas.do_not_forget import (
    DoNotForgetProductCreate,
    DoNotForgetProductResponse,
    DoNotForgetProductUpdate,
    DoNotForgetProductWithDetails,
    DoNotForgetListResponse,
)

router = APIRouter(prefix="/do-not-forget", tags=["do-not-forget"])


# ── PUBLIC ──────────────────────────────────────────────────────────────────


@router.get("", response_model=DoNotForgetListResponse)
async def get_do_not_forget_products(db: AsyncSession = Depends(get_db)):
    """Get list of 'Do Not Forget to Buy' products for cart page."""
    try:
        stmt = (
            select(DoNotForgetProduct)
            .where(DoNotForgetProduct.is_active == True)  # noqa: E712
            .options(joinedload(DoNotForgetProduct.product))
            .order_by(DoNotForgetProduct.sort_order.asc())
        )
        result = await db.execute(stmt)
        items = result.unique().scalars().all()

        # Build response with full product data
        products_data = []
        for item in items:
            # Skip if product doesn't exist (shouldn't happen but safety check)
            if not item.product:
                continue
                
            product_dict = {
                "id": item.product.id,
                "name": item.product.name,
                "slug": item.product.slug,
                "price": item.product.price,
                "original_price": item.product.original_price,
                "images": item.product.images or [],
                "stock_qty": item.product.stock_qty,
                "is_active": item.product.is_active,
            }
            products_data.append(
                DoNotForgetProductWithDetails(
                    id=item.id,
                    product_id=item.product_id,
                    sort_order=item.sort_order,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    product=product_dict,
                )
            )

        return DoNotForgetListResponse(items=products_data, total=len(products_data))
    except Exception as e:
        logger.error("Error fetching do-not-forget products: {}", e)
        return DoNotForgetListResponse(items=[], total=0)


# ── ADMIN ───────────────────────────────────────────────────────────────────


@router.get("/admin/list", response_model=DoNotForgetListResponse)
async def admin_list_do_not_forget(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: List all do not forget products (active and inactive)."""
    try:
        stmt = (
            select(DoNotForgetProduct)
            .options(joinedload(DoNotForgetProduct.product))
            .order_by(DoNotForgetProduct.sort_order.asc())
        )
        result = await db.execute(stmt)
        items = result.unique().scalars().all()

        # Build response with full product data
        products_data = []
        for item in items:
            # Skip if product doesn't exist (shouldn't happen but safety check)
            if not item.product:
                continue
                
            product_dict = {
                "id": item.product.id,
                "name": item.product.name,
                "slug": item.product.slug,
                "price": item.product.price,
                "original_price": item.product.original_price,
                "images": item.product.images or [],
                "stock_qty": item.product.stock_qty,
                "is_active": item.product.is_active,
            }
            products_data.append(
                DoNotForgetProductWithDetails(
                    id=item.id,
                    product_id=item.product_id,
                    sort_order=item.sort_order,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    product=product_dict,
                )
            )

        return DoNotForgetListResponse(items=products_data, total=len(products_data))
    except Exception as e:
        logger.error("Error fetching admin do-not-forget list: {}", e)
        return DoNotForgetListResponse(items=[], total=0)


@router.post("", response_model=DoNotForgetProductResponse)
async def create_do_not_forget_product(
    data: DoNotForgetProductCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: Add a product to Do Not Forget list."""
    try:
        # Verify product exists
        stmt = select(Product).where(Product.id == data.product_id)
        result = await db.execute(stmt)
        product = result.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Check if already in list
        stmt = select(DoNotForgetProduct).where(
            DoNotForgetProduct.product_id == data.product_id
        )
        result = await db.execute(stmt)
        existing = result.scalars().first()
        if existing:
            raise HTTPException(
                status_code=400, detail="Product already in Do Not Forget list"
            )

        item = DoNotForgetProduct(**data.model_dump())
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return DoNotForgetProductResponse.model_validate(item)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Error creating do-not-forget product: {}", e)
        raise HTTPException(status_code=500, detail="Failed to create product entry")


@router.put("/{item_id}", response_model=DoNotForgetProductResponse)
async def update_do_not_forget_product(
    item_id: int,
    data: DoNotForgetProductUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: Update a do not forget product."""
    try:
        stmt = select(DoNotForgetProduct).where(DoNotForgetProduct.id == item_id)
        result = await db.execute(stmt)
        item = result.scalars().first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)

        await db.commit()
        await db.refresh(item)
        return DoNotForgetProductResponse.model_validate(item)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Error updating do-not-forget product: {}", e)
        raise HTTPException(status_code=500, detail="Failed to update product")


@router.delete("/{item_id}")
async def delete_do_not_forget_product(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: Remove a product from Do Not Forget list."""
    stmt = select(DoNotForgetProduct).where(DoNotForgetProduct.id == item_id)
    result = await db.execute(stmt)
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Product removed from Do Not Forget list"}


@router.post("/reorder")
async def reorder_do_not_forget_products(
    request: dict,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: Reorder do not forget products."""
    try:
        items = request.get("items", [])
        if not isinstance(items, list):
            raise HTTPException(status_code=400, detail="Invalid request format")

        for idx, item_id in enumerate(items):
            stmt = select(DoNotForgetProduct).where(DoNotForgetProduct.id == item_id)
            result = await db.execute(stmt)
            item = result.scalars().first()
            if item:
                item.sort_order = idx

        await db.commit()
        return {"message": "Reordered successfully"}
    except Exception as e:
        await db.rollback()
        logger.error("Error reordering products: {}", e)
        raise HTTPException(status_code=500, detail="Failed to reorder products")
