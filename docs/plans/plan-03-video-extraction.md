# Plan 03: 视频解析与 ASR 转录

> **执行方式：** 先跑通 CDN 解析测试脚本，确认真实链接可用；再写单元测试；最后生成 Demo 缓存数据。

**Goal:** 实现从抖音视频链接到文字稿 + 元数据的完整管道。主路径：CDN 直链解析（无需登录/cookie）；降级路径：用户手动粘贴文本，确保 Demo 不依赖实时解析。

**Architecture:**
- 主路径：`routers/video.py` → `services/video_extractor.py`（移动端请求头 + iesdouyin API）→ 下载 mp4 → `services/asr.py`（Whisper）→ `VideoContent`
- 降级路径：`/api/video/manual` 直接接收标题 + 文字内容 → 返回 `VideoContent`

**Tech Stack:** httpx（已在 requirements.txt）, openai Whisper API, FastAPI TestClient, pytest

**调研结论摘要：**
- 官方 API 走不通（需 OAuth，仅支持创作者管理自己内容）
- yt-dlp 需要有效 cookie，黑客松现场太脆
- **CDN 直链解析（推荐）：** 移动端 User-Agent 请求 → 跟随短链跳转获取 aweme_id → 调用 `iesdouyin.com/web/api/v2/aweme/iteminfo/` → 获取视频 CDN 直链 + 完整元数据
- 可获取的关键元数据：点赞/播放/评论/分享数、粉丝数、是否开通小店（with_shop_entry）、商业化等级（commerce_level 0-5）、认证标签（custom_verify）、是否平台标注广告（is_ads）、话题标签

---

### Task 1：验证 CDN 解析能否获取抖音视频内容

> 这是整个 Plan 的关键验证。**在黑客松开始前，必须用真实链接跑通。**

**Files:**
- Create: `backend/scripts/test_cdn_extract.py`

- [ ] **Step 1: 创建 CDN 解析测试脚本**

创建 `backend/scripts/test_cdn_extract.py`：

```python
"""
验证 CDN 解析方案是否可用于抖音视频元数据提取。
替换 TEST_URL 为一条真实的公开抖音分享链接。
支持纯 URL 或完整分享文本（含中文文字）。
"""
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.video_extractor import (
    _extract_url_from_share_text,
    _resolve_aweme_id,
    _fetch_aweme_metadata,
)

# ⚠️ 替换为真实的抖音视频链接或分享文本
TEST_URL = "https://v.douyin.com/替换为真实链接/"


async def main():
    print(f"输入：{TEST_URL[:80]}...")

    # Step 1: 提取 URL
    url = _extract_url_from_share_text(TEST_URL)
    print(f"提取 URL：{url}")

    # Step 2: 解析 aweme_id
    aweme_id = await _resolve_aweme_id(url)
    if not aweme_id:
        print("❌ 无法提取 aweme_id，检查链接是否有效")
        sys.exit(1)
    print(f"✅ aweme_id：{aweme_id}")

    # Step 3: 获取元数据
    meta = await _fetch_aweme_metadata(aweme_id)
    if not meta:
        print("❌ API 返回空，可能已被反爬")
        sys.exit(1)

    # 打印关键元数据
    statistics = meta.get("statistics", {})
    author = meta.get("author", {})
    video_info = meta.get("video", {})
    url_list = (
        video_info.get("play_addr", {}).get("url_list", []) or
        video_info.get("download_addr", {}).get("url_list", [])
    )

    print(f"\n✅ 元数据提取成功！")
    print(f"  标题：{meta.get('desc', '未知')[:60]}")
    print(f"  作者：{author.get('nickname')}（粉丝 {author.get('follower_count', 0):,}）")
    print(f"  认证：{author.get('custom_verify') or '无'}")
    print(f"  开通小店：{author.get('with_shop_entry', False)}")
    print(f"  商业化等级：{author.get('commerce_user_level', 0)}/5")
    print(f"  是否广告：{meta.get('is_ads', False)}")
    print(f"  点赞：{statistics.get('digg_count', 0):,}")
    print(f"  播放：{statistics.get('play_count', 0):,}")
    print(f"  评论：{statistics.get('comment_count', 0):,}")
    print(f"  视频直链数量：{len(url_list)}")
    print(f"  视频直链（前50字符）：{url_list[0][:50] if url_list else '未找到'}...")

    if not url_list:
        print("\n⚠️  未找到视频直链，无法下载转录")
    else:
        print(f"\n✅ 下载直链已获取，可继续测试 ASR 转录")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 替换测试链接并运行**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
# 先把脚本中 TEST_URL 替换为真实链接，再运行
python scripts/test_cdn_extract.py
```

Expected 成功输出：
```
✅ aweme_id：7xxxxxxxxxxxxxxxxxx
✅ 元数据提取成功！
  标题：视频标题...
  作者：XXX（粉丝 X,XXX）
  视频直链数量：3
✅ 下载直链已获取，可继续测试 ASR 转录
```

- [ ] **Step 3: 如果元数据提取失败**

常见原因：
- `HTTP Error 403/404`：API endpoint 已更换 → 尝试 `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id={aweme_id}`（备用 endpoint）
- 跳转链接被拦截 → 在浏览器打开短链，手动复制最终 URL 中的数字 ID 测试
- 返回空 item_list → aweme_id 提取失败，检查跳转是否正常

- [ ] **Step 4: 测试完整流程（含 ASR 转录）**

创建 `backend/scripts/test_full_extract.py`：

```python
"""
端到端测试：CDN 解析 → 下载 → Whisper 转录
需要 OPENAI_API_KEY 配置。视频下载约 10-30 秒，转录约 5-15 秒。
"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.video_extractor import extract_video

# 替换为真实链接
TEST_URL = "https://v.douyin.com/替换为真实链接/"


async def main():
    print("开始完整解析流程...")
    result = await extract_video(TEST_URL)

    if result is None:
        print("❌ 解析失败，回退到手动输入模式")
        return

    print(f"\n✅ 解析成功！")
    print(f"  video_id：{result.video_id}")
    print(f"  标题：{result.title}")
    print(f"  作者：{result.author}")
    print(f"  点赞：{result.likes}")
    print(f"  播放：{result.play_count}")
    print(f"  with_shop_entry：{result.with_shop_entry}")
    print(f"  commerce_level：{result.commerce_level}")
    print(f"  creator_verified：{result.creator_verified}")
    print(f"\n  转录（前200字）：")
    print(f"  {result.transcript[:200]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

```bash
python scripts/test_full_extract.py
```

Expected: 打印出视频元数据 + 前200字转录内容。

- [ ] **Step 5: 记录结论**

在这里记录实测结果：
- CDN 解析是否可用：[ ] 是 / [ ] 否
- 能获取到的元数据字段：（记录实际可用字段）
- 视频直链是否可下载：[ ] 是 / [ ] 否
- 转录质量：（记录实测效果）

如果 CDN 解析**完全不可用**，记录失败原因，后续 Demo 完全走缓存，extract 路由只需返回 422 即可。

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/test_cdn_extract.py backend/scripts/test_full_extract.py
git commit -m "test: add CDN parsing validation scripts for Douyin"
```

---

### Task 2：ASR 转录服务测试

**Files:**
- Create: `backend/tests/test_asr.py`
- Verify: `backend/services/asr.py`（已存在）

- [ ] **Step 1: 写 ASR 服务 mock 测试**

创建 `backend/tests/test_asr.py`：

```python
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.mark.asyncio
async def test_transcribe_returns_text():
    """transcribe 应返回字符串格式的转录结果"""
    mock_result = MagicMock()
    mock_result.text = "这是视频的转录内容"

    with patch("services.asr.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            result = await transcribe("/tmp/fake_audio.mp4")

    assert result == "这是视频的转录内容"
    assert isinstance(result, str)


@pytest.mark.asyncio
async def test_transcribe_uses_chinese_language():
    """transcribe 应使用 zh 语言参数"""
    mock_result = MagicMock()
    mock_result.text = "中文内容"

    with patch("services.asr.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_result)
        mock_get_client.return_value = mock_client

        from services.asr import transcribe
        with patch("builtins.open", MagicMock()):
            await transcribe("/tmp/test.mp4")

    call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
    assert call_kwargs.get("language") == "zh"
```

- [ ] **Step 2: 运行并修复**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
pytest tests/test_asr.py -v
```

Expected:
```
PASSED tests/test_asr.py::test_transcribe_returns_text
PASSED tests/test_asr.py::test_transcribe_uses_chinese_language
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_asr.py
git commit -m "test: add ASR unit tests"
```

---

### Task 3：视频路由测试（含手动输入降级）

**Files:**
- Create: `backend/tests/test_video_router.py`
- Verify: `backend/routers/video.py`（已存在）

- [ ] **Step 1: 写视频路由测试**

创建 `backend/tests/test_video_router.py`：

```python
import pytest
from unittest.mock import patch, AsyncMock
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_manual_input_returns_video_content(client):
    """手动输入路由应返回完整的 VideoContent"""
    response = client.post("/api/video/manual", json={
        "title": "大三不找实习就废了",
        "text": "你都大三了还不找实习，基本上和毕业即失业没区别。现在私信我。",
        "author": "职场导师",
    })

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "大三不找实习就废了"
    assert data["transcript"] == "你都大三了还不找实习，基本上和毕业即失业没区别。现在私信我。"
    assert data["author"] == "职场导师"
    assert data["source"] == "manual"
    assert "video_id" in data
    assert len(data["video_id"]) > 0


def test_manual_input_without_author_uses_default(client):
    """不提供 author 时应使用默认值"""
    response = client.post("/api/video/manual", json={
        "title": "标题",
        "text": "内容",
    })

    assert response.status_code == 200
    data = response.json()
    assert data["author"] == "未知账号"
    assert data["source"] == "manual"


def test_manual_input_generates_unique_video_ids(client):
    """每次调用应生成唯一的 video_id"""
    response1 = client.post("/api/video/manual", json={"title": "t", "text": "c"})
    response2 = client.post("/api/video/manual", json={"title": "t", "text": "c"})
    assert response1.json()["video_id"] != response2.json()["video_id"]


def test_extract_returns_fallback_when_extraction_fails(client):
    """CDN 解析失败时应返回 422 和降级提示"""
    with patch("routers.video.extract_video", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = None  # 模拟解析失败

        response = client.post("/api/video/extract", json={
            "url": "https://v.douyin.com/invalid-url"
        })

    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "EXTRACT_FAILED"
    assert data["fallback_available"] is True
    assert "手动粘贴" in data["error"]


def test_extract_returns_video_content_when_successful(client):
    """CDN 解析成功时应返回完整 VideoContent（含元数据字段）"""
    from models.schemas import VideoContent

    mock_video = VideoContent(
        video_id="7000000000000000001",
        transcript="视频转录内容",
        title="测试视频标题",
        author="测试账号",
        likes=50000,
        play_count=300000,
        follower_count=80000,
        with_shop_entry=True,
        commerce_level=3,
        creator_verified="知名博主",
        source="asr",
    )

    with patch("routers.video.extract_video", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_video

        response = client.post("/api/video/extract", json={
            "url": "https://v.douyin.com/valid-url"
        })

    assert response.status_code == 200
    data = response.json()
    assert data["video_id"] == "7000000000000000001"
    assert data["play_count"] == 300000
    assert data["with_shop_entry"] is True
    assert data["creator_verified"] == "知名博主"
```

- [ ] **Step 2: 运行测试**

```bash
pytest tests/test_video_router.py -v
```

- [ ] **Step 3: 修复 routers/video.py（如有问题）**

检查 video router 是否兼容新的 VideoContent 字段（不需要改动，Pydantic 自动序列化所有字段）。

- [ ] **Step 4: 确认所有测试通过**

```bash
pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_video_router.py
git commit -m "test: add video router tests covering CDN extract and manual input"
```

---

### Task 4：准备三个 Demo 案例的缓存数据

> Demo 案例完全不依赖实时 API，用静态 JSON 在前端展示。无论 CDN 解析是否可用，Demo 路径都必须正常工作。

**Files:**
- Create: `frontend/public/demo/demo_1.json`
- Create: `frontend/public/demo/demo_2.json`
- Create: `frontend/public/demo/demo_3.json`

- [ ] **Step 1: 创建 Demo 1（焦虑贩卖型）**

创建 `frontend/public/demo/demo_1.json`：

```json
{
  "videoContent": {
    "video_id": "demo_1",
    "transcript": "现在这个就业环境，你都大三了还没找实习，基本上和毕业即失业没区别。你知道你的竞争对手是谁吗？985院校的同学大一就开始实习了。不要觉得大三还早，等你大四再投简历，HR一看你这段空白期直接pass掉。现在私信我，我告诉你怎么在三个月内逆袭。",
    "title": "大三了还没实习？你已经输了",
    "author": "职场导师小明",
    "likes": 120000,
    "play_count": 680000,
    "follower_count": 320000,
    "with_shop_entry": true,
    "commerce_level": 3,
    "creator_verified": null,
    "is_ad": false,
    "source": "asr"
  },
  "diagnosis": {
    "video_id": "demo_1",
    "types": ["anxiety_selling"],
    "types_display": ["焦虑贩卖型"],
    "risk_score": 82,
    "risk_level": "high",
    "core_issue": "视频用'大三'这个时间节点制造了普遍性焦虑，但完全没说明这个结论成立需要哪些前提",
    "missing_premises": [
      "专业方向（理工科/文科/艺术的实习节奏完全不同）",
      "个人规划（考研/就业/出国路径不同）",
      "已有经验积累情况"
    ],
    "emotional_manipulation": "反复使用'输了''空白期''来不及'等绝对化词汇强化焦虑",
    "commercial_intent": "以'私信我'引导付费咨询或课程购买",
    "needs_realtime_search": false,
    "search_query": null
  },
  "questions": [
    {
      "id": 1,
      "text": "你现在是什么学历阶段？",
      "type": "choice",
      "options": ["大一大二", "大三大四", "研究生", "已工作"]
    },
    {
      "id": 2,
      "text": "你的目标方向是？",
      "type": "choice",
      "options": ["直接就业", "考研/出国", "创业/自由职业", "还没想好"]
    },
    {
      "id": 3,
      "text": "你目前有实习或相关项目经验吗？",
      "type": "choice",
      "options": ["有，比较丰富", "有，但不多", "在找中还没有", "完全没有"]
    },
    {
      "id": 4,
      "text": "看完这个视频，你当时第一反应是什么？（简短描述）",
      "type": "text",
      "options": null
    }
  ]
}
```

- [ ] **Step 2: 创建 Demo 2（信息差收割 + 焦虑贩卖，极高风险）**

创建 `frontend/public/demo/demo_2.json`：

```json
{
  "videoContent": {
    "video_id": "demo_2",
    "transcript": "image2一出来，我就知道，设计师的时代结束了。现在客户直接用AI生成图片，不需要设计师了。我认识的一个设计师朋友，上个月直接被公司裁了，就是因为AI。趋势来了你挡不住，现在还不学AI提示词技巧就来不及了。我这里有个课程帮你3个月完成转型，只要699。",
    "title": "AI绘画已经让设计师失业，赶紧转型",
    "author": "AI技能培训",
    "likes": 85000,
    "play_count": 430000,
    "follower_count": 156000,
    "with_shop_entry": true,
    "commerce_level": 4,
    "creator_verified": null,
    "is_ad": false,
    "source": "asr"
  },
  "diagnosis": {
    "video_id": "demo_2",
    "types": ["info_gap_harvesting", "anxiety_selling"],
    "types_display": ["信息差收割型", "焦虑贩卖型"],
    "risk_score": 88,
    "risk_level": "critical",
    "core_issue": "视频以image2发布为真实锚点，但将对特定岗位的影响夸大成了对所有设计师的全面冲击",
    "missing_premises": [
      "受影响的设计类型（批量执行类 vs 创意类差异巨大）",
      "视频声称的'全面失业'时效性是否成立",
      "699元课程能否真正解决转型问题"
    ],
    "emotional_manipulation": "用'时代结束了''来不及了'制造紧迫感，FOMO心态驱动付费",
    "commercial_intent": "直接推销699元AI转型课程（账号商业化等级4/5，开通小店）",
    "needs_realtime_search": true,
    "search_query": "image2 AI设计师失业影响范围 2025"
  },
  "questions": [
    {
      "id": 1,
      "text": "你目前从事或正在学习设计相关工作吗？",
      "type": "choice",
      "options": ["是，专职设计师", "是，学设计的学生", "设计是副业/爱好", "不是，只是感兴趣"]
    },
    {
      "id": 2,
      "text": "你的设计工作更偏向哪类？",
      "type": "choice",
      "options": ["品牌创意/策略", "UI/交互设计", "批量执行（电商图/广告图）", "插画/概念设计"]
    },
    {
      "id": 3,
      "text": "你现在有用 AI 工具辅助设计吗？",
      "type": "choice",
      "options": ["经常用", "偶尔试过", "想用但还没开始", "完全没用过"]
    },
    {
      "id": 4,
      "text": "看完视频，你有没有想过报那个699的课？",
      "type": "choice",
      "options": ["有，正在考虑", "有过念头但犹豫", "没有，但有点焦虑", "完全没有"]
    }
  ]
}
```

- [ ] **Step 3: 创建 Demo 3（伪科普软广型）**

创建 `frontend/public/demo/demo_3.json`：

```json
{
  "videoContent": {
    "video_id": "demo_3",
    "transcript": "医生不会告诉你的护肤秘密——其实大部分护肤品都是智商税！皮肤科主任私下跟我说，99%的人都用错了护肤品，真正有效的只有这三种成分。很多明星皮肤好，不是因为用贵的，而是用对的。我整理了一份内部清单，关注后私信'护肤'免费领取，另外我们有一款成分党都在用的精华，用了三个月皮肤真的不一样了。",
    "title": "医生不会告诉你的护肤秘密",
    "author": "皮肤科内部人士",
    "likes": 45000,
    "play_count": 210000,
    "follower_count": 89000,
    "with_shop_entry": true,
    "commerce_level": 3,
    "creator_verified": null,
    "is_ad": false,
    "source": "asr"
  },
  "diagnosis": {
    "video_id": "demo_3",
    "types": ["pseudo_science_ad"],
    "types_display": ["伪科普软广型"],
    "risk_score": 79,
    "risk_level": "high",
    "core_issue": "视频声称引用了'皮肤科主任'的内部信息，但无法核实来源，后半段直接推荐购买产品",
    "missing_premises": [
      "'皮肤科主任'是谁？无法核实",
      "'99%的人用错'这个数据来自哪里？",
      "推荐的'三种成分'是否有研究支持？"
    ],
    "emotional_manipulation": "用'内部秘密''医生不会告诉你'制造神秘感和信任感",
    "commercial_intent": "通过'私信领取清单'引流，推销自有精华产品（账号已开通小店）",
    "needs_realtime_search": false,
    "search_query": null
  },
  "questions": [
    {
      "id": 1,
      "text": "你目前对护肤的关注程度如何？",
      "type": "choice",
      "options": ["护肤重度爱好者", "有基础护肤习惯", "随便用用", "完全不关注"]
    },
    {
      "id": 2,
      "text": "看完这个视频，你有没有想私信领取那个'清单'？",
      "type": "choice",
      "options": ["已经私信了", "想但还没有", "犹豫中", "没有兴趣"]
    },
    {
      "id": 3,
      "text": "你对'皮肤科主任推荐'这个说法的第一反应是？",
      "type": "choice",
      "options": ["觉得很可信", "有点半信半疑", "感觉是营销话术", "完全不信"]
    }
  ]
}
```

- [ ] **Step 4: 确认文件可被前端读取**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/frontend
# 确认文件已在 public 目录下
ls public/demo/
```

Expected: `demo_1.json  demo_2.json  demo_3.json`

- [ ] **Step 5: Commit**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon
git add frontend/public/demo/ backend/scripts/
git commit -m "feat: add CDN extract scripts and cached demo case data"
```

---

**Plan 03 完成标准：**
- [ ] CDN 解析脚本在至少一条真实抖音链接上成功获取元数据
- [ ] 记录了 CDN 解析可用性结论（可用/不可用/部分可用）
- [ ] `pytest tests/test_asr.py -v` 全部通过
- [ ] `pytest tests/test_video_router.py -v` 全部通过
- [ ] 三个 Demo JSON 文件存在于 `frontend/public/demo/`，含完整元数据字段
- [ ] `pytest tests/ -v` 全部通过
