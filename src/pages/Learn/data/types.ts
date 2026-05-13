export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'formula'; formula: string; variables: { symbol: string; label: string }[] }
  | { type: 'example'; company: string; scenario: string; numbers?: Record<string, string> }
  | { type: 'callout'; variant: 'tip' | 'warning' | 'info'; title: string; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'keyPoints'; points: string[] }
  | { type: 'quiz'; question: string; options: string[]; correctIndex: number; explanation: string }

export interface Article {
  id: string
  title: string
  category: string
  icon: string
  readTime: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  content: ContentBlock[]
}

export interface Category {
  id: string
  name: string
  icon: string
  description: string
  color: string
}
