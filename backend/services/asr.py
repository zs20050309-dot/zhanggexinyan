"""
ASR：调用 OpenAI Whisper（或兼容中转）把音频/视频转中文文本。

设计要点：
- 走 OPENAI_BASE_URL 中转（与项目其他 AI 调用共用一个 API 网关）
- 单文件上传 + 单次返回，足够简单（黑客松场景）
- 中文优化：language="zh"
- 失败抛异常，让上层降级到 desc（在 video_extractor 里处理）
"""
import os
import openai

_client: openai.AsyncOpenAI | None = None


def get_client() -> openai.AsyncOpenAI:
    """惰性创建 OpenAI 客户端，支持中转 base_url。"""
    global _client
    if _client is None:
        kwargs: dict = {"api_key": os.environ["OPENAI_API_KEY"]}
        base_url = os.environ.get("OPENAI_BASE_URL")
        if base_url:
            kwargs["base_url"] = base_url.rstrip("/") + "/v1" if not base_url.endswith("/v1") else base_url
            # 容错：很多中转 base_url 形如 https://x.com（无 /v1）— 自动补
        _client = openai.AsyncOpenAI(**kwargs)
    return _client


def _reset_client() -> None:
    """测试用：重置缓存的 client（如改了 env）"""
    global _client
    _client = None


async def transcribe(audio_path: str) -> str:
    """把音频文件转成中文文本。失败抛异常给上层降级处理。"""
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"音频文件不存在：{audio_path}")

    client = get_client()
    with open(audio_path, "rb") as f:
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language="zh",
        )
    text = (result.text or "").strip()
    if not text:
        raise ValueError("Whisper 返回空文本")
    return text
