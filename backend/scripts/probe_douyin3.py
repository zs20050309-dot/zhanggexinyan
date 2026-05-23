import asyncio
import re
import httpx

URL = "https://v.douyin.com/EVF_YHF2uB0/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
}

FIELDS = [
    "diggCount",
    "commentCount",
    "shareCount",
    "playCount",
    "collectCount",
    "followerCount",
    "digg_count",
    "comment_count",
    "share_count",
    "play_count",
    "follower_count",
    "withShopEntry",
    "with_shop_entry",
    "commerceUserLevel",
    "commerce_user_level",
    "customVerify",
    "custom_verify",
    "isAds",
    "is_ads",
    "duration",
    "awemeType",
    "aweme_type",
]


async def main():
    async with httpx.AsyncClient(follow_redirects=True, headers=HEADERS, timeout=30) as c:
        text = (await c.get(URL)).text
    for f in FIELDS:
        m = re.search(rf'"{f}"\s*:\s*(".*?"|\d+|true|false|null)', text)
        if m:
            print(f, m.group(1)[:80])


if __name__ == "__main__":
    asyncio.run(main())
