from fastapi import APIRouter
from models.schemas import DiagnosisRequest, DiagnosisResult, CONTENT_TYPE_ZH
from services.ai_client import call_claude
from prompts import diagnosis as diagnosis_prompt

router = APIRouter()

RISK_LEVEL_MAP = {
    (0, 30): "low",
    (31, 60): "medium",
    (61, 85): "high",
    (86, 100): "critical",
}


def score_to_level(score: int) -> str:
    for (lo, hi), level in RISK_LEVEL_MAP.items():
        if lo <= score <= hi:
            return level
    return "critical"


@router.post("")
async def diagnose(req: DiagnosisRequest) -> DiagnosisResult:
    user_prompt = diagnosis_prompt.build_user_prompt(
        transcript=req.transcript,
        title=req.title,
        author=req.author,
        likes=req.likes,
        play_count=req.play_count,
        is_ad=req.is_ad,
        with_shop_entry=req.with_shop_entry,
        commerce_level=req.commerce_level,
        creator_verified=req.creator_verified,
        follower_count=req.follower_count,
    )
    data = await call_claude(
        system=diagnosis_prompt.SYSTEM,
        user=user_prompt,
        max_tokens=1024,
        expect_json=True,
    )

    types = data.get("types", ["anxiety_selling"])
    risk_score = max(0, min(100, int(data.get("risk_score", 50))))

    return DiagnosisResult(
        video_id=req.video_id,
        types=types,
        types_display=[CONTENT_TYPE_ZH.get(t, t) for t in types],
        risk_score=risk_score,
        risk_level=score_to_level(risk_score),
        core_issue=data.get("core_issue", ""),
        missing_premises=data.get("missing_premises", []),
        emotional_manipulation=data.get("emotional_manipulation"),
        commercial_intent=data.get("commercial_intent"),
        needs_realtime_search=data.get("needs_realtime_search", False),
        search_query=data.get("search_query"),
    )
