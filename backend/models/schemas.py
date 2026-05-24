from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── 视频内容 ────────────────────────────────────────────────

class VideoExtractRequest(BaseModel):
    url: str

class VideoManualRequest(BaseModel):
    title: str
    text: str
    author: Optional[str] = None

class VideoContent(BaseModel):
    video_id: str
    transcript: str
    title: str
    author: str
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    play_count: Optional[int] = None
    duration_seconds: Optional[int] = None
    # CDN 解析时获取的账号元数据
    is_ad: Optional[bool] = None
    with_shop_entry: Optional[bool] = None
    commerce_level: Optional[int] = None   # 0-5
    creator_verified: Optional[str] = None  # 认证标签，如"知名健康博主"
    follower_count: Optional[int] = None
    hashtags: Optional[list[str]] = None
    source: Literal["asr", "subtitle", "manual"]


# ── 诊断结果 ────────────────────────────────────────────────

ContentType = Literal[
    "anxiety_selling",
    "conflict_provoking",
    "info_gap_harvesting",
    "pseudo_science_ad",
]

RiskLevel = Literal["low", "medium", "high", "critical"]

CONTENT_TYPE_ZH = {
    "anxiety_selling": "焦虑贩卖型",
    "conflict_provoking": "矛盾挑起型",
    "info_gap_harvesting": "信息差收割型",
    "pseudo_science_ad": "伪科普软广型",
}

class DiagnosisRequest(BaseModel):
    video_id: str
    transcript: str
    title: str
    author: str
    likes: Optional[int] = None
    play_count: Optional[int] = None
    is_ad: Optional[bool] = None
    with_shop_entry: Optional[bool] = None
    commerce_level: Optional[int] = None
    creator_verified: Optional[str] = None
    follower_count: Optional[int] = None

class DiagnosisResult(BaseModel):
    video_id: str
    types: list[ContentType]
    types_display: list[str]
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    core_issue: str
    missing_premises: list[str]
    emotional_manipulation: Optional[str] = None
    commercial_intent: Optional[str] = None
    needs_realtime_search: bool
    search_query: Optional[str] = None


# ── 问卷 ────────────────────────────────────────────────────

QuestionType = Literal["choice", "text"]

class Question(BaseModel):
    id: int
    text: str
    type: QuestionType
    options: Optional[list[str]] = None

class QAPair(BaseModel):
    question: str
    answer: str

class QuestionnaireGenerateRequest(BaseModel):
    video_id: str
    diagnosis: DiagnosisResult

class QuestionnaireGenerateResponse(BaseModel):
    questions: list[Question]
    source: Literal["ai", "fallback"] = "ai"

class QuestionnaireNextRequest(BaseModel):
    video_id: str
    diagnosis: DiagnosisResult
    conversation: list[QAPair]
    latest_answer: str

class QuestionnaireNextResponse(BaseModel):
    action: Literal["ask", "finish"]
    question: Optional[Question] = None
    finish_reason: Optional[str] = None


# ── 搜索 ────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    context: str

class SearchResult(BaseModel):
    summary: str
    sources: list[str]
    retrieved_at: str


# ── 报告 ────────────────────────────────────────────────────

class ReportGenerateRequest(BaseModel):
    video_id: str
    transcript: str
    title: str
    author: str
    diagnosis: DiagnosisResult
    answers: list[QAPair]
    search_result: Optional[SearchResult] = None

class SavedReport(BaseModel):
    report_id: str
    content: str
    video_title: str
    diagnosis_types: list[str]
    created_at: str


# ── 通用 ────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str
    code: str
    fallback_available: Optional[bool] = None
