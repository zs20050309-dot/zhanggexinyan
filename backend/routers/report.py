import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from models.schemas import ReportGenerateRequest
from services.ai_client import stream_claude
from services.report_store import save_report, get_report
from prompts import report as report_prompt

router = APIRouter()


@router.post("/generate")
async def generate(req: ReportGenerateRequest):
    system = report_prompt.SYSTEM
    user_prompt = report_prompt.build_user_prompt(
        transcript=req.transcript,
        title=req.title,
        author=req.author,
        diagnosis=req.diagnosis,
        answers=req.answers,
        search_result=req.search_result,
    )

    collected_content = []

    async def event_stream():
        async for chunk in stream_claude(system=system, user=user_prompt, max_tokens=4096):
            collected_content.append(chunk)
            payload = json.dumps({"type": "chunk", "content": chunk}, ensure_ascii=False)
            yield f"data: {payload}\n\n"

        full_content = "".join(collected_content)
        report_id = save_report(
            content=full_content,
            video_title=req.title,
            diagnosis_types=req.diagnosis.types,
        )
        done_payload = json.dumps({"type": "done", "report_id": report_id}, ensure_ascii=False)
        yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{report_id}")
async def get(report_id: str):
    report = get_report(report_id)
    if report is None:
        return JSONResponse(
            status_code=404,
            content={"error": "报告不存在或已过期", "code": "REPORT_NOT_FOUND"},
        )
    return report
