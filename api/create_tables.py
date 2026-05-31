import asyncio
import os
from app.db import Base, get_engine
# Explicitly import all models so they register on Base.metadata
from app.models import MappingTemplate, Sonification, User

async def main():
    # Set the local SQLite dev database URL
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////Users/averykarlin/annealMusic/api/test.db"
    
    engine = get_engine()
    async with engine.begin() as conn:
        print("Creating any missing database tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
