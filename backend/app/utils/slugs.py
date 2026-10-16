"""Canonical slugification.

This is the single source of truth for turning a human label into the slug form
used by URLs, the `tags.slug` column and tag filters. Several services used to
carry private copies of this function; they all have to agree or a tag becomes
unfilterable (e.g. the label "Vastu friendly" vs the slug `vastu-friendly`).
"""

import re


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")
