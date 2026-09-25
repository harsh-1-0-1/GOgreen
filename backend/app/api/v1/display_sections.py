from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.display_section import (
    DisplaySectionActiveUpdate,
    DisplaySectionAdminResponse,
    DisplaySectionCreate,
    DisplaySectionReorderRequest,
    DisplaySectionResponse,
    DisplaySectionUpdate,
)
from app.services import display_section_service
from app.utils.redis import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/display_sections", tags=["display_sections"])

CACHE_KEY = "display_sections"
CACHE_TTL = 300


@router.get("", response_model=list[DisplaySectionResponse])
async def list_display_sections(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    cached = await cache_get(CACHE_KEY)
    if cached is not None:
        return cached

    sections = await display_section_service.list_display_sections(db)
    payload = [
        DisplaySectionResponse.model_validate(section).model_dump(mode="json")
        for section in sections
    ]
    await cache_set(CACHE_KEY, payload, ttl=CACHE_TTL)
    return payload


@router.get("/admin", response_model=list[DisplaySectionAdminResponse])
async def list_display_sections_admin(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    rows = await display_section_service.list_display_sections_with_counts(db)
    return [
        DisplaySectionAdminResponse(
            **DisplaySectionResponse.model_validate(section).model_dump(),
            product_count=count,
        )
        for section, count in rows
    ]


@router.post(
    "/admin",
    response_model=DisplaySectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_display_section(
    body: DisplaySectionCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    try:
        section = await display_section_service.create_display_section(db, body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await cache_delete(CACHE_KEY)
    return section


@router.patch("/admin/reorder")
async def reorder_display_sections(
    body: DisplaySectionReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    try:
        await display_section_service.reorder_display_sections(
            db,
            [(item.id, item.sort_order) for item in body.items],
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await cache_delete(CACHE_KEY)
    return {"ok": True}


@router.get("/admin/{section_id}", response_model=DisplaySectionResponse)
async def get_display_section_admin(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    section = await display_section_service.get_display_section(db, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Display section not found")
    return section


@router.put("/admin/{section_id}", response_model=DisplaySectionResponse)
async def update_display_section(
    section_id: int,
    body: DisplaySectionUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    section = await display_section_service.get_display_section(db, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Display section not found")
    try:
        section = await display_section_service.update_display_section(db, section, body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await cache_delete(CACHE_KEY)
    return section


@router.patch("/admin/{section_id}/active", response_model=DisplaySectionResponse)
async def set_display_section_active(
    section_id: int,
    body: DisplaySectionActiveUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    section = await display_section_service.get_display_section(db, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Display section not found")
    section = await display_section_service.set_display_section_active(
        db, section, body.is_active
    )
    await cache_delete(CACHE_KEY)
    return section


@router.delete("/admin/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_display_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    section = await display_section_service.get_display_section(db, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Display section not found")
    try:
        await display_section_service.delete_display_section(db, section)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await cache_delete(CACHE_KEY)
