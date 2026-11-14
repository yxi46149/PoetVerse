import { randomInt } from 'node:crypto'
import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service.js'
import { Prisma } from '../generated/prisma/client.js'
import { escapeLike, PoemQueryDto } from './poem-query.dto.js'

const publicPoemSelect = {
  id: true,
  title: true,
  authorId: true,
  authorName: true,
  dynasty: true,
  form: true,
  content: true,
  source: true,
  sourceUrl: true,
  license: true,
  edition: true,
  importedAt: true,
  poemTags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PoemSelect

type PublicPoemRow = Prisma.PoemGetPayload<{ select: typeof publicPoemSelect }>

function serializePoem(row: PublicPoemRow) {
  const { poemTags, importedAt, ...poem } = row
  return {
    ...poem,
    importedAt: importedAt?.toISOString().slice(0, 10) ?? null,
    lines: poem.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    tags: poemTags.map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b, 'zh-CN')),
  }
}

function poemFilter(query: PoemQueryDto) {
  const conditions = [Prisma.sql`poems.status = 'published'`]
  if (query.dynasty) conditions.push(Prisma.sql`poems.dynasty = ${query.dynasty}`)
  if (query.author) conditions.push(Prisma.sql`poems.author_name = ${query.author}`)
  if (query.tag) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM poem_tags
      INNER JOIN tags ON tags.id = poem_tags.tag_id
      WHERE poem_tags.poem_id = poems.id AND tags.name = ${query.tag}
    )`)
  }
  if (query.form === '五言' || query.form === '七言') {
    conditions.push(Prisma.sql`poems.form LIKE ${`${query.form}%`}`)
  } else if (query.form === '词') {
    conditions.push(Prisma.sql`poems.form LIKE '%词'`)
  } else if (query.form) {
    conditions.push(Prisma.sql`poems.form = ${query.form}`)
  }
  if (query.q) {
    const keyword = `%${escapeLike(query.q)}%`
    conditions.push(Prisma.sql`(
      poems.title LIKE ${keyword}
      OR poems.author_name LIKE ${keyword}
      OR poems.content LIKE ${keyword}
    )`)
  }
  return Prisma.join(conditions, ' AND ')
}

@Injectable()
export class PoemsService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: PoemQueryDto) {
    const client = this.database.client
    const filter = poemFilter(query)
    const orderBy = query.sort === 'latest'
      ? Prisma.sql`poems.created_at DESC, poems.id ASC`
      : Prisma.sql`poems.id ASC`
    // Unfiltered text search must scan rows; the primary index avoids a
    // secondary-index lookup for every published poem.
    const hasIndexedFilter = query.dynasty || query.author || query.form || query.tag
    const countIndex = query.q && !hasIndexedFilter ? Prisma.sql`FORCE INDEX (PRIMARY)` : Prisma.empty
    const countMatches = () => client.$queryRaw<{ total: bigint | number }[]>`
      SELECT COUNT(*) AS total FROM poems ${countIndex}
      WHERE ${filter}
    `
    let ids: { id: string }[]
    let total: number
    if (query.q) {
      // The page and exact total share one text scan, including empty searches.
      const matches = await client.$queryRaw<{ id: string; total: bigint | number }[]>`
        SELECT poems.id, COUNT(*) OVER () AS total FROM poems ${countIndex}
        WHERE ${filter}
        ORDER BY ${orderBy}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      `
      ids = matches
      total = Number(matches[0]?.total ?? 0)
      if (!matches.length && query.page > 1) {
        // An out-of-range page has no window row carrying the total.
        total = Number((await countMatches())[0]?.total ?? 0)
      }
    } else {
      const [pageIds, aggregate] = await Promise.all([
        client.$queryRaw<{ id: string }[]>`
          SELECT poems.id FROM poems
          WHERE ${filter}
          ORDER BY ${orderBy}
          LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
        `,
        countMatches(),
      ])
      ids = pageIds
      total = Number(aggregate[0]?.total ?? 0)
    }
    if (!Number.isSafeInteger(total) || total < 0) throw new RangeError('Invalid poem count')

    // Read full text and tags only for the selected page.
    const pageRows = ids.length ? await client.poem.findMany({
      where: { status: 'published', id: { in: ids.map(({ id }) => id) } },
      select: publicPoemSelect,
    }) : []
    const byId = new Map(pageRows.map((row) => [row.id, row]))
    const rows = ids.map(({ id }) => byId.get(id)).filter((row): row is PublicPoemRow => row !== undefined)
    return { items: rows.map(serializePoem), page: query.page, pageSize: query.pageSize, total }
  }

  async featured() {
    const client = this.database.client
    const selections = [
      { scene: '山水', authorName: '王维', title: '鹿柴' },
      { scene: '月夜', authorName: '张继', title: '枫桥夜泊' },
      { scene: '送别', authorName: '王昌龄', title: '芙蓉楼送辛渐', excerpt: '一片冰心在玉壶' },
      { scene: '相思', authorName: '王维', title: '相思', excerpt: '红豆生南国' },
      { scene: '咏春', authorName: '孟浩然', title: '春晓' },
    ]
    const preferred = await Promise.all(selections.map(async ({ scene, authorName, title, excerpt }) => {
      const row = await client.poem.findFirst({
        where: {
          status: 'published',
          authorName,
          title: { contains: title },
          ...(excerpt ? { content: { contains: excerpt } } : {}),
        },
        orderBy: { id: 'asc' },
        select: publicPoemSelect,
      })
      return row ? { ...serializePoem(row), scene } : null
    }))
    return preferred.filter((poem) => poem !== null)
  }

  async detail(id: string) {
    const client = this.database.client
    const row = await client.poem.findFirst({
      where: { id, status: 'published' },
      select: { ...publicPoemSelect, author: { select: { bio: true } } },
    })
    if (!row) throw new NotFoundException('未找到这首诗词')

    let [previous, next] = await Promise.all([
      client.poem.findFirst({
        where: { status: 'published', id: { lt: id } },
        orderBy: { id: 'desc' },
        select: { id: true },
      }),
      client.poem.findFirst({
        where: { status: 'published', id: { gt: id } },
        orderBy: { id: 'asc' },
        select: { id: true },
      }),
    ])
    if (!previous) {
      previous = await client.poem.findFirst({
        where: { status: 'published', id: { not: id } },
        orderBy: { id: 'desc' },
        select: { id: true },
      })
    }
    if (!next) {
      next = await client.poem.findFirst({
        where: { status: 'published', id: { not: id } },
        orderBy: { id: 'asc' },
        select: { id: true },
      })
    }
    const { author, ...poem } = row
    return {
      ...serializePoem(poem),
      authorBio: author?.bio ?? null,
      navigation: { previousId: previous?.id ?? null, nextId: next?.id ?? null },
    }
  }

  async random(exclude?: string) {
    const client = this.database.client
    const exclusion = exclude ? Prisma.sql`AND id <> ${exclude}` : Prisma.empty
    const [aggregate] = await client.$queryRaw<{ total: bigint | number }[]>`
      SELECT COUNT(*) AS total
      FROM poems FORCE INDEX (idx_poems_status)
      WHERE status = 'published' ${exclusion}
    `
    const count = Number(aggregate?.total ?? 0)
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid poem count')
    if (!count) throw new NotFoundException('暂无其他可读的诗词')

    // The status index also contains the primary key, avoiding full poem reads.
    const [poem] = await client.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM poems FORCE INDEX (idx_poems_status)
      WHERE status = 'published' ${exclusion}
      ORDER BY id ASC
      LIMIT 1 OFFSET ${randomInt(count)}
    `
    if (!poem) throw new NotFoundException('诗词数据已更新，请重试')
    return poem
  }
}
