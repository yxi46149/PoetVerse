<template>
<section id="collection" class="collection-section pv-container">
      <div class="collection-section__header">
        <div class="collection-intro">
          <p class="section-eyebrow">02 / 诗词选读</p>
          <h2 class="collection-title pv-section-title">循着心境，找到那一首</h2>
          <p class="pv-section-desc">从朝代、字数与主题入手，慢慢翻阅诗人的心事。</p>
        </div>
        <div class="collection-search">
          <div class="search-control">
            <el-input v-model="query" clearable :maxlength="100" aria-label="搜索诗名、诗人或诗句" placeholder="搜诗名、诗人或一句诗……" class="poet-search-input">
              <template #prefix><Search :size="17" class="search-control__icon" /></template>
            </el-input>
          </div>
          <FilterGroup v-model="tag" class="mood-filter" title="心境" :options="tags" />
        </div>
      </div>
      <div class="collection-layout">
        <aside class="filter-panel">
          <FilterGroup v-model="dynasty" title="朝代" :options="dynasties" />
          <FilterGroup v-model="form" title="诗体" :options="forms" />
          <div v-if="catalogLoading" class="filter-status" role="status">正在读取分类……</div>
          <div v-else-if="catalogError" class="filter-status" role="alert">
            <p>{{ catalogError }}</p>
            <el-button text class="poet-clear-button" @click="reloadCatalog">重新读取分类</el-button>
          </div>
        </aside>
        <div class="results-panel" :aria-busy="loading">
          <div class="results-meta"><span>诗笺 · {{ loading || error ? '—' : total.toLocaleString() }} 首</span><span>按篇目选读</span></div>
          <div v-if="loading" class="no-results" role="status">
            <LoaderCircle class="no-results__icon is-loading" :size="24" />
            <p class="no-results__title">正在翻阅诗卷</p>
          </div>
          <div v-else-if="error" class="no-results" role="alert">
            <p class="no-results__title">诗卷暂未打开</p>
            <p class="no-results__description">{{ error }}</p>
            <el-button text class="poet-clear-button" @click="loadPoems">重新读取</el-button>
          </div>
          <div v-else-if="results.length" class="poem-grid">
            <button v-for="(poem, index) in results" :key="poem.id" type="button" class="poem-card" @click="goPoem(poem)">
              <span class="poem-card__top"><span class="poem-card__meta">{{ String((page - 1) * pageSize + index + 1).padStart(2, '0') }} {{ poem.dynasty }} · {{ poem.form }}</span><ArrowRight :size="15" class="poem-card__arrow" /></span>
              <span class="poem-card__title-group"><span class="poem-card__title">{{ poem.title }}</span><span class="poem-card__details">{{ poem.authorName }}<template v-if="poem.tags.length"> · {{ poem.tags.slice(0, 2).join(' / ') }}</template></span></span>
              <span class="poem-card__excerpt">{{ poem.lines.slice(0, 2).join('') }}</span>
            </button>
          </div>
          <div v-else class="no-results">
            <BookOpen class="no-results__icon" :size="24" />
            <p class="no-results__title">暂未找到相合的诗句</p>
            <p class="no-results__description">试试换一个朝代、诗体或关键词。</p>
            <el-button text class="poet-clear-button" @click="resetFilters">清除筛选</el-button>
          </div>
          <nav v-if="!loading && !error && total > pageSize" class="collection-pagination" aria-label="诗词分页">
            <button type="button" class="pagination-button" :disabled="page <= 1" @click="changePage(page - 1)">
              <ChevronLeft :size="16" /><span>上一页</span>
            </button>
            <span class="pagination-status" aria-live="polite">{{ page }} / {{ pageCount }}</span>
            <button type="button" class="pagination-button" :disabled="page >= pageCount" @click="changePage(page + 1)">
              <span>下一页</span><ChevronRight :size="16" />
            </button>
          </nav>
        </div>
      </div>
    </section>


</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, LoaderCircle, Search } from 'lucide-vue-next'
import FilterGroup from './FilterGroup.vue'
import { useCatalog } from '../composables/useCatalog'
import { errorMessage, getPoems, isAbortError } from '../services/poemApi'
import { collectionState, saveCollectionState } from '../state/collection'
import type { Poem } from '../types/poem'

const router = useRouter()
const { catalog, loading: catalogLoading, error: catalogError, reload: reloadCatalog } = useCatalog()
const dynasties = computed(() => ['全部', ...(catalog.value?.dynasties ?? [])])
const forms = computed(() => ['全部', ...(catalog.value?.forms ?? [])])
const tags = computed(() => ['全部', ...(catalog.value?.tags ?? [])])
const dynasty = defineModel<string>('dynasty', { default: '全部' })
const { form, tag, query, page } = toRefs(collectionState)
const results = ref<Poem[]>([])
const pageSize = 10
const total = ref(0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const loading = ref(true)
const error = ref('')
let controller: AbortController | null = null
let requestId = 0
let searchTimer: ReturnType<typeof window.setTimeout> | undefined

function goPoem(poem: Poem) {
  router.push({ path: `/poem/${poem.id}` })
}

async function loadPoems() {
  window.clearTimeout(searchTimer)
  controller?.abort()
  const current = ++requestId
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const result = await getPoems({
      q: query.value.trim() || undefined,
      dynasty: dynasty.value === '全部' ? undefined : dynasty.value,
      form: form.value === '全部' ? undefined : form.value,
      tag: tag.value === '全部' ? undefined : tag.value,
      page: page.value,
      pageSize,
    }, controller.signal)
    if (current !== requestId) return
    const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
    if (result.total > 0 && result.page > lastPage) {
      page.value = lastPage
      void loadPoems()
      return
    }
    results.value = result.items
    total.value = result.total
    page.value = result.page
  } catch (cause) {
    if (current !== requestId || isAbortError(cause)) return
    results.value = []
    total.value = 0
    error.value = errorMessage(cause)
  } finally {
    if (current === requestId) loading.value = false
  }
}

function changePage(next: number) {
  if (loading.value || next < 1 || next > pageCount.value || next === page.value) return
  page.value = next
  void loadPoems()
  document.querySelector('.results-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function applyDynasty(name: string) {
  dynasty.value = dynasties.value.includes(name) ? name : '全部'
}

function resetFilters() {
  page.value = 1
  dynasty.value = '全部'
  form.value = '全部'
  tag.value = '全部'
  query.value = ''
}

watch([dynasty, form, tag, query], (next, previous) => {
  page.value = 1
  window.clearTimeout(searchTimer)
  controller?.abort()
  requestId += 1
  loading.value = true
  error.value = ''
  const delay = next[3] !== previous[3] ? 300 : 0
  searchTimer = window.setTimeout(() => { void loadPoems() }, delay)
})

watch([dynasty, form, tag, query, page], saveCollectionState, { flush: 'post' })

onMounted(() => { void loadPoems() })
onBeforeUnmount(() => {
  saveCollectionState()
  window.clearTimeout(searchTimer)
  requestId += 1
  controller?.abort()
})

defineExpose({ applyDynasty })
</script>

<style scoped>
.collection-section { padding: 48px 20px; }
.collection-section__header { display: flex; flex-direction: column; justify-content: space-between; gap: 32px; margin-bottom: 48px; }
.collection-intro { min-width: 0; }
.collection-title { font-size: 36px; }
.collection-search { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 20px; }
.search-control { display: flex; width: 100%; min-width: 0; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.search-control:focus-within { border-color: var(--primary); }
.search-control__icon { color: var(--muted-foreground); }
.mood-filter { min-width: 0; max-width: 100%; }
.mood-filter :deep(.poet-filter-group.el-radio-group) { max-width: 100%; flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
.mood-filter :deep(.el-radio-button) { min-width: 0; max-width: 100%; }
.mood-filter :deep(.el-radio-button__inner) { max-width: 100%; min-height: 36px; padding: 9px 12px; line-height: 1.5; overflow-wrap: anywhere; white-space: normal; }
.collection-layout { display: grid; gap: 40px; }
.filter-panel { display: flex; flex-direction: column; gap: 32px; }
.filter-status { color: var(--muted-foreground); font-size: 12px; line-height: 1.7; }
.results-panel { min-width: 0; scroll-margin-top: 90px; }
.results-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px; color: var(--muted-foreground); font-size: 12px; }
.results-meta span:last-child { font-family: var(--font-mono); letter-spacing: .12em; }
.poem-grid { display: grid; gap: 0 40px; }
.poem-card { display: flex; min-height: 190px; flex-direction: column; justify-content: space-between; border: 0; border-bottom: 1px solid var(--border); background: transparent; padding: 24px 0; color: var(--foreground); cursor: pointer; font-family: inherit; text-align: left; transition: border-color .2s ease; }
.poem-card:hover { border-color: color-mix(in srgb, var(--primary), transparent 50%); }
.poem-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.poem-card__meta { color: color-mix(in srgb, var(--primary), transparent 25%); font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; }
.poem-card__arrow { flex-shrink: 0; margin-top: 4px; color: var(--muted-foreground); transition: color .2s ease, transform .2s ease; }
.poem-card:hover .poem-card__arrow { color: var(--primary); transform: translateX(4px); }
.poem-card__title-group { display: flex; flex-direction: column; }
.poem-card__title { overflow-wrap: anywhere; font-family: var(--font-serif); font-size: 24px; letter-spacing: .1em; }
.poem-card:hover .poem-card__title { color: var(--primary); }
.poem-card__details { margin-top: 8px; color: var(--muted-foreground); font-size: 12px; }
.poem-card__excerpt { overflow: hidden; margin-top: 16px; color: var(--muted-foreground); font-family: var(--font-serif); font-size: 14px; letter-spacing: .08em; text-overflow: ellipsis; white-space: nowrap; }
.no-results { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 64px 0; text-align: center; }
.no-results__icon { color: color-mix(in srgb, var(--primary), transparent 40%); }
.no-results__title { margin: 16px 0 0; font-family: var(--font-serif); font-size: 18px; }
.no-results__description { margin: 8px 0 0; color: var(--muted-foreground); font-size: 14px; }
.collection-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 24px; }
.pagination-button { display: inline-flex; min-height: 40px; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: var(--radius); background: transparent; padding: 0 12px; color: var(--foreground); cursor: pointer; font-size: 13px; }
.pagination-button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.pagination-button:disabled { opacity: .4; cursor: default; }
.pagination-status { color: var(--muted-foreground); font-family: var(--font-mono); font-size: 12px; }
.is-loading { animation: collection-spin 1s linear infinite; }
@keyframes collection-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .is-loading { animation: none; } }
@media (min-width: 640px) {
  .poem-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .collection-section { padding-top: 80px; padding-bottom: 80px; }
  .collection-section__header { flex-direction: row; align-items: flex-start; gap: 48px; }
  .collection-intro { flex: 1 1 0; }
  .collection-search { flex: 1 1 0; max-width: 640px; }
  .collection-layout { grid-template-columns: 220px minmax(0, 1fr); gap: 64px; }
}
</style>
