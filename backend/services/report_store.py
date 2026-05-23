import uuid
from datetime import datetime, timezone
from models.schemas import SavedReport

_store: dict[str, SavedReport] = {}


def save_report(content: str, video_title: str, diagnosis_types: list[str]) -> str:
    report_id = str(uuid.uuid4())[:8]
    _store[report_id] = SavedReport(
        report_id=report_id,
        content=content,
        video_title=video_title,
        diagnosis_types=diagnosis_types,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    return report_id


def get_report(report_id: str) -> SavedReport | None:
    return _store.get(report_id)
