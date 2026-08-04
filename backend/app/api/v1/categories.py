from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryTree,
    CategoryUpdate,
)
from app.services import category_service
from app.utils.image_upload import delete_image_file, extract_relative_key, upload_image_file
from app.utils.redis import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/categories", tags=["categories"])

CATS_ALL_KEY = "cats:all"
CATS_TTL = 600


@router.get("", response_model=list[CategoryTree])
async def list_categories(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    cached = await cache_get(CATS_ALL_KEY)
    if cached:
        return cached

    cats = await category_service.get_all_categories(db)
    tree = category_service.build_tree(cats)
    payload = [t.model_dump() for t in tree]
    await cache_set(CATS_ALL_KEY, payload, ttl=CATS_TTL)
    return tree


@router.get("/admin", response_model=list[CategoryTree])
async def list_categories_admin(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    cats = await category_service.get_all_categories_include_inactive(db)
    return category_service.build_tree(cats)


@router.get("/{slug}", response_model=CategoryTree)
async def get_category(slug: str, response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=60"
    cat = await category_service.get_category_by_slug(db, slug)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    all_cats = await category_service.get_all_categories(db)
    tree = category_service.build_tree(all_cats)
    for node in _flatten(tree):
        if node.slug == slug:
            return node
    return CategoryTree.model_validate(cat)


def _flatten(nodes: list[CategoryTree]) -> list[CategoryTree]:
    result: list[CategoryTree] = []
    for n in nodes:
        result.append(n)
        result.extend(_flatten(n.children))
    return result


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    try:
        if body.image_url is not None:
            body = body.model_copy(
                update={"image_url": extract_relative_key(body.image_url)}
            )
        cat = await category_service.create_category(db, body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await cache_delete(CATS_ALL_KEY)
    return cat


@router.post("/{category_id}/image", response_model=CategoryResponse)
async def upload_category_image(
    category_id: int,
    image: UploadFile,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    cat = await category_service.get_category_by_id(db, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    old_key = cat.image_url
    key = await upload_image_file(image, folder="categories", entity_id=category_id)
    cat.image_url = key
    await db.flush()
    await db.refresh(cat)
    if old_key and old_key != key:
        await delete_image_file(old_key)
    await cache_delete(CATS_ALL_KEY)
    return cat


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    cat = await category_service.get_category_by_id(db, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if body.image_url is not None:
        body = body.model_copy(
            update={"image_url": extract_relative_key(body.image_url)}
        )
    cat = await category_service.update_category(db, cat, body)
    await cache_delete(CATS_ALL_KEY)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    cat = await category_service.get_category_by_id(db, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        await category_service.delete_category(db, cat)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await cache_delete(CATS_ALL_KEY)
