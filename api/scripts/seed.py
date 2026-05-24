"""Seed a demo anon user with a couple of patches for local UI work.

    python -m scripts.seed   (with DATABASE_URL pointed at your local Postgres)
"""

from __future__ import annotations

import asyncio
import uuid

from app.db import get_sessionmaker
from app.models import Patch, User
from app.slug import new_slug

DEMO_ANON = uuid.UUID("00000000-0000-4000-8000-000000000001")

PARAMS_ONLY = "m=open&e=sine&rootFreq=110&spread=1.00&coupling=0.30"
WITH_FROZEN_LOOP = "m=open&e=fm&rootFreq=147&fm.modIndex=3.00&LA.f=1&LA.gs=140&LA.gd=16"


async def main() -> None:
    sm = get_sessionmaker()
    async with sm() as session:
        user = await session.get(User, DEMO_ANON)
        if user is None:
            user = User(id=DEMO_ANON)
            session.add(user)
            await session.flush()

        for title, payload in (
            ("Demo · params only", PARAMS_ONLY),
            ("Demo · frozen loop A", WITH_FROZEN_LOOP),
        ):
            session.add(
                Patch(
                    user_id=DEMO_ANON,
                    schema_ver=4,
                    state={"v": 4, "payload": payload},
                    title=title,
                    visibility="unlisted",
                    capture_refs=[],
                    short_slug=new_slug(),
                )
            )
            user.patch_count += 1
        await session.commit()
        print(f"seeded demo anon {DEMO_ANON} with 2 patches")


if __name__ == "__main__":
    asyncio.run(main())
