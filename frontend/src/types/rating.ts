export interface RatingLevel {
  key: string
  name: string
  description: string
  minMs: number | null
  maxMs: number | null
  icon: string
}

export const RATING_LEVELS: RatingLevel[] = [
  { key: 'lightning', name: '闪电侠', description: '反应速度惊人！', minMs: null, maxMs: 150, icon: '⚡' },
  { key: 'master', name: '反应大师', description: '状态非常出色！', minMs: 150, maxMs: 200, icon: '🎯' },
  { key: 'excellent', name: '状态出色', description: '表现非常优秀！', minMs: 200, maxMs: 250, icon: '🌟' },
  { key: 'good', name: '表现良好', description: '继续保持！', minMs: 250, maxMs: 300, icon: '✨' },
  { key: 'normal', name: '普通水平', description: '还有提升空间。', minMs: 300, maxMs: 400, icon: '💪' },
  { key: 'needs_improvement', name: '有待提高', description: '多加练习吧！', minMs: 400, maxMs: null, icon: '📈' }
]

export function getRatingByAverage(averageMs: number | null, validCount: number): RatingLevel | null {
  if (validCount === 0 || averageMs === null) return null

  for (const level of RATING_LEVELS) {
    if (level.minMs === null) {
      if (averageMs <= level.maxMs!) {
        return level
      }
      continue
    }
    if (level.maxMs === null) {
      if (averageMs > level.minMs) {
        return level
      }
      continue
    }
    if (averageMs > level.minMs && averageMs <= level.maxMs) {
      return level
    }
  }

  return RATING_LEVELS[RATING_LEVELS.length - 1]
}
