import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.db.models import Category
from app.services.category_service import delete_category

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///plantoga.db")
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(Category).where(Category.id == 91))
        category = result.scalar_one_or_none()
        
        if category:
            print(f"Deleting category 91: {category.name}")
            try:
                await delete_category(session, category)
                await session.commit()
                print("Successfully deleted!")
            except Exception as e:
                print(f"Error: {e}")
        else:
            print("Category 91 not found.")

if __name__ == "__main__":
    asyncio.run(main())
