import { articles } from './articles'
import type { Article } from './types'

export interface LearningPath {
  id: string
  title: string
  description: string
  icon: string
  color: string
  articleIds: string[]
}

const valid = articles.filter(
  (a): a is Article => a != null && typeof a === 'object' && 'id' in a,
)

const diffOrder: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }

const byDifficulty = (a: Article, b: Article) =>
  (diffOrder[a.difficulty] ?? 99) - (diffOrder[b.difficulty] ?? 99)

const byCategorySequence = (seq: string[]) => (a: Article, b: Article) => {
  const ai = seq.indexOf(a.category)
  const bi = seq.indexOf(b.category)
  return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
}

// Beginner reading order — broad foundations first, then financial statements,
// then valuation, then risk and portfolio thinking.
const beginnerSequence = [
  'fundamental-analysis',
  'income-statement',
  'balance-sheet',
  'cash-flow',
  'valuation-methods',
  'investment-strategies',
  'risk-portfolio',
  'portfolio-design',
  'market-structure',
  'faqs',
]

export const paths: LearningPath[] = [
  {
    id: 'first-30-days',
    title: 'Your First 30 Days',
    description: 'A guided beginner sequence covering the essentials every new investor needs — what stocks are, how to read financials, basic valuation, and how to think about risk.',
    icon: '🌱',
    color: '#10b981',
    articleIds: valid
      .filter((a) => a.difficulty === 'beginner' && beginnerSequence.includes(a.category))
      .sort((a, b) => {
        const c = byCategorySequence(beginnerSequence)(a, b)
        return c !== 0 ? c : a.title.localeCompare(b.title)
      })
      .slice(0, 30)
      .map((a) => a.id),
  },
  {
    id: 'master-fundamental',
    title: 'Master Fundamental Analysis',
    description: 'From "what is a P/E ratio" through DuPont decomposition and earnings-quality red flags. Read company financials like a pro.',
    icon: '📊',
    color: '#4e8cff',
    articleIds: valid
      .filter((a) =>
        ['fundamental-analysis', 'deep-fundamental-analysis'].includes(a.category),
      )
      .sort(byDifficulty)
      .map((a) => a.id),
  },
  {
    id: 'options-track',
    title: 'Options 101 → 401',
    description: 'Beginner-friendly options theory through the Greeks and advanced multi-leg strategies. A complete options curriculum.',
    icon: '📜',
    color: '#f97316',
    articleIds: valid
      .filter((a) => a.category === 'options-derivatives')
      .sort(byDifficulty)
      .map((a) => a.id),
  },
  {
    id: 'value-investing',
    title: 'Value Investing',
    description: 'The discipline of buying businesses below their intrinsic worth — Graham, Buffett, and modern value methodology.',
    icon: '🎯',
    color: '#ff6b6b',
    articleIds: valid
      .filter((a) =>
        ['valuation-methods', 'finding-undervalued', 'advanced-valuation', 'investment-strategies'].includes(a.category),
      )
      .sort(byDifficulty)
      .map((a) => a.id),
  },
  {
    id: 'portfolio-construction',
    title: 'Portfolio Construction',
    description: 'Build a robust portfolio using diversification, position sizing, factor tilts, and risk control.',
    icon: '🗂️',
    color: '#6366f1',
    articleIds: valid
      .filter((a) =>
        ['portfolio-design', 'risk-portfolio', 'advanced-diversification', 'factor-investing'].includes(a.category),
      )
      .sort(byDifficulty)
      .map((a) => a.id),
  },
]

export function getPathById(id: string): LearningPath | undefined {
  return paths.find((p) => p.id === id)
}
