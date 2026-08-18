import asyncio
from sqlalchemy import select
from app.db.session import async_session_maker
from app.db.models import Category, Product

async def main():
    async with async_session_maker() as db:
        res = await db.execute(select(Category.slug))
        cats = res.scalars().all()
        print("Categories:", cats)
        
        res2 = await db.execute(select(Product.tags))
        tags = res2.scalars().all()
        print("Tags:", tags)

asyncio.run(main())
