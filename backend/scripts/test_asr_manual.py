"""
ASR 手动测试：本地音频 → Whisper 转录链路。

用途：在抖音 CDN 不通的环境下，独立验证 ASR 管线（Whisper API + 中转配置）。

用法：
    cd backend && source .venv/bin/activate
    python scripts/test_asr_manual.py

依赖：
    - .env 配 OPENAI_API_KEY + OPENAI_BASE_URL（或用 OpenAI 官方）
    - macOS 自带 `say` + `afconvert`（生成测试音频）

预期：
    输入：合成的中文 TTS 音频（约 10-15 秒）
    输出：转录文本（应与输入语义一致）
    耗时：~3-5 秒
"""
import asyncio
import os
import subprocess
import sys
import time

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.asr import transcribe

TEST_TEXT = (
    "大家好，这是一段用于测试抖音内容识别器音频转文字功能的中文语音。"
    "今天我们要讨论的是焦虑贩卖型短视频。这种视频通常用绝对化的表述制造紧迫感。"
)

AIFF_PATH = "/tmp/asr_manual_test.aiff"
M4A_PATH = "/tmp/asr_manual_test.m4a"


def _generate_audio():
    """用 macOS `say` 生成 AIFF，再用 `afconvert` 转 m4a"""
    print(f"[1] 生成测试音频: {TEST_TEXT[:30]}…")
    subprocess.run(
        ["say", "-v", "Tingting", "-o", AIFF_PATH, TEST_TEXT],
        check=True,
    )
    subprocess.run(
        ["afconvert", AIFF_PATH, M4A_PATH, "-f", "m4af", "-d", "aac"],
        check=True,
    )
    size = os.path.getsize(M4A_PATH) / 1024
    print(f"    生成 {M4A_PATH} ({size:.1f}KB)")


async def main():
    if not os.environ.get("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY 未配置。请检查 backend/.env")
        return

    print("=" * 60)
    print("ASR 管线手动测试")
    print("=" * 60)
    print(f"OPENAI_BASE_URL: {os.environ.get('OPENAI_BASE_URL') or '(官方)'}")
    print()

    _generate_audio()

    print(f"\n[2] 调 Whisper API…")
    t0 = time.time()
    try:
        text = await transcribe(M4A_PATH)
    except Exception as e:
        print(f"❌ 转录失败: {e}")
        return
    elapsed = time.time() - t0

    print(f"    用时 {elapsed:.1f}s\n")
    print(f"[3] 转录结果（{len(text)} 字）:")
    print("    " + text.replace("\n", "\n    "))
    print()
    print("=" * 60)
    print("✅ ASR 管线工作正常")
    print()
    print("下一步：")
    print("  - 当前 VPN 环境下抖音 CDN 不可达，无法走完整端到端")
    print("  - 关掉 VPN（国内网络）或部署国内服务器后，整条链路自动通畅")
    print("  - 命令：python scripts/test_real_extract.py（去 .env 里 SKIP_ASR）")


if __name__ == "__main__":
    asyncio.run(main())
