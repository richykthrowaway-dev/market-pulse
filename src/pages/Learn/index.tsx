import { useState, useMemo, useEffect, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { categories } from './data/categories'
import { articles, getArticleById, getArticlesByCategory } from './data/articles'
import { paths, type LearningPath } from './data/paths'
import type { Article, Category, ContentBlock } from './data/types'
import {
  GraduationCap, Search, X, ArrowLeft, ArrowRight, BookOpen,
  CheckCircle2, Clock, BookMarked, ChevronDown, Play,
} from 'lucide-react'

// ── Error boundary ──────────────────────────────────────────────────────────
class LearnErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[Learn]', e, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center">
          <p className="text-red-400 font-medium mb-2">Something went wrong</p>
          <p className="text-xs text-surface-500 mb-4">{this.state.error}</p>
          <button onClick={() => this.setState({ error: null })} className="text-xs text-accent hover:underline">Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── localStorage helpers ────────────────────────────────────────────────────
function useLearnState() {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('learn-read') || '[]') as string[]) }
    catch { return new Set<string>() }
  })
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('learn-bookmarks') || '[]') as string[]) }
    catch { return new Set<string>() }
  })
  const [lastRead, setLastRead] = useState<{ id: string; ts: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem('learn-lastread') || 'null') }
    catch { return null }
  })
  const markRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev); next.add(id)
      localStorage.setItem('learn-read', JSON.stringify([...next])); return next
    })
    const last = { id, ts: Date.now() }
    setLastRead(last)
    localStorage.setItem('learn-lastread', JSON.stringify(last))
  }
  const toggleBookmark = (id: string) => setBookmarkIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    localStorage.setItem('learn-bookmarks', JSON.stringify([...next])); return next
  })
  return { readIds, bookmarkIds, lastRead, markRead, toggleBookmark }
}

// ── Difficulty badge ────────────────────────────────────────────────────────
const diffStyle: Record<string, string> = {
  beginner:     'bg-emerald-500/15 text-emerald-400',
  intermediate: 'bg-amber-500/15 text-amber-400',
  advanced:     'bg-red-500/15 text-red-400',
}
function DiffBadge({ d }: { d: 'beginner' | 'intermediate' | 'advanced' }) {
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide', diffStyle[d])}>{d}</span>
}

// ── Block renderer ──────────────────────────────────────────────────────────
function BlockRenderer({
  block, articleId, quizStates, setQuizState,
}: {
  block: ContentBlock
  articleId: string
  quizStates: Record<string, number | null>
  setQuizState: (key: string, idx: number) => void
}) {
  try {
    if (block.type === 'paragraph') {
      return <p className="text-sm text-surface-300 leading-relaxed">{block.text}</p>
    }
    if (block.type === 'heading') {
      const Tag = block.level === 2 ? 'h2' : 'h3' as const
      const id = block.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return <Tag id={id} className={cn('font-semibold text-surface-100', block.level === 2 ? 'text-base mt-6 mb-2' : 'text-sm mt-4 mb-1')}>{block.text}</Tag>
    }
    if (block.type === 'formula') {
      return (
        <div className="rounded-lg border border-surface-600/50 bg-surface-800/80 p-4 my-2">
          <code className="text-sm font-mono text-accent block mb-3">{block.formula}</code>
          <div className="space-y-1.5">
            {(block.variables || []).map((v, vi) => (
              <div key={vi} className="flex gap-2 text-xs">
                <span className="font-mono text-surface-300 shrink-0 w-32">{v.symbol}</span>
                <span className="text-surface-400">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (block.type === 'example') {
      return (
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 my-2">
          <div className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1">Example · {block.company}</div>
          <p className="text-sm text-surface-300 leading-relaxed mb-2">{block.scenario}</p>
          {block.numbers && Object.keys(block.numbers).length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {Object.entries(block.numbers).map(([k, v], ni) => (
                <div key={ni} className="bg-surface-800/60 rounded px-2 py-1">
                  <div className="text-[9px] text-surface-500 uppercase">{k}</div>
                  <div className="text-xs font-semibold text-surface-200">{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (block.type === 'callout') {
      const styles = {
        tip:     'border-emerald-500/30 bg-emerald-500/5',
        warning: 'border-amber-500/30 bg-amber-500/5',
        info:    'border-blue-500/30 bg-blue-500/5',
      }
      const titleStyles = { tip: 'text-emerald-400', warning: 'text-amber-400', info: 'text-blue-400' }
      return (
        <div className={cn('rounded-lg border p-4 my-2', styles[block.variant] || styles.info)}>
          <div className={cn('text-xs font-semibold mb-1', titleStyles[block.variant] || titleStyles.info)}>{block.title}</div>
          <p className="text-xs text-surface-300 leading-relaxed">{block.text}</p>
        </div>
      )
    }
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul' as const
      return (
        <Tag className={cn('space-y-1.5 my-2 pl-4 text-sm text-surface-300', block.ordered ? 'list-decimal' : 'list-disc')}>
          {(block.items || []).map((item, i) => <li key={i} className="leading-relaxed">{item}</li>)}
        </Tag>
      )
    }
    if (block.type === 'keyPoints') {
      return (
        <div className="rounded-lg border border-surface-600/50 bg-surface-800/60 p-4 my-2">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Key Points</div>
          <ul className="space-y-2">
            {(block.points || []).map((pt, i) => (
              <li key={i} className="flex gap-2 text-sm text-surface-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    if (block.type === 'quiz') {
      const key = `${articleId}-quiz-${block.question.slice(0, 20)}`
      const selected = quizStates[key] ?? null
      return (
        <div className="rounded-lg border border-surface-600/50 bg-surface-800/60 p-4 my-2">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Knowledge Check</div>
          <p className="text-sm text-surface-200 font-medium mb-3">{block.question}</p>
          <div className="space-y-2">
            {(block.options || []).map((opt, i) => {
              const isSelected = selected === i
              const isCorrect  = i === block.correctIndex
              const showResult = selected !== null
              return (
                <button
                  key={i}
                  onClick={() => { if (selected === null) setQuizState(key, i) }}
                  className={cn(
                    'w-full text-left text-xs px-3 py-2.5 rounded-lg border transition-colors',
                    !showResult && 'border-surface-600/50 text-surface-300 hover:border-accent/40 hover:text-surface-100',
                    showResult && isCorrect && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                    showResult && isSelected && !isCorrect && 'border-red-500/40 bg-red-500/10 text-red-300',
                    showResult && !isSelected && !isCorrect && 'border-surface-700/50 text-surface-500',
                  )}
                >
                  <span className="font-mono mr-2 text-[10px]">{String.fromCharCode(65 + i)}</span>{opt}
                </button>
              )
            })}
          </div>
          {selected !== null && (
            <div className={cn('mt-3 text-xs p-3 rounded-lg', selected === block.correctIndex ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')}>
              <span className="font-semibold mr-1">{selected === block.correctIndex ? '✓ Correct!' : '✗ Incorrect.'}</span>
              {block.explanation}
            </div>
          )}
        </div>
      )
    }
  } catch {
    // silently skip malformed blocks
  }
  return null
}

// ── Article card ────────────────────────────────────────────────────────────
function ArticleCard({ article, cat, isRead, onSelect }: {
  article: Article
  cat: Category | undefined
  isRead: boolean
  onSelect: (a: Article) => void
}) {
  return (
    <button
      onClick={() => onSelect(article)}
      className="flex items-start gap-3 p-3 rounded-xl border border-surface-600/50 bg-surface-800/80 hover:border-surface-500/60 hover:bg-surface-800 transition-all text-left group w-full"
      style={{ borderLeftColor: cat?.color ?? '#666', borderLeftWidth: '3px' }}
    >
      <span className="text-xl shrink-0 mt-0.5">{article.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <DiffBadge d={article.difficulty} />
          <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />{article.readTime}
          </span>
          {isRead && (
            <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-0.5 shrink-0">
              <CheckCircle2 className="w-2.5 h-2.5" />Read
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-surface-100 group-hover:text-white transition-colors leading-snug mb-0.5">{article.title}</div>
        <p className="text-[11px] text-surface-400 line-clamp-2 leading-relaxed">{article.description}</p>
      </div>
    </button>
  )
}

// ── Article detail view ─────────────────────────────────────────────────────
function ArticleView({ article, onBack, onSelectArticle, readIds, bookmarkIds, markRead, toggleBookmark, activePath }: {
  article: Article
  onBack: () => void
  onSelectArticle: (a: Article) => void
  readIds: Set<string>
  bookmarkIds: Set<string>
  markRead: (id: string) => void
  toggleBookmark: (id: string) => void
  activePath?: LearningPath | null
}) {
  const cat = categories.find((c) => c.id === article.category)
  const [quizStates, setQuizStates] = useState<Record<string, number | null>>({})
  const related = useMemo(
    () => getArticlesByCategory(article.category).filter((a) => a.id !== article.id).slice(0, 4),
    [article.category, article.id],
  )

  // Build the prev/next navigation list — path order if a path is active, otherwise category order
  const navList = useMemo<Article[]>(() => {
    if (activePath) {
      return activePath.articleIds
        .map((id) => getArticleById(id))
        .filter((a): a is Article => a != null)
    }
    return getArticlesByCategory(article.category)
  }, [activePath, article.category])

  const currentIdx = navList.findIndex((a) => a.id === article.id)
  const prev = currentIdx > 0 ? navList[currentIdx - 1] : null
  const next = currentIdx >= 0 && currentIdx < navList.length - 1 ? navList[currentIdx + 1] : null

  useEffect(() => {
    markRead(article.id)
    // Scroll the window AND any scrollable parent container to the top.
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [article.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setQuizState = (key: string, idx: number) =>
    setQuizStates((prev) => ({ ...prev, [key]: idx }))

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-accent transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" />Back to Learn Hub
      </button>

      {activePath && currentIdx >= 0 && (
        <div className="mb-6 rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: activePath.color + '40', backgroundColor: activePath.color + '0d' }}>
          <span className="text-xl">{activePath.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: activePath.color }}>Path · {activePath.title}</div>
            <div className="text-xs text-surface-400 mt-0.5">Article {currentIdx + 1} of {navList.length}</div>
          </div>
          <div className="w-24 h-1 rounded-full bg-surface-700 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${((currentIdx + 1) / navList.length) * 100}%`, backgroundColor: activePath.color }} />
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-3xl">{article.icon}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: cat?.color, backgroundColor: cat ? cat.color + '20' : undefined }}>
            {cat?.name ?? article.category}
          </span>
          <DiffBadge d={article.difficulty} />
          <span className="text-xs text-surface-500 flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTime}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-surface-50 leading-tight">{article.title}</h1>
          <button
            onClick={() => toggleBookmark(article.id)}
            className={cn('shrink-0 p-2 rounded-lg transition-colors', bookmarkIds.has(article.id) ? 'text-amber-400 bg-amber-500/10' : 'text-surface-500 hover:text-amber-400')}
          >
            <BookMarked className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-surface-400 mt-2 leading-relaxed">{article.description}</p>
      </div>

      <div className="space-y-3">
        {(article.content ?? []).map((block, i) => (
          <BlockRenderer key={i} block={block} articleId={article.id} quizStates={quizStates} setQuizState={setQuizState} />
        ))}
      </div>

      {(prev || next) && (
        <div className="mt-10 pt-6 border-t border-surface-700/50 grid grid-cols-2 gap-3">
          {prev ? (
            <button
              onClick={() => onSelectArticle(prev)}
              className="flex items-start gap-2 p-3 rounded-xl border border-surface-600/50 bg-surface-800/60 hover:border-accent/40 hover:bg-surface-800 transition-colors text-left"
            >
              <ArrowLeft className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-0.5">Previous</div>
                <div className="text-xs font-semibold text-surface-200 truncate">{prev.title}</div>
              </div>
            </button>
          ) : <div />}
          {next ? (
            <button
              onClick={() => onSelectArticle(next)}
              className="flex items-start gap-2 p-3 rounded-xl border border-surface-600/50 bg-surface-800/60 hover:border-accent/40 hover:bg-surface-800 transition-colors text-right justify-end"
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-0.5">Next</div>
                <div className="text-xs font-semibold text-surface-200 truncate">{next.title}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-surface-400 shrink-0 mt-0.5" />
            </button>
          ) : <div />}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-10 pt-6 border-t border-surface-700/50">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">More from {cat?.name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {related.map((a) => {
              const relCat = categories.find((c) => c.id === a.category)
              return (
                <ArticleCard key={a.id} article={a} cat={relCat} isRead={readIds.has(a.id)} onSelect={onSelectArticle} />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Category section ────────────────────────────────────────────────────────
const CAT_PAGE = 6

function CategorySection({ cat, arts, readIds, onSelect, activeDiff }: {
  cat: Category
  arts: Article[]
  readIds: Set<string>
  onSelect: (a: Article) => void
  activeDiff: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const filtered = activeDiff ? arts.filter((a) => a.difficulty === activeDiff) : arts
  if (filtered.length === 0) return null
  const shown = expanded ? filtered : filtered.slice(0, CAT_PAGE)
  const hasMore = filtered.length > CAT_PAGE

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{cat.icon}</span>
        <h2 className="text-sm font-semibold text-surface-200">{cat.name}</h2>
        <span className="text-xs text-surface-500 ml-1">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
        <div className="flex-1 h-px bg-surface-700/50 ml-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {shown.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            cat={cat}
            isRead={readIds.has(article.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-surface-500 hover:text-accent transition-colors flex items-center gap-1"
        >
          <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Show less' : `Show ${filtered.length - CAT_PAGE} more`}
        </button>
      )}
    </div>
  )
}

// ── Main Learn page ─────────────────────────────────────────────────────────
function LearnHub() {
  const navigate = useNavigate()
  const { readIds, bookmarkIds, lastRead, markRead, toggleBookmark } = useLearnState()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [activePath, setActivePath] = useState<LearningPath | null>(null)
  const [query, setQuery]           = useState('')
  const [activeCat, setActiveCat]   = useState<string | null>(null)
  const [activeDiff, setActiveDiff] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'read' | 'unread' | 'bookmarked'>('all')
  const [showAllCats, setShowAllCats]   = useState(false)

  const continueArticle = useMemo(
    () => (lastRead ? getArticleById(lastRead.id) ?? null : null),
    [lastRead],
  )

  const filtered = useMemo(() => {
    let pool = articles.filter((a): a is Article => a != null && typeof a === 'object' && 'id' in a)
    if (query.trim()) {
      const q = query.toLowerCase()
      pool = pool.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
      )
    }
    if (activeCat) pool = pool.filter((a) => a.category === activeCat)
    if (activeDiff) pool = pool.filter((a) => a.difficulty === activeDiff)
    if (statusFilter === 'read')       pool = pool.filter((a) =>  readIds.has(a.id))
    if (statusFilter === 'unread')     pool = pool.filter((a) => !readIds.has(a.id))
    if (statusFilter === 'bookmarked') pool = pool.filter((a) =>  bookmarkIds.has(a.id))
    return pool
  }, [query, activeCat, activeDiff, statusFilter, readIds, bookmarkIds])

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>()
    for (const a of filtered) {
      const list = map.get(a.category)
      if (list) list.push(a); else map.set(a.category, [a])
    }
    return map
  }, [filtered])

  const visibleCats = useMemo(
    () => categories.filter((c) => grouped.has(c.id)),
    [grouped],
  )

  const catList = showAllCats ? categories : categories.slice(0, 12)

  if (selectedArticle) {
    return (
      <div className="p-6">
        <ArticleView
          article={selectedArticle}
          onBack={() => setSelectedArticle(null)}
          onSelectArticle={setSelectedArticle}
          readIds={readIds}
          bookmarkIds={bookmarkIds}
          markRead={markRead}
          toggleBookmark={toggleBookmark}
          activePath={activePath}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-100 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold text-surface-50">Learn Investing</h1>
        </div>
        <p className="text-sm text-surface-400">
          Comprehensive library covering fundamental analysis, valuation, portfolio construction, and market mechanics.
          {articles.length > 0 && (
            <span className="text-surface-500 ml-1 tabular-nums">
              {articles.length} articles · {readIds.size} read
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles…"
          className="w-full bg-surface-800/80 border border-surface-600/50 rounded-xl pl-9 pr-10 py-2.5 text-sm text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-accent/50 transition-colors"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Continue reading */}
      {!query && !activePath && continueArticle && (
        <button
          onClick={() => setSelectedArticle(continueArticle)}
          className="w-full mb-6 flex items-center gap-3 p-3 rounded-xl border border-accent/30 bg-accent/5 hover:border-accent/50 hover:bg-accent/10 transition-colors text-left group"
        >
          <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Play className="w-4 h-4 text-accent" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-accent mb-0.5">Continue reading</div>
            <div className="text-sm font-semibold text-surface-100 truncate group-hover:text-white">{continueArticle.title}</div>
            <div className="text-[11px] text-surface-400 truncate">{continueArticle.description}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-accent shrink-0" />
        </button>
      )}

      {/* Active path banner */}
      {activePath && (
        <div className="mb-6 rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: activePath.color + '40', backgroundColor: activePath.color + '0d' }}>
          <span className="text-2xl">{activePath.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: activePath.color }}>Active Path</div>
            <div className="text-sm font-bold text-surface-50">{activePath.title}</div>
            <div className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{activePath.description}</div>
          </div>
          <button onClick={() => setActivePath(null)} className="text-xs text-surface-400 hover:text-surface-100 shrink-0 flex items-center gap-1">
            Exit path <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Learning paths */}
      {!query && !activePath && (
        <div className="mb-8">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Learning Paths</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {paths.map((p) => {
              const read = p.articleIds.filter((id) => readIds.has(id)).length
              const pct = p.articleIds.length > 0 ? Math.round((read / p.articleIds.length) * 100) : 0
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePath(p)}
                  className="text-left p-3 rounded-xl border border-surface-600/40 bg-surface-800/60 hover:border-surface-500/60 hover:bg-surface-800/80 transition-all group"
                >
                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="text-xl shrink-0">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-surface-100 group-hover:text-white leading-tight">{p.title}</div>
                      <div className="text-[10px] text-surface-400 line-clamp-2 mt-0.5 leading-snug">{p.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px]">
                    <span className="text-surface-500">{read}/{p.articleIds.length} read</span>
                    <span className="font-semibold" style={{ color: p.color }}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-700 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Category grid */}
      {!query && !activePath && (
        <div className="mb-8">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Browse by Category</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {catList.map((cat) => {
              const catArts = getArticlesByCategory(cat.id)
              const catRead = catArts.filter((a) => readIds.has(a.id)).length
              const isActive = activeCat === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(isActive ? null : cat.id)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-xl border transition-all text-left',
                    isActive ? 'border-current' : 'border-surface-600/40 bg-surface-800/60 hover:border-surface-500/60',
                  )}
                  style={isActive ? { borderColor: cat.color, backgroundColor: cat.color + '15' } : {}}
                >
                  <span className="text-lg mb-1.5">{cat.icon}</span>
                  <div className="text-[11px] font-semibold text-surface-200 leading-snug line-clamp-2 flex-1">{cat.name}</div>
                  {catArts.length > 0 && (
                    <div className="flex items-center justify-between w-full mt-1.5">
                      <span className="text-[9px] text-surface-500">{catRead}/{catArts.length} read</span>
                      {catRead > 0 && (
                        <span className="text-[9px] font-semibold text-emerald-400">{Math.round((catRead / catArts.length) * 100)}%</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {categories.length > 12 && (
            <button
              onClick={() => setShowAllCats(!showAllCats)}
              className="mt-2 text-xs text-surface-500 hover:text-accent transition-colors flex items-center gap-1"
            >
              <ChevronDown className={cn('w-3 h-3 transition-transform', showAllCats && 'rotate-180')} />
              {showAllCats ? 'Show less' : `Show ${categories.length - 12} more categories`}
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 mb-5 flex-wrap bg-background/95 backdrop-blur-md py-2.5 -mx-6 px-6 border-b border-surface-700/50">
        {activeCat && (
          <button
            onClick={() => setActiveCat(null)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent"
          >
            {categories.find((c) => c.id === activeCat)?.name}<X className="w-3 h-3 ml-1" />
          </button>
        )}
        <div className="flex items-center gap-1">
          {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setActiveDiff(activeDiff === d ? null : d)}
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all',
                activeDiff === d ? diffStyle[d] : 'text-surface-500 hover:text-surface-300',
              )}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-lg border border-surface-600/50 overflow-hidden text-[10px]">
          {(['all', 'unread', 'read', 'bookmarked'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn('px-2.5 py-1 font-medium transition-colors', statusFilter === s ? 'bg-accent/20 text-accent' : 'text-surface-400 hover:text-surface-200')}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {(activeCat || activeDiff || statusFilter !== 'all') && (
          <button onClick={() => { setActiveCat(null); setActiveDiff(null); setStatusFilter('all') }} className="text-[10px] text-surface-500 hover:text-accent">
            Clear all
          </button>
        )}
        <span className="ml-auto text-xs text-surface-500">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Articles */}
      {articles.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-surface-600/40 rounded-2xl">
          <BookOpen className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium mb-1">Articles coming soon</p>
          <p className="text-sm text-surface-500">The article library is being loaded.</p>
        </div>
      ) : activePath ? (
        // Path mode — render path articles in order, ungrouped
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {activePath.articleIds
            .map((id) => getArticleById(id))
            .filter((a): a is Article => a != null)
            .map((article, idx) => {
              const cat = categories.find((c) => c.id === article.category)
              return (
                <div key={article.id} className="relative">
                  <span className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-surface-900 border border-surface-600 text-[9px] font-bold text-surface-300 flex items-center justify-center">{idx + 1}</span>
                  <ArticleCard article={article} cat={cat} isRead={readIds.has(article.id)} onSelect={setSelectedArticle} />
                </div>
              )
            })}
        </div>
      ) : visibleCats.length === 0 ? (
        <div className="text-center py-16 text-surface-500">
          <p className="text-base mb-1">No articles found</p>
          <p className="text-sm">Try a different search or filter</p>
        </div>
      ) : (
        visibleCats.map((cat) => (
          <CategorySection
            key={cat.id}
            cat={cat}
            arts={grouped.get(cat.id) ?? []}
            readIds={readIds}
            onSelect={setSelectedArticle}
            activeDiff={activeDiff}
          />
        ))
      )}
    </div>
  )
}

export default function Learn() {
  return (
    <LearnErrorBoundary>
      <LearnHub />
    </LearnErrorBoundary>
  )
}
