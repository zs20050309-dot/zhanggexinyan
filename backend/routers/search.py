from fastapi import APIRouter
from fastapi.responses import JSONResponse
from models.schemas import SearchRequest
from services.search_client import search

router = APIRouter()


@router.post("")
async def do_search(req: SearchRequest):
    result = await search(query=req.query, context=req.context)
    if result is None:
        return JSONResponse(
            status_code=503,
            content={"error": "搜索服务暂时不可用", "code": "SEARCH_UNAVAILABLE"},
        )
    return result
