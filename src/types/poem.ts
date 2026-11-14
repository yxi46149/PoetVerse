export type Poem = {
  id: string
  title: string
  authorId: string | null
  authorName: string
  dynasty: string
  form: string
  content: string
  lines: string[]
  tags: string[]
  source: string
  sourceUrl: string | null
  license: string
  edition: string
  importedAt: string | null
}

export type FeaturedPoem = Poem & {
  scene: string
}

export type PoemDetail = Poem & {
  authorBio: string | null
  navigation: {
    previousId: string | null
    nextId: string | null
  }
}

export type PoemPage = {
  items: Poem[]
  page: number
  pageSize: number
  total: number
}

export type PoemQuery = {
  q?: string
  dynasty?: string
  form?: string
  tag?: string
  author?: string
  page?: number
  pageSize?: number
}

export type Catalog = {
  dynasties: string[]
  forms: string[]
  tags: string[]
}

export type Overview = {
  poems: number
  authors: number
  tags: number
  dynasties: number
  latestImportedAt: string | null
}
