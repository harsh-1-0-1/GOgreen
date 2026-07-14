import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.core.config import settings
from app.db.models import Product

async def inspect_products() -> None:
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_factory() as session:
        result = await session.execute(select(Product))
        products = result.scalars().all()
        print(f"Total products: {len(products)}")
        with_variants = [p for p in products if p.variants is not None]
        print(f"Products with variants: {len(with_variants)}")
        for p in with_variants[:5]:
            print(f"Product {p.name} (ID {p.id}): variants = {p.variants}")
                    
if __name__ == "__main__":
    asyncio.run(inspect_products())
