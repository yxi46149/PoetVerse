import { reactive } from 'vue'

type CollectionState = {
  dynasty: string
  form: string
  tag: string
  query: string
  page: number
}

const storageKey = 'poetverse-collection-state-v1'
const defaults: CollectionState = {
  dynasty: '全部',
  form: '全部',
  tag: '全部',
  query: '',
  page: 1,
}

function readFilter(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim() && value.length <= maxLength
    ? value.trim()
    : '全部'
}

function readState(): CollectionState {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...defaults }
    const value = stored as Record<string, unknown>
    return {
      dynasty: readFilter(value.dynasty, 16),
      form: readFilter(value.form, 16),
      tag: readFilter(value.tag, 32),
      query: typeof value.query === 'string' && value.query.length <= 100 ? value.query : '',
      page: typeof value.page === 'number' && Number.isInteger(value.page)
        && value.page >= 1 && value.page <= 1_000_000 ? value.page : 1,
    }
  } catch {
    return { ...defaults }
  }
}

export const collectionState = reactive(readState())

export function saveCollectionState() {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(collectionState))
  } catch {
    // The shared state still survives route changes when storage is unavailable.
  }
}
