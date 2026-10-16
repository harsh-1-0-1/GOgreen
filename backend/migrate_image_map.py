import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from loguru import logger

from app.core.config import settings
from app.db.models import Product

async def migrate_variant_image_maps() -> None:
    logger.info("Running standalone database migration: converting variant image_map strings to lists...")
    
    # Setup engine and session factory
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_factory() as session:
        try:
            result = await session.execute(select(Product))
            products = result.scalars().all()
            migrated_count = 0
            
            for product in products:
                if product.variants and "image_map" in product.variants:
                    image_map = product.variants["image_map"]
                    if not isinstance(image_map, dict):
                        continue
                    
                    changed = False
                    new_image_map = {}
                    for k, v in image_map.items():
                        if isinstance(v, str):
                            # Convert string to list of string
                            new_image_map[k] = [v] if v.strip() else []
                            changed = True
                        elif isinstance(v, list):
                            new_image_map[k] = v
                        else:
                            new_image_map[k] = []
                            changed = True
                            
                    if changed:
                        product.variants["image_map"] = new_image_map
                        # Since variants is a mutable JSON column, notify SQLAlchemy
                        flag_modified(product, "variants")
                        migrated_count += 1
                        
            if migrated_count > 0:
                await session.commit()
                logger.info(f"Successfully migrated {migrated_count} product image_maps.")
            else:
                logger.info("No product image_maps needed migration.")
        except Exception as e:
            await session.rollback()
            logger.exception(f"Failed to run database migration: {e}")
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate_variant_image_maps())
