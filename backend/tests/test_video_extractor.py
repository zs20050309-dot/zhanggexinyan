import pytest

from services.video_extractor import (
    _extract_aweme_id_from_url,
    _extract_url_from_share_text,
    parse_share_page_html,
)

SAMPLE_HTML = """
<html><head></head><body>
<script>
window.__data = {
  "desc": "太震惊了！正视女性生存艰难的铁证和成因。女性车祸受伤可能性比男性高71%。\\n#好书分享 #女性安全",
  "nickname": "芳菲悦读📖",
  "digg_count": 60,
  "comment_count": 9,
  "share_count": 19,
  "play_count": 0,
  "duration": 18,
  "aweme_type": 2,
  "custom_verify": "",
  "with_shop_entry": false,
  "commerce_user_level": 0,
  "is_ads": false
}
</script>
</body></html>
"""


def test_extract_url_from_share_text():
    share = (
        "8.25 复制打开抖音 https://v.douyin.com/EVF_YHF2uB0/ 04/22"
    )
    assert _extract_url_from_share_text(share) == "https://v.douyin.com/EVF_YHF2uB0/"


def test_extract_aweme_id_from_note_url():
    url = "https://www.iesdouyin.com/share/note/7455314713858018611/?from_ssr=1"
    assert _extract_aweme_id_from_url(url) == "7455314713858018611"


def test_extract_aweme_id_from_video_url():
    url = "https://www.douyin.com/video/7123456789012345678"
    assert _extract_aweme_id_from_url(url) == "7123456789012345678"


def test_parse_share_page_html_note_post():
    parsed = parse_share_page_html(SAMPLE_HTML, "7455314713858018611")
    assert parsed is not None
    assert parsed["video_id"] == "7455314713858018611"
    assert "女性生存艰难" in parsed["transcript"]
    assert parsed["author"] == "芳菲悦读📖"
    assert parsed["likes"] == 60
    assert parsed["comments"] == 9
    assert parsed["source"] == "subtitle"
    assert parsed["aweme_type"] == 2


def test_parse_share_page_html_returns_none_without_content():
    assert parse_share_page_html("<html></html>", "123") is None
