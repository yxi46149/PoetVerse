import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'
import { errorMessage, getCatalog, isAbortError } from '../services/poemApi'
import type { Catalog } from '../types/poem'

const catalog = ref<Catalog | null>(null)
const loading = ref(false)
const error = ref('')
let request: Promise<void> | null = null
let controller: AbortController | null = null
let consumers = 0

function loadCatalog() {
  if (request) return request
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  request = (async () => {
    try {
      const result = await getCatalog(current.signal)
      if (!current.signal.aborted) catalog.value = result
    } catch (cause) {
      if (!isAbortError(cause) && !current.signal.aborted) error.value = errorMessage(cause)
    } finally {
      if (controller === current) {
        loading.value = false
        controller = null
        request = null
      }
    }
  })()
  return request
}

export function useCatalog() {
  onMounted(() => {
    consumers += 1
    if (!catalog.value) void loadCatalog()
  })

  onBeforeUnmount(() => {
    consumers -= 1
    if (consumers === 0 && controller) {
      controller.abort()
      controller = null
      request = null
      loading.value = false
    }
  })

  return {
    catalog: readonly(catalog),
    loading: readonly(loading),
    error: readonly(error),
    reload: loadCatalog,
  }
}
