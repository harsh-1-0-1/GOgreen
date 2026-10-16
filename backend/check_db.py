import asyncio
from sqlalchemy import select
from app.db.session import async_sessionmaker, engine
from app.db.models import Category, Product

async def main():
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as db:
        res = await db.execute(select(Category.slug))
        cats = res.scalars().all()
        print("Categories:", cats)
        
        res2 = await db.execute(select(Product.tags))
        tags = res2.scalars().all()
        print("Tags:", tags)

asyncio.run(main())
