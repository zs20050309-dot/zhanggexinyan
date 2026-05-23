import os
import json
import anthropic
from typing import AsyncIterator

_client: anthropic.AsyncAnthropic | None = None

MODEL = "claude-sonnet-4-6"
MAX_RETRIES = 3


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


async def call_claude(
    system: str,
    user: str,
    max_tokens: int = 1024,
    expect_json: bool = False,
) -> str | dict:
    client = get_client()
    for attempt in range(MAX_RETRIES):
        msg = await client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = msg.content[0].text.strip()

        if not expect_json:
            return text

        try:
            # 处理模型有时用代码块包裹JSON的情况
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text)
        except json.JSONDecodeError:
            if attempt == MAX_RETRIES - 1:
                raise ValueError(f"Claude未返回合法JSON，原始内容：{text[:200]}")

    raise RuntimeError("Claude调用重试耗尽")


async def stream_claude(
    system: str,
    user: str,
    max_tokens: int = 4096,
) -> AsyncIterator[str]:
    client = get_client()
    async with client.messages.stream(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        async for text in stream.text_stream:
            yield text
