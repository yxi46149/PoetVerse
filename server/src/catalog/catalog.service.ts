import { Injectable } from '@nestjs/common'
import { ReadCache } from '../common/read-cache.js'
import { DatabaseService } from '../database/database.service.js'
import type { Prisma } from '../generated/prisma/client.js'
import { escapeLike, SearchDto } from '../poems/poem-query.dto.js'

interface Catalog {
  dynasties: string[]
  forms: string[]
  tags: string[]
}

interface Overview {
  poems: number
  authors: number
  tags: number
  dynasties: number
  latestImportedAt: string | null
}

interface OverviewAggregateRow {
  poems: bigint | number
  authors: bigint | number
  latestImportedAt: string | null
}

function toSafeCount(value: bigint | number): number {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Database count exceeds the supported range')
  }
  return count
}

const dynastyOrder = [
  '先秦', '秦', '汉', '汉末', '汉魏', '三国', '魏晋', '晋', '南北朝', '隋',
  '唐', '五代', '宋', '元', '明', '清', '近代', '现代',
]
const publishedRelation = { some: { status: 'published' } } as const

@Injectable()
export class CatalogService {
  private readonly catalogCache = new ReadCache<Catalog>()
  private readonly overviewCache = new ReadCache<Overview>()

  constructor(private readonly database: DatabaseService) {}

  catalog(): Promise<Catalog> {
    return this.catalogCache.get(async () => {
      const client = this.database.client
      // Probe each indexed candidate once instead of grouping every published row.
      const [dynasties, forms, tags] = await Promise.all([
        client.$queryRaw<{ dynasty: string }[]>`
          SELECT candidate.dynasty
          FROM (
            SELECT DISTINCT dynasty
            FROM poems FORCE INDEX (idx_poems_dynasty)
          ) AS candidate
          WHERE (
            SELECT published.id
            FROM poems AS published FORCE INDEX (idx_poems_dynasty)
            WHERE published.dynasty = candidate.dynasty
              AND published.status = 'published'
            LIMIT 1
          ) IS NOT NULL
        `,
        client.$queryRaw<{ form: string }[]>`
          SELECT candidate.form
          FROM (
            SELECT DISTINCT form
            FROM poems FORCE INDEX (idx_poems_form)
          ) AS candidate
          WHERE (
            SELECT published.id
            FROM poems AS published FORCE INDEX (idx_poems_form)
            WHERE published.form = candidate.form
              AND published.status = 'published'
            LIMIT 1
          ) IS NOT NULL
        `,
        client.$queryRaw<{ name: string }[]>`
          SELECT candidate.name
          FROM tags AS candidate
          WHERE (
            SELECT relation.poem_id
            FROM poem_tags AS relation FORCE INDEX (idx_poem_tags_tag)
            STRAIGHT_JOIN poems AS published ON published.id = relation.poem_id
            WHERE relation.tag_id = candidate.id
              AND published.status = 'published'
            LIMIT 1
          ) IS NOT NULL
          ORDER BY candidate.name ASC
        `,
      ])
      return {
        dynasties: dynasties.map(({ dynasty }) => dynasty).sort((a, b) => {
          const rankA = dynastyOrder.indexOf(a)
          const rankB = dynastyOrder.indexOf(b)
          return (rankA === -1 ? dynastyOrder.length : rankA) -
            (rankB === -1 ? dynastyOrder.length : rankB) || a.localeCompare(b, 'zh-CN')
        }),
        forms: forms.map(({ form }) => form).sort((a, b) => a.localeCompare(b, 'zh-CN')),
        tags: tags.map(({ name }) => name),
      }
    })
  }

  overview(): Promise<Overview> {
    return this.overviewCache.get(async () => {
      const client = this.database.client
      const [rows, catalog] = await Promise.all([
        client.$queryRaw<OverviewAggregateRow[]>`
          SELECT COUNT(*) AS poems,
                 COUNT(DISTINCT author_id) AS authors,
                 DATE_FORMAT(MAX(imported_at), '%Y-%m-%d') AS latestImportedAt
          FROM poems
          WHERE status = 'published'
        `,
        this.catalog(),
      ])
      const aggregate = rows[0]
      if (!aggregate) throw new Error('Database overview aggregate is missing')

      return {
        poems: toSafeCount(aggregate.poems),
        authors: toSafeCount(aggregate.authors),
        tags: catalog.tags.length,
        dynasties: catalog.dynasties.length,
        latestImportedAt: aggregate.latestImportedAt,
      }
    })
  }

  async authors(query: SearchDto) {
    const client = this.database.client
    const where: Prisma.AuthorWhereInput = { poems: publishedRelation }
    if (query.q) where.name = { contains: escapeLike(query.q) }
    if (query.dynasty) where.dynasty = query.dynasty
    const [rows, total] = await Promise.all([
      client.author.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          dynasty: true,
          bio: true,
          _count: { select: { poems: { where: { status: 'published' } } } },
        },
      }),
      client.author.count({ where }),
    ])
    return {
      items: rows.map(({ _count, ...author }) => ({ ...author, poemCount: _count.poems })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }
}
