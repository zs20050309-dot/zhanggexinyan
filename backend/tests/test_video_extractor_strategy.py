"""
策略测试：直连优先 + API 兜底

测试目标：
1. _resolve_aweme_id 应先试直连，失败再走镜像 API
2. _fetch_aweme_metadata 应先试直连 iesdouyin，失败再走 xingzhige
3. 直连失败有进程内短路（_direct_unavailable）避免重复浪费
"""
import pytest
from unittest.mock import AsyncMock, patch
import services.video_extractor as ve
from services.video_extractor import _resolve_aweme_id, _fetch_aweme_metadata


# ─── 测试前重置全局短路标记 + 强制 auto 模式 ─────────────────
# 这些测试断言"直连失败 → 走 fallback API"行为，要求 DOUYIN_NETWORK_MODE=auto。
# 用户 .env 可能设了 direct/fallback_only，会绕过 fallback 让测试跪。
@pytest.fixture(autouse=True)
def reset_direct_cache(monkeypatch):
    monkeypatch.setenv("DOUYIN_NETWORK_MODE", "auto")
    monkeypatch.delenv("DOUYIN_ALWAYS_PROBE_DIRECT", raising=False)
    ve._direct_unavailable = False
    ve._working_proxy = False
    yield
    ve._direct_unavailable = False
    ve._working_proxy = False


# ─── _resolve_aweme_id 策略 ────────────────────────────────

async def test_resolve_aweme_id_uses_direct_first_when_succeeds():
    """直连成功 → 镜像 API 不被调用"""
    with patch(
        "services.video_extractor._resolve_aweme_id_direct",
        new_callable=AsyncMock,
        return_value="7641252398422352293",
    ) as mock_direct, patch(
        "services.video_extractor._resolve_aweme_id_mirror",
        new_callable=AsyncMock,
    ) as mock_mirror:
        result = await _resolve_aweme_id("https://v.douyin.com/abc/")

    assert result == "7641252398422352293"
    mock_direct.assert_called_once()
    mock_mirror.assert_not_called()


async def test_resolve_aweme_id_falls_back_to_mirror_when_direct_fails():
    """直连失败 → 镜像 API 兜底成功"""
    with patch(
        "services.video_extractor._resolve_aweme_id_direct",
        new_callable=AsyncMock,
        return_value=None,
    ) as mock_direct, patch(
        "services.video_extractor._resolve_aweme_id_mirror",
        new_callable=AsyncMock,
        return_value="7641252398422352293",
    ) as mock_mirror:
        result = await _resolve_aweme_id("https://v.douyin.com/abc/")

    assert result == "7641252398422352293"
    mock_direct.assert_called_once()
    mock_mirror.assert_called_once()


async def test_resolve_aweme_id_returns_none_when_all_paths_fail():
    """直连 + 镜像都失败 → 返回 None"""
    with patch(
        "services.video_extractor._resolve_aweme_id_direct",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "services.video_extractor._resolve_aweme_id_mirror",
        new_callable=AsyncMock,
        return_value=None,
    ):
        result = await _resolve_aweme_id("https://v.douyin.com/bad/")

    assert result is None


async def test_resolve_aweme_id_short_circuits_after_direct_failure():
    """首次直连失败 → 设置 _direct_unavailable → 后续调用应跳过直连"""
    with patch(
        "services.video_extractor._resolve_aweme_id_direct",
        new_callable=AsyncMock,
        return_value=None,
    ) as mock_direct, patch(
        "services.video_extractor._resolve_aweme_id_mirror",
        new_callable=AsyncMock,
        return_value="7641252398422352293",
    ):
        # 首次调用：直连试一次失败 + 设置短路标记
        await _resolve_aweme_id("https://v.douyin.com/first/")
        assert mock_direct.call_count == 1
        assert ve._direct_unavailable is True

        # 第二次调用：直连应被跳过
        mock_direct.reset_mock()
        await _resolve_aweme_id("https://v.douyin.com/second/")
        mock_direct.assert_not_called()


async def test_resolve_aweme_id_url_with_embedded_id_skips_network():
    """长链已含 aweme_id → 直接 regex 提取，不走任何网络"""
    with patch(
        "services.video_extractor._resolve_aweme_id_direct",
        new_callable=AsyncMock,
    ) as mock_direct, patch(
        "services.video_extractor._resolve_aweme_id_mirror",
        new_callable=AsyncMock,
    ) as mock_mirror:
        result = await _resolve_aweme_id(
            "https://www.douyin.com/video/7123456789012345678"
        )

    assert result == "7123456789012345678"
    mock_direct.assert_not_called()
    mock_mirror.assert_not_called()


# ─── _fetch_aweme_metadata 策略 ────────────────────────────

async def test_fetch_metadata_uses_direct_iesdouyin_first_when_succeeds():
    """直连 iteminfo 成功 → 备用聚合 API 不应被调用"""
    fake_meta = {"aweme_id": "123", "desc": "from direct", "author": {"nickname": "x"}}
    with patch(
        "services.video_extractor._fetch_aweme_metadata_api",
        new_callable=AsyncMock,
        return_value=fake_meta,
    ) as mock_api, patch(
        "services.video_extractor._fetch_aweme_metadata_fallback",
        new_callable=AsyncMock,
    ) as mock_fallback:
        result = await _fetch_aweme_metadata("123", "https://v.douyin.com/abc/")

    assert result == fake_meta
    mock_api.assert_called_once()
    mock_fallback.assert_not_called()


async def test_fetch_metadata_falls_back_to_share_page_then_xingzhige():
    """直连 iteminfo + 分享页都失败 → 走 xingzhige 备用"""
    fake_meta = {"aweme_id": "123", "desc": "from fallback", "author": {"nickname": "y"}}
    with patch(
        "services.video_extractor._fetch_aweme_metadata_api",
        new_callable=AsyncMock,
        return_value=None,
    ) as mock_api, patch(
        "services.video_extractor._fetch_aweme_metadata_share_page",
        new_callable=AsyncMock,
        return_value=None,
    ) as mock_share, patch(
        "services.video_extractor._fetch_aweme_metadata_fallback",
        new_callable=AsyncMock,
        return_value=fake_meta,
    ) as mock_fallback:
        result = await _fetch_aweme_metadata("123", "https://v.douyin.com/abc/")

    assert result == fake_meta
    mock_api.assert_called_once()
    mock_share.assert_called_once()
    mock_fallback.assert_called_once()


async def test_fetch_metadata_returns_none_when_all_paths_fail():
    """所有路径都失败 → None"""
    with patch(
        "services.video_extractor._fetch_aweme_metadata_api",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "services.video_extractor._fetch_aweme_metadata_share_page",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "services.video_extractor._fetch_aweme_metadata_fallback",
        new_callable=AsyncMock,
        return_value=None,
    ):
        result = await _fetch_aweme_metadata("123", "https://v.douyin.com/bad/")

    assert result is None


async def test_fetch_metadata_without_source_url_skips_fallback():
    """无 source_url 时（理论上不该出现，但稳健起见）应不调用备用 API"""
    with patch(
        "services.video_extractor._fetch_aweme_metadata_api",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "services.video_extractor._fetch_aweme_metadata_share_page",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "services.video_extractor._fetch_aweme_metadata_fallback",
        new_callable=AsyncMock,
    ) as mock_fallback:
        result = await _fetch_aweme_metadata("123", source_url=None)

    assert result is None
    mock_fallback.assert_not_called()
