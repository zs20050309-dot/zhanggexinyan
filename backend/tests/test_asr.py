"""ASR 单元测试（mock，不调真实网络）"""
import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.fixture(autouse=True)
def reset_asr_client():
    """每个测试前后重置 asr 模块级 client，避免 env 变化时缓存陈旧"""
    from services import asr
    asr._reset_client()
    yield
    asr._reset_client()


async def test_transcribe_returns_text():
    """transcribe 应返回字符串格式的转录结果"""
    mock_result = MagicMock()
    mock_result.text = "这是视频的转录内容"

    with patch("services.asr.get_client") as mock_get_client, \
         patch("os.path.exists", return_value=True):
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            result = await transcribe("/tmp/fake_audio.mp4")

    assert result == "这是视频的转录内容"
    assert isinstance(result, str)


async def test_transcribe_uses_chinese_language():
    """transcribe 应使用 zh 语言参数"""
    mock_result = MagicMock()
    mock_result.text = "中文内容"

    with patch("services.asr.get_client") as mock_get_client, \
         patch("os.path.exists", return_value=True):
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            await transcribe("/tmp/test.mp4")

    call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
    assert call_kwargs.get("language") == "zh"
    assert call_kwargs.get("model") == "whisper-1"


async def test_transcribe_raises_on_missing_file():
    """音频文件不存在应抛 FileNotFoundError"""
    from services.asr import transcribe
    with pytest.raises(FileNotFoundError):
        await transcribe("/nonexistent/audio.mp4")


async def test_transcribe_raises_on_empty_result():
    """Whisper 返回空文本应抛 ValueError 让上层降级"""
    mock_result = MagicMock()
    mock_result.text = "   "  # whitespace only

    with patch("services.asr.get_client") as mock_get_client, \
         patch("os.path.exists", return_value=True):
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            with pytest.raises(ValueError):
                await transcribe("/tmp/empty.mp4")


async def test_transcribe_strips_whitespace():
    """转录结果应去除前后空白"""
    mock_result = MagicMock()
    mock_result.text = "  视频内容  \n"

    with patch("services.asr.get_client") as mock_get_client, \
         patch("os.path.exists", return_value=True):
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            result = await transcribe("/tmp/test.mp4")

    assert result == "视频内容"


def test_get_client_uses_base_url_when_set(monkeypatch):
    """OPENAI_BASE_URL 配置时应传给 client"""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.openai-next.com")

    from services import asr
    asr._reset_client()

    with patch("openai.AsyncOpenAI") as mock_async_openai:
        asr.get_client()

    args, kwargs = mock_async_openai.call_args
    assert kwargs["api_key"] == "test-key"
    # 中转 base url 应自动补 /v1
    assert kwargs["base_url"] == "https://api.openai-next.com/v1"


def test_get_client_no_base_url_when_not_set(monkeypatch):
    """没配 OPENAI_BASE_URL 时不应传 base_url（用 OpenAI 官方）"""
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)

    from services import asr
    asr._reset_client()

    with patch("openai.AsyncOpenAI") as mock_async_openai:
        asr.get_client()

    args, kwargs = mock_async_openai.call_args
    assert "base_url" not in kwargs


def test_get_client_preserves_explicit_v1(monkeypatch):
    """base_url 已经带 /v1 时不应再补"""
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.openai-next.com/v1")

    from services import asr
    asr._reset_client()

    with patch("openai.AsyncOpenAI") as mock_async_openai:
        asr.get_client()

    args, kwargs = mock_async_openai.call_args
    assert kwargs["base_url"] == "https://api.openai-next.com/v1"
