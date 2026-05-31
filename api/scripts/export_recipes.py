from __future__ import annotations

import asyncio
from sqlalchemy import select
from app.db import get_sessionmaker
from app.models import MappingTemplate

async def main() -> None:
    sm = get_sessionmaker()
    async with sm() as session:
        stmt = select(MappingTemplate).where(MappingTemplate.archived_at.is_(None)).order_by(MappingTemplate.position.asc(), MappingTemplate.created_at.desc())
        res = await session.execute(stmt)
        templates = res.scalars().all()
        
        if not templates:
            print("No templates found in database. Make sure you seeded the database.")
            return

        markdown_lines = [
            "# AnnealMusic v7.3 — Sonification Recipes & Catalog",
            "",
            "Welcome to the official, editorial handbook of canonical sonification templates in AnnealMusic. These recipes are curated across four scientific domains, complete with rigorous academic references, default parameter layouts, calibration guides, and honest limitations.",
            "",
            "## Table of Contents",
            ""
        ]

        # Group by domain family
        families = {
            "time-series": "Time Series",
            "scalar-field": "Scalar Fields & Spatial Data",
            "network": "Networks & Graph Data",
            "structured-event": "Structured Event Data"
        }

        # Build Table of Contents
        for fam_key, fam_name in families.items():
            markdown_lines.append(f"### {fam_name}")
            fam_templates = [t for t in templates if t.domain_family == fam_key]
            for t in fam_templates:
                markdown_lines.append(f"- [{t.title}](#{t.slug})")
            markdown_lines.append("")

        markdown_lines.append("---")
        markdown_lines.append("")

        # Build each recipe
        for fam_key, fam_name in families.items():
            markdown_lines.append(f"## {fam_name}")
            markdown_lines.append("")
            fam_templates = [t for t in templates if t.domain_family == fam_key]
            for t in fam_templates:
                markdown_lines.append(f"### <a name=\"{t.slug}\"></a> {t.title}")
                markdown_lines.append("")
                markdown_lines.append(f"> **Domain Family**: `{fam_key}`  ")
                if t.citation:
                    markdown_lines.append(f"> **Academic Citation**: *{t.citation}*")
                markdown_lines.append("")
                markdown_lines.append(t.description)
                markdown_lines.append("")
                
                if t.calibration_recommendation:
                    markdown_lines.append("> [!TIP]")
                    markdown_lines.append(f"> **Calibration Recommendation**: {t.calibration_recommendation}")
                    markdown_lines.append("")

                # Print recipe content
                markdown_lines.append(t.recipe_content.strip())
                markdown_lines.append("")
                markdown_lines.append("---")
                markdown_lines.append("")

        # Save to docs/SONIFICATION_RECIPES.md
        import os
        docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs"))
        os.makedirs(docs_dir, exist_ok=True)
        filepath = os.path.join(docs_dir, "SONIFICATION_RECIPES.md")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(markdown_lines))
        
        print(f"Successfully generated {filepath} containing {len(templates)} templates.")

if __name__ == "__main__":
    asyncio.run(main())
