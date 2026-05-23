import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.mark.asyncio
async def test_transcribe_returns_text():
    """transcribe 应返回字符串格式的转录结果"""
    mock_result = MagicMock()
    mock_result.text = "这是视频的转录内容"

    with patch("services.asr.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            result = await transcribe("/tmp/fake_audio.mp4")

    assert result == "这是视频的转录内容"
    assert isinstance(result, str)


@pytest.mark.asyncio
async def test_transcribe_uses_chinese_language():
    """transcribe 应使用 zh 语言参数"""
    mock_result = MagicMock()
    mock_result.text = "中文内容"

    with patch("services.asr.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            await transcribe("/tmp/test.mp4")

    call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
    assert call_kwargs.get("language") == "zh"
