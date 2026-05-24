"""
真实抖音链接端到端解析测试。

用法:
    cd backend && source .venv/bin/activate
    python scripts/test_real_extract.py

可选环境变量:
    SKIP_ASR=true          跳过下载+Whisper，仅用视频描述
    DOUYIN_PROXY=http://127.0.0.1:7890
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.video_extractor import (
    _extract_url_from_share_text,
    _resolve_aweme_id,
    _resolve_aweme_id_mirror,
    _fetch_aweme_metadata,
    extract_video,
    check_douyin_connectivity,
)

# 用户提供的真实分享文本
TEST_SHARE = "https://v.douyin.com/15ZzY6bMaqc/ a@N.wS eoq:/ 01/13 :2pm"


async def main():
    print("=" * 60)
    print("抖音真实链接解析测试")
    print("=" * 60)

    url = _extract_url_from_share_text(TEST_SHARE)
    print(f"\n[1] 清洗 URL: {url}")

    print("\n[2] 网络自检:")
    ping = await check_douyin_connectivity()
    for k, v in ping.items():
        if k != "targets":
            print(f"    {k}: {v}")
    for t, r in ping.get("targets", {}).items():
        print(f"    {t}: {r}")

    print("\n[3] 镜像 API 解析 aweme_id:")
    mirror_id = await _resolve_aweme_id_mirror(url)
    print(f"    mirror aweme_id = {mirror_id or '失败'}")

    print("\n[4] 综合解析 aweme_id:")
    aweme_id = await _resolve_aweme_id(url)
    if not aweme_id:
        print("    ❌ 无法获取 aweme_id")
        sys.exit(1)
    print(f"    ✅ aweme_id = {aweme_id}")

    print("\n[5] 获取元数据:")
    meta = await _fetch_aweme_metadata(aweme_id, source_url=url)
    if not meta:
        print("    ❌ 元数据获取失败（需能访问 iesdouyin.com 或配置可用代理）")
        print("    提示: 在 .env 设置 DOUYIN_PROXY=http://127.0.0.1:7890")
        sys.exit(1)

    desc = (meta.get("desc") or "")[:80]
    author = (meta.get("author") or {}).get("nickname", "?")
    print(f"    ✅ 标题/描述: {desc}")
    print(f"    ✅ 作者: {author}")

    print("\n[6] 完整 extract_video（含 ASR 或描述降级）:")
    skip = os.environ.get("SKIP_ASR", "")
    if skip:
        print(f"    (SKIP_ASR={skip})")
    result = await extract_video(TEST_SHARE)
    if result is None:
        print("    ❌ extract_video 返回 None")
        sys.exit(1)

    print(f"    ✅ video_id: {result.video_id}")
    print(f"    ✅ author: {result.author}")
    print(f"    ✅ title: {result.title[:60]}")
    print(f"    ✅ source: {result.source}")
    print(f"    ✅ likes: {result.likes}")
    print(f"    ✅ transcript ({len(result.transcript)} 字):")
    print(f"       {result.transcript[:300]}...")
    print("\n" + "=" * 60)
    print("✅ 全部通过")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
