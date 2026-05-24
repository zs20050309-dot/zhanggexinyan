"""
验证 CDN 解析方案是否可用于抖音视频元数据提取。
替换 TEST_URL 为一条真实的公开抖音分享链接。
支持纯 URL 或完整分享文本（含中文文字）。

运行方式：
    cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
    source .venv/bin/activate
    python scripts/test_cdn_extract.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.video_extractor import (
    _extract_url_from_share_text,
    _resolve_aweme_id,
    _fetch_aweme_metadata,
)

# ⚠️ 替换为真实的抖音视频链接或分享文本
TEST_URL = "https://v.douyin.com/15ZzY6bMaqc/ a@N.wS eoq:/ 01/13 :2pm"  # 真实分享文案


async def main():
    print(f"输入：{TEST_URL[:80]}...")

    # Step 1: 提取 URL
    url = _extract_url_from_share_text(TEST_URL)
    print(f"提取 URL：{url}")

    # Step 2: 解析 aweme_id
    aweme_id = await _resolve_aweme_id(url)
    if not aweme_id:
        print("❌ 无法提取 aweme_id，检查链接是否有效")
        sys.exit(1)
    print(f"✅ aweme_id：{aweme_id}")

    # Step 3: 获取元数据
    meta = await _fetch_aweme_metadata(aweme_id)
    if not meta:
        print("❌ API 返回空，可能已被反爬")
        sys.exit(1)

    # 打印关键元数据
    statistics = meta.get("statistics", {})
    author = meta.get("author", {})
    video_info = meta.get("video", {})
    url_list = (
        video_info.get("play_addr", {}).get("url_list", [])
        or video_info.get("download_addr", {}).get("url_list", [])
    )

    print(f"\n✅ 元数据提取成功！")
    print(f"  标题：{meta.get('desc', '未知')[:60]}")
    print(f"  作者：{author.get('nickname')}（粉丝 {author.get('follower_count', 0):,}）")
    print(f"  认证：{author.get('custom_verify') or '无'}")
    print(f"  开通小店：{author.get('with_shop_entry', False)}")
    print(f"  商业化等级：{author.get('commerce_user_level', 0)}/5")
    print(f"  是否广告：{meta.get('is_ads', False)}")
    print(f"  点赞：{statistics.get('digg_count', 0):,}")
    print(f"  播放：{statistics.get('play_count', 0):,}")
    print(f"  评论：{statistics.get('comment_count', 0):,}")
    print(f"  视频直链数量：{len(url_list)}")
    print(f"  视频直链（前50字符）：{url_list[0][:50] if url_list else '未找到'}...")

    if not url_list:
        print("\n⚠️  未找到视频直链，无法下载转录")
    else:
        print(f"\n✅ 下载直链已获取，可继续测试 ASR 转录")


if __name__ == "__main__":
    asyncio.run(main())
