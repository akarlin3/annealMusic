import asyncio
import os
import uuid

from app.db import get_sessionmaker
from app.models import Track, Lesson, LessonStep, AudioClip
from app.services import curriculum_content as cc

async def main():
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:////Users/averykarlin/annealMusic/api/test.db"
    
    sm = get_sessionmaker()
    async with sm() as session:
        # Clear existing tracks, lessons, and lesson steps
        print("Clearing old curriculum tracks, lessons, and steps...")
        await session.execute(LessonStep.__table__.delete())
        await session.execute(Lesson.__table__.delete())
        await session.execute(Track.__table__.delete())
        await session.commit()
        
        # Resolve tracks
        print("Seeding tracks...")
        track_ids = {}
        for i, t in enumerate(cc.TRACKS):
            tid = uuid.uuid5(uuid.NAMESPACE_URL, f"annealmusic/track/{t['slug']}")
            track_ids[t["slug"]] = tid
            session.add(Track(
                id=tid, 
                slug=t["slug"], 
                title=t["title"], 
                description=t.get("description", t["title"]),
                position=i,
                color="#6366f1"
            ))
        await session.flush()
        
        # Build prerequisites dictionary
        spec_to_uuid = {l["id"]: uuid.uuid5(uuid.NAMESPACE_URL, f"annealmusic/lesson/{l['id']}") for l in cc.LESSONS}
        prereqs = {l["id"]: [] for l in cc.LESSONS}
        for pre, lesson in cc.PREREQ_EDGES:
            if pre in spec_to_uuid and lesson in spec_to_uuid:
                prereqs[lesson].append(spec_to_uuid[pre])
                
        # Find audio clip slugs for reference
        clip_rows = (await session.execute(AudioClip.__table__.select())).all()
        # clip_rows will have (id, slug, title, ...)
        # Let's map clip_slug -> clip_uuid
        clip_map = {row.slug: row.id for row in clip_rows}
        # Fallback to first clip if not matched
        fallback_clip_id = clip_rows[0].id if clip_rows else uuid.uuid4()
        
        print("Seeding lessons and steps...")
        pos = {}
        for lesson in cc.LESSONS:
            track = lesson["track"]
            p = pos.get(track, 0)
            pos[track] = p + 1
            
            lesson_id = spec_to_uuid[lesson["id"]]
            
            # Create lesson
            session.add(Lesson(
                id=lesson_id,
                track_id=track_ids[track],
                slug=lesson["id"].split("/", 1)[1],
                title=lesson["title"],
                description=lesson.get("description") or (lesson.get("objectives") or [None])[0],
                difficulty=lesson["difficulty"],
                estimated_minutes=lesson.get("estimated_minutes", 12),
                position=p,
                prerequisites=prereqs[lesson["id"]],
                spec=lesson,
                generation_status="ready",
                modes=lesson.get("modes") or ["musician"],
                onboarding_mode=lesson.get("onboarding_mode"),
            ))
            
            # Create steps for this lesson
            for step_idx, step_outline in enumerate(lesson.get("step_outline", [])):
                step_type = step_outline["type"]
                config = {}
                
                if step_type == "text":
                    config = {
                        "title": step_outline.get("topic") or "Key Concepts",
                        "content": f"In this step, we explore **{step_outline.get('topic', 'the fundamentals')}**.\n\nGenerative synthesis thrives on phase synchronization, slow drift, and harmonic lattices. Understanding these concepts helps you shape the soundscape in a deep, meaningful way.",
                        "key_points": [
                            "Learn how parameter changes affect the sound field.",
                            "Focus on active listening to identify subtle shifts."
                        ]
                    }
                    if step_outline.get("diagram"):
                        config["diagram"] = {
                            "kind": "svg",
                            "source": "<svg width='100%' height='80' viewBox='0 0 100 80' xmlns='http://www.w3.org/2000/svg'><rect width='100' height='80' fill='#1e293b' rx='6'/><circle cx='50' cy='35' r='15' fill='none' stroke='#f59e0b' stroke-width='2'/><text x='50' y='65' font-family='sans-serif' font-size='6' fill='#94a3b8' text-anchor='middle'>Coherent Sync field</text></svg>"
                        }
                elif step_type == "demo":
                    config = {
                        "title": "Interactive Demo State",
                        "description": step_outline.get("patch_brief") or "Listen to this initial patch configuration.",
                        "patch": "m=open&e=sine&rootFreq=110&spread=1.00&coupling=0.30",
                        "highlights": lesson.get("constraints_during_prompts") or ["brightness", "space"]
                    }
                elif step_type == "prompt":
                    config = {
                        "title": "Tactile Experimentation",
                        "prompt": step_outline.get("task") or "Move the sliders and observe.",
                        "constraints": lesson.get("constraints_during_prompts") or ["brightness", "space"],
                        "hint": "Try raising the drift slider to 0.70 and wait 5 seconds. Notice how the oscillators start to float separately."
                    }
                elif step_type == "reflection":
                    config = {
                        "title": "Observe & Integrate",
                        "prompt": step_outline.get("topic") or "What did you feel when the sound shifted?",
                        "placeholder": "Reflect on your experience..."
                    }
                elif step_type == "audio-clip":
                    # Try to find a clip by checking tags or finding a match
                    clip_topic = step_outline.get("clip_topic", "").lower()
                    matched_clip_id = fallback_clip_id
                    for slug, cid in clip_map.items():
                        if slug in clip_topic or clip_topic in slug:
                            matched_clip_id = cid
                            break
                    config = {
                        "clip_id": str(matched_clip_id),
                        "intro_text": f"Listen to this referenced audio clip about: {step_outline.get('clip_topic')}.",
                        "outro_text": "Notice how the spectral focus changes in this reference recording.",
                        "auto_advance": False,
                        "loop": False
                    }
                
                session.add(LessonStep(
                    id=uuid.uuid4(),
                    lesson_id=lesson_id,
                    position=step_idx,
                    type=step_type,
                    config=config
                ))
                
        await session.commit()
        print("Curriculum seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
