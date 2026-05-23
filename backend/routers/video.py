import uuid
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from models.schemas import VideoExtractRequest, VideoManualRequest, VideoContent
from services.video_extractor import extract_video

router = APIRouter()


@router.post("/extract")
async def extract(req: VideoExtractRequest):
    result = await extract_video(req.url)
    if result is None:
        return JSONResponse(
            status_code=422,
            content={
                "error": "视频解析失败，请手动粘贴视频内容",
                "code": "EXTRACT_FAILED",
                "fallback_available": True,
            },
        )
    return result


@router.post("/manual")
async def manual_input(req: VideoManualRequest):
    return VideoContent(
        video_id=str(uuid.uuid4()),
        transcript=req.text,
        title=req.title,
        author=req.author or "未知账号",
        source="manual",
    )
