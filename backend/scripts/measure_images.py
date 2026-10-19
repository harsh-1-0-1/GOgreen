"""Compare homepage image weight before/after the WebP fix. Stdlib only.

Run on any machine:  python3 measure_images.py
It reads the live API, then downloads each banner image twice: the file the old
code loaded (the original upload) and the file the new code loads (a WebP size),
and prints size, time and CloudFront cache status for each.
"""
import json
import time
import urllib.error
import urllib.request

API = "https://plantoga.com/api/v1"
# placement -> WebP size the new code picks on a phone (old code used the original)
PLACEMENTS = {"category_nav": "w400", "strip": "w800", "highlight": "w800"}


def get_json(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.load(r)


def fetch(url):
    """(status, bytes, seconds, x-cache) for one full download."""
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            size = len(r.read())
            return r.status, size, time.perf_counter() - start, r.headers.get("x-cache", "-")
    except urllib.error.HTTPError as e:
        return e.code, 0, time.perf_counter() - start, e.headers.get("x-cache", "-")


def main():
    totals = {"old": [0, 0.0], "new": [0, 0.0]}
    missing = 0
    for placement, size_name in PLACEMENTS.items():
        banners = get_json(f"{API}/banners?placement={placement}")
        print(f"\n== {placement} ({len(banners)} banners)")
        for b in banners:
            original = b.get("image_url")
            if not original:
                continue
            webp = (b.get("image_urls") or {}).get(size_name)
            for label, url in (("old", original), ("new", webp or original)):
                status, size, secs, cache = fetch(url)
                if status != 200:
                    missing += 1
                totals[label][0] += size
                totals[label][1] += secs
                print(f"  {label}  {status}  {size / 1024:8.0f} KB  {secs:5.2f}s  {cache:<26}  {url.rsplit('/', 1)[-1]}")
    print("\n== total for these homepage images")
    for label in ("old", "new"):
        print(f"  {label}: {totals[label][0] / 1024 / 1024:6.2f} MB, {totals[label][1]:5.1f}s of downloads back to back")
    if missing:
        print(f"\n{missing} file(s) were not 200. A 404 on a .w400/.w800 file means the backfill"
              " (scripts/migrate_images.py) has not run yet.")


if __name__ == "__main__":
    main()
