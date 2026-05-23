import asyncio
import html as htmlmod
import json
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import httpx

URL = sys.argv[1] if len(sys.argv) > 1 else "https://v.douyin.com/EVF_YHF2uB0/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
}


async def main():
    async with httpx.AsyncClient(follow_redirects=True, headers=HEADERS, timeout=30) as c:
        r = await c.get(URL)
        text = r.text
        final = str(r.url)
        print("final_url", final[:160])

        for pat in [r"/video/(\d+)", r"/note/(\d+)"]:
            m = re.search(pat, final)
            if m:
                print("id_from_url", pat, m.group(1))

        m = re.search(
            r'<script id="RENDER_DATA" type="application/json">([^<]+)</script>',
            text,
        )
        if m:
            raw = htmlmod.unescape(m.group(1))
            data = json.loads(raw)
            print("RENDER_DATA top keys", list(data.keys())[:8])

        for tag in ["og:title", "og:description", "description"]:
            mt = re.search(
                rf'<meta[^>]+(?:property|name)="{tag}"[^>]+content="([^"]+)"',
                text,
            )
            if mt:
                print(tag, mt.group(1)[:160])

        # SIGI_STATE style
        m2 = re.search(r'<script id="SIGI_STATE" type="application/json">([^<]+)</script>', text)
        if m2:
            print("SIGI_STATE len", len(m2.group(1)))

        # generic desc/nickname in page
        descs = re.findall(r'"desc":"(.*?)"', text)
        nicks = re.findall(r'"nickname":"(.*?)"', text)
        print("desc samples", descs[:2])
        print("nickname samples", nicks[:2])


if __name__ == "__main__":
    asyncio.run(main())
