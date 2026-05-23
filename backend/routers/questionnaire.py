from fastapi import APIRouter
from models.schemas import (
    QuestionnaireGenerateRequest,
    QuestionnaireGenerateResponse,
    QuestionnaireNextRequest,
    QuestionnaireNextResponse,
    Question,
)
from services.ai_client import call_claude
from prompts import questionnaire as q_prompt

router = APIRouter()

# 兜底问题集，当AI生成失败时使用
FALLBACK_QUESTIONS = [
    Question(id=1, text="你现在是什么阶段？", type="choice",
             options=["在校学生", "应届毕业生", "职场1-3年", "工作3年以上"]),
    Question(id=2, text="看完这个视频，你的第一反应是什么？", type="choice",
             options=["有点担心/焦虑", "觉得有道理但不确定", "觉得有问题但说不清", "想发给别人看"]),
    Question(id=3, text="你有没有因为这个视频想要采取什么行动？（简短说明）",
             type="text", options=None),
]


@router.post("/generate")
async def generate(req: QuestionnaireGenerateRequest) -> QuestionnaireGenerateResponse:
    user_prompt = q_prompt.build_user_prompt(req.diagnosis)
    try:
        data = await call_claude(
            system=q_prompt.SYSTEM,
            user=user_prompt,
            max_tokens=1024,
            expect_json=True,
        )
        questions = [Question(**q) for q in data]
    except Exception:
        questions = FALLBACK_QUESTIONS

    return QuestionnaireGenerateResponse(questions=questions)


@router.post("/next")
async def next_question(req: QuestionnaireNextRequest) -> QuestionnaireNextResponse:
    """真动态问卷接口（加分项），按需实现"""
    # TODO: 实现真动态问卷逻辑
    return QuestionnaireNextResponse(action="finish", finish_reason="功能待实现")
