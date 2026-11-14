import type { Catalog, FeaturedPoem, Overview, Poem, PoemDetail, PoemPage, PoemQuery } from '../types/poem'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
const requestTimeout = 20_000

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : '暂时无法读取数据，请稍后重试。'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPoem(value: unknown): value is Poem {
  return isRecord(value)
    && ['id', 'title', 'authorName', 'dynasty', 'form', 'content', 'source', 'license', 'edition']
      .every((field) => typeof value[field] === 'string')
    && isNullableString(value.authorId)
    && isNullableString(value.sourceUrl)
    && isNullableString(value.importedAt)
    && isStringArray(value.lines)
    && isStringArray(value.tags)
}

function isPoemDetail(value: unknown): value is PoemDetail {
  return isRecord(value)
    && isNullableString(value.authorBio)
    && isRecord(value.navigation)
    && isNullableString(value.navigation.previousId)
    && isNullableString(value.navigation.nextId)
    && isPoem(value)
}

function isFeaturedPoem(value: unknown): value is FeaturedPoem {
  return isRecord(value)
    && typeof value.scene === 'string'
    && value.scene.trim().length > 0
    && isPoem(value)
}

function isPoemPage(value: unknown): value is PoemPage {
  return isRecord(value)
    && Array.isArray(value.items)
    && value.items.every(isPoem)
    && isCount(value.page) && value.page >= 1
    && isCount(value.pageSize) && value.pageSize >= 1
    && isCount(value.total)
}

function isCatalog(value: unknown): value is Catalog {
  return isRecord(value)
    && isStringArray(value.dynasties)
    && isStringArray(value.forms)
    && isStringArray(value.tags)
}

function isOverview(value: unknown): value is Overview {
  return isRecord(value)
    && ['poems', 'authors', 'tags', 'dynasties'].every((field) => isCount(value[field]))
    && isNullableString(value.latestImportedAt)
}

async function request<T>(
  path: string,
  validate: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, requestTimeout)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') || ''
    if (!/(?:application\/json|application\/[^;]+\+json)(?:;|$)/i.test(contentType)) {
      throw new ApiError('暂时无法连接数据服务，请稍后重试。', 0)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new ApiError('数据响应格式不正确，请稍后重试。', 0)
    }
    if (!response.ok) {
      const message = isRecord(payload) ? payload.message : null
      const detail = typeof message === 'string'
        ? message
        : isStringArray(message) ? message.join('；') : ''
      throw new ApiError(
        response.status >= 500
          ? '暂时无法读取数据，请稍后重试。'
          : detail || '数据请求未完成，请稍后重试。',
        response.status,
      )
    }
    if (!validate(payload)) {
      throw new ApiError('数据响应格式不正确，请稍后重试。', 0)
    }
    return payload
  } catch (error) {
    if (timedOut && !signal?.aborted) {
      throw new ApiError('读取数据超时，请稍后重试。', 0)
    }
    if (isAbortError(error) || error instanceof ApiError) throw error
    throw new ApiError('暂时无法连接数据服务，请稍后重试。', 0)
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export function getPoems(query: PoemQuery, signal?: AbortSignal) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return request(`/poems?${params}`, isPoemPage, signal)
}

export function getFeaturedPoems(signal?: AbortSignal) {
  return request('/poems/featured', (value): value is FeaturedPoem[] =>
    Array.isArray(value) && value.every(isFeaturedPoem), signal)
}

export function getPoem(id: string, signal?: AbortSignal) {
  return request(`/poems/${encodeURIComponent(id)}`, isPoemDetail, signal)
}

export function getRandomPoem(exclude: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ exclude })
  return request(`/poems/random?${params}`, (value): value is { id: string } =>
    isRecord(value) && typeof value.id === 'string', signal)
}

export function getCatalog(signal?: AbortSignal) {
  return request('/catalog', isCatalog, signal)
}

export function getOverview(signal?: AbortSignal) {
  return request('/overview', isOverview, signal)
}
