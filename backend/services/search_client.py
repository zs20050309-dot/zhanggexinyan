import os
from datetime import datetime, timezone
from tavily import TavilyClient
from models.schemas import SearchResult

_client: TavilyClient | None = None


def get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    return _client


async def search(query: str, context: str) -> SearchResult | None:
    try:
        client = get_client()
        response = client.search(
            query=query,
            search_depth="basic",
            max_results=5,
            include_answer=True,
        )
        answer = response.get("answer", "")
        sources = [r.get("title", "") for r in response.get("results", [])[:3]]

        return SearchResult(
            summary=answer,
            sources=[s for s in sources if s],
            retrieved_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        print(f"[search_client] 搜索失败: {e}")
        return None
