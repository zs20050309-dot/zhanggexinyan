import type { VideoContent, DiagnosisResult, Question } from './types'

// 三个预置Demo案例的静态数据
// 对应 public/demo/ 目录下的完整缓存JSON

export const DEMO_CASES = [
  {
    id: 'demo_1',
    label: '焦虑贩卖型',
    title: '大三不找实习就废了',
    description: '看完这条视频，你的大三同学都开始焦虑了——但它说的对你成立吗？',
    icon: '😰',
  },
  {
    id: 'demo_2',
    label: '信息差收割型',
    title: 'image2出来设计师全失业',
    description: '这条视频说的"趋势"是真的，但影响范围说的对吗？',
    icon: '🎯',
  },
  {
    id: 'demo_3',
    label: '伪科普软广型',
    title: '医生秘密护肤法',
    description: '"医生不会告诉你的秘密"——这个账号的目的是什么？',
    icon: '🔬',
  },
]

export const CONTENT_TYPE_DESCRIPTION: Record<string, string> = {
  anxiety_selling: '通过绝对化表述和省略前提条件，制造恐惧情绪驱动决策',
  conflict_provoking: '通过绝对化群体评判和非此即彼的逻辑，利用愤怒情绪获取流量',
  info_gap_harvesting: '以真实事件为锚点，系统性夸大影响范围，利用FOMO心态收割付费',
  pseudo_science_ad: '用权威身份或科学话术包装隐性商业目的，制造信任感',
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
