"""
端到端测试：CDN 解析 → 下载 → Whisper 转录
需要 OPENAI_API_KEY 和 OPENAI_BASE_URL 配置（.env 文件）。
视频下载约 10-30 秒，转录约 5-15 秒。

运行方式：
    cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
    source .venv/bin/activate
    python scripts/test_full_extract.py
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.video_extractor import extract_video

# ⚠️ 替换为真实的抖音视频链接
TEST_URL = "https://v.douyin.com/替换为真实链接/"


async def main():
    print("开始完整解析流程（CDN 解析 → 下载 → ASR 转录）...")
    print(f"链接：{TEST_URL[:80]}")
    print()

    result = await extract_video(TEST_URL)

    if result is None:
        print("❌ 解析失败，回退到手动输入模式")
        return

    print(f"✅ 解析成功！")
    print(f"  video_id：{result.video_id}")
    print(f"  标题：{result.title}")
    print(f"  作者：{result.author}")
    print(f"  点赞：{result.likes:,}" if result.likes else "  点赞：未知")
    print(f"  播放：{result.play_count:,}" if result.play_count else "  播放：未知")
    print(f"  粉丝：{result.follower_count:,}" if result.follower_count else "  粉丝：未知")
    print(f"  with_shop_entry：{result.with_shop_entry}")
    print(f"  commerce_level：{result.commerce_level}")
    print(f"  creator_verified：{result.creator_verified}")
    print(f"  is_ad：{result.is_ad}")
    print(f"  source：{result.source}")
    print(f"\n  转录（前200字）：")
    print(f"  {result.transcript[:200]}...")


if __name__ == "__main__":
    asyncio.run(main())
