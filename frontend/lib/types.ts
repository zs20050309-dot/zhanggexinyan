// 与 backend/models/schemas.py 保持同步

export type ContentType =
  | 'anxiety_selling'
  | 'conflict_provoking'
  | 'info_gap_harvesting'
  | 'pseudo_science_ad'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type QuestionType = 'choice' | 'text'

// ── 视频内容 ──────────────────────────────────────────────

export interface VideoContent {
  video_id: string
  transcript: string
  title: string
  author: string
  likes?: number
  comments?: number
  shares?: number
  play_count?: number
  duration_seconds?: number
  // CDN 解析时获取的账号元数据
  is_ad?: boolean
  with_shop_entry?: boolean
  commerce_level?: number
  creator_verified?: string | null
  follower_count?: number
  hashtags?: string[] | null
  source: 'asr' | 'subtitle' | 'manual'
}

// ── 诊断结果 ──────────────────────────────────────────────

export interface DiagnosisResult {
  video_id: string
  types: ContentType[]
  types_display: string[]
  risk_score: number
  risk_level: RiskLevel
  core_issue: string
  missing_premises: string[]
  emotional_manipulation?: string | null
  commercial_intent?: string | null
  needs_realtime_search: boolean
  search_query?: string | null
}

// ── 问卷 ──────────────────────────────────────────────────

export interface Question {
  id: number
  text: string
  type: QuestionType
  options?: string[] | null
}

export interface QAPair {
  question: string
  answer: string
}

// ── 搜索 ──────────────────────────────────────────────────

export interface SearchResult {
  summary: string
  sources: string[]
  retrieved_at: string
}

// ── 报告 ──────────────────────────────────────────────────

export interface SavedReport {
  report_id: string
  content: string
  video_title: string
  diagnosis_types: string[]
  created_at: string
}

// ── API错误 ───────────────────────────────────────────────

export interface ApiError {
  error: string
  code: string
  fallback_available?: boolean
}

// ── 风险等级展示映射 ──────────────────────────────────────

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '极高风险',
}

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  low: 'text-green-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
  critical: 'text-purple-600',
}

export const RISK_GAUGE_COLOR: Record<RiskLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7c3aed',
}
