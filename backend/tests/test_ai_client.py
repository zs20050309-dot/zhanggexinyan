import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def _make_anthropic_response(text: str) -> MagicMock:
    """构造 Anthropic SDK messages.create() 的 mock 响应"""
    mock_content = MagicMock()
    mock_content.text = text
    mock_msg = MagicMock()
    mock_msg.content = [mock_content]
    return mock_msg


@pytest.mark.asyncio
async def test_call_claude_returns_text():
    """非流式调用应返回字符串"""
    with patch("services.ai_client.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_anthropic_response("Hello from Claude")
        )
        mock_get_client.return_value = mock_client

        from services.ai_client import call_claude
        result = await call_claude(system="你是助手", user="你好")

    assert result == "Hello from Claude"


@pytest.mark.asyncio
async def test_call_claude_returns_parsed_json_when_expect_json():
    """expect_json=True 时应返回解析后的字典"""
    with patch("services.ai_client.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_anthropic_response(
                '{"types": ["anxiety_selling"], "risk_score": 72}'
            )
        )
        mock_get_client.return_value = mock_client

        from services.ai_client import call_claude
        result = await call_claude(system="你是助手", user="分析内容", expect_json=True)

    assert isinstance(result, dict)
    assert result["types"] == ["anxiety_selling"]
    assert result["risk_score"] == 72


@pytest.mark.asyncio
async def test_call_claude_handles_json_in_code_block():
    """模型返回 ```json ... ``` 格式时应能正确解析"""
    with patch("services.ai_client.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=_make_anthropic_response(
                '```json\n{"types": ["conflict_provoking"], "risk_score": 55}\n```'
            )
        )
        mock_get_client.return_value = mock_client

        from services.ai_client import call_claude
        result = await call_claude(system="你是助手", user="分析", expect_json=True)

    assert result["types"] == ["conflict_provoking"]
