import asyncio
import html as htmlmod
import json
import re
import sys
import os

import httpx

URL = sys.argv[1] if len(sys.argv) > 1 else "https://v.douyin.com/EVF_YHF2uB0/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
}


def find_aweme_blob(obj, found=None):
    if found is None:
        found = []
    if isinstance(obj, dict):
        if "awemeId" in obj or "aweme_id" in obj:
            found.append(obj)
        for v in obj.values():
            find_aweme_blob(v, found)
    elif isinstance(obj, list):
        for v in obj:
            find_aweme_blob(v, found)
    return found


async def main():
    async with httpx.AsyncClient(follow_redirects=True, headers=HEADERS, timeout=30) as c:
        r = await c.get(URL)
        text = r.text
        print("status", r.status_code, "len", len(text))

        m = re.search(
            r'<script id="RENDER_DATA" type="application/json">([^<]+)</script>',
            text,
        )
        if m:
            data = json.loads(htmlmod.unescape(m.group(1)))
            blobs = find_aweme_blob(data)
            print("aweme blobs", len(blobs))
            if blobs:
                b = blobs[0]
                print("keys", list(b.keys())[:20])
                print("desc", (b.get("desc") or "")[:200])
                author = b.get("author") or b.get("authorInfo") or {}
                print("author", author.get("nickname") if isinstance(author, dict) else author)
                stats = b.get("statistics") or b.get("stats") or {}
                print("stats", stats)

        # fallback regex desc
        m2 = re.search(r'"desc":"((?:\\.|[^"\\])*)"', text)
        if m2:
            desc = json.loads('"' + m2.group(1) + '"')
            print("regex desc len", len(desc))


if __name__ == "__main__":
    asyncio.run(main())
