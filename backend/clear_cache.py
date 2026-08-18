import asyncio
from app.utils.redis import init_redis, cache_delete_pattern

async def main():
    await init_redis()
    await cache_delete_pattern("products:*")
    print("Cache cleared")

if __name__ == '__main__':
    asyncio.run(main())
