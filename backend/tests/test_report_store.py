import importlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _fresh_store():
    import services.report_store as store
    importlib.reload(store)
    return store


def test_save_report_returns_string_id():
    store = _fresh_store()
    report_id = store.save_report(
        content="## 测试报告", video_title="测试视频", diagnosis_types=["anxiety_selling"]
    )
    assert isinstance(report_id, str)
    assert len(report_id) > 0


def test_save_report_id_is_short():
    store = _fresh_store()
    report_id = store.save_report(
        content="## 报告", video_title="标题", diagnosis_types=["conflict_provoking"]
    )
    assert len(report_id) <= 12


def test_get_report_returns_saved_content():
    store = _fresh_store()
    report_id = store.save_report(
        content="## 这是报告内容",
        video_title="视频标题",
        diagnosis_types=["info_gap_harvesting"],
    )
    result = store.get_report(report_id)
    assert result is not None
    assert result.content == "## 这是报告内容"
    assert result.video_title == "视频标题"
    assert result.diagnosis_types == ["info_gap_harvesting"]
    assert result.report_id == report_id


def test_get_report_returns_none_for_unknown_id():
    store = _fresh_store()
    result = store.get_report("nonexistent-id-99999")
    assert result is None


def test_each_save_generates_unique_id():
    store = _fresh_store()
    ids = [
        store.save_report(content=f"报告{i}", video_title="标题", diagnosis_types=["pseudo_science_ad"])
        for i in range(10)
    ]
    assert len(set(ids)) == 10
