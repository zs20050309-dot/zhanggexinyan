import type {
  VideoContent,
  DiagnosisResult,
  Question,
  QAPair,
  SearchResult,
  SavedReport,
} from './types'

// 默认走相对路径 → Next.js dev server 反代到后端（避开浏览器到 localhost:8000 的代理/TUN 拦截）
// 仅在显式部署到独立域名时设置 NEXT_PUBLIC_API_BASE_URL
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw err
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const err = await res.json()
    throw err
  }
  return res.json()
}

// ── 视频解析 ──────────────────────────────────────────────

export async function extractVideo(url: string): Promise<VideoContent> {
  return post('/api/video/extract', { url })
}

export async function manualInput(
  title: string,
  text: string,
  author?: string
): Promise<VideoContent> {
  return post('/api/video/manual', { title, text, author })
}

// ── 诊断 ──────────────────────────────────────────────────

export async function diagnose(video: VideoContent): Promise<DiagnosisResult> {
  return post('/api/diagnosis', {
    video_id: video.video_id,
    transcript: video.transcript,
    title: video.title,
    author: video.author,
    likes: video.likes,
    play_count: video.play_count,
    is_ad: video.is_ad,
    with_shop_entry: video.with_shop_entry,
    commerce_level: video.commerce_level,
    creator_verified: video.creator_verified,
    follower_count: video.follower_count,
  })
}

export async function pingVideoNetwork(): Promise<Record<string, unknown>> {
  return get('/api/video/ping')
}

// ── 实时搜索 ──────────────────────────────────────────────

export async function search(query: string, context: string): Promise<SearchResult> {
  return post('/api/search', { query, context })
}

// ── 问卷 ──────────────────────────────────────────────────

export interface QuestionnaireResult {
  questions: Question[]
  source: 'ai' | 'fallback'
}

export async function generateQuestionnaire(
  video_id: string,
  diagnosis: DiagnosisResult
): Promise<QuestionnaireResult> {
  const res = await post<{ questions: Question[]; source?: 'ai' | 'fallback' }>('/api/questionnaire/generate', {
    video_id,
    diagnosis,
  })
  return { questions: res.questions, source: res.source ?? 'ai' }
}

// ── 报告生成（SSE流式） ────────────────────────────────────

export function streamReport(
  params: {
    video_id: string
    transcript: string
    title: string
    author: string
    diagnosis: DiagnosisResult
    answers: QAPair[]
    search_result?: SearchResult | null
  },
  onChunk: (text: string) => void,
  onDone: (reportId: string) => void,
  onError: (err: Error) => void
): void {
  fetch(`${BASE_URL}/api/report/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
    .then((res) => {
      if (!res.ok || !res.body) throw new Error('报告生成请求失败')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) return
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'chunk') onChunk(data.content)
              if (data.type === 'done') onDone(data.report_id)
            } catch {
              // 忽略格式错误的chunk
            }
          }
          pump()
        })
      }
      pump()
    })
    .catch(onError)
}

// ── 获取报告（分享页） ─────────────────────────────────────

export async function getReport(reportId: string): Promise<SavedReport> {
  return get(`/api/report/${reportId}`)
}
