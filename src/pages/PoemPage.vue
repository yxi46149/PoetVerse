<template>
  <div class="poet-page poem-page">
    <SiteHeader />
    <main class="poem-page__main pv-container" :aria-busy="loading">
      <RouterLink :to="{ path: '/', hash: '#collection' }" class="poem-page__back">
        <ArrowLeft :size="15" /> 返回选读
      </RouterLink>
      <div v-if="loading" class="poem-missing" role="status">
        <p class="poem-missing__title">正在展卷……</p>
      </div>
      <div v-else-if="error" class="poem-missing" role="alert">
        <p class="poem-missing__title">诗笺暂未打开</p>
        <p class="poem-missing__desc">{{ error }}</p>
        <button type="button" class="poem-missing__link" @click="loadPoem">重新读取</button>
      </div>
      <template v-else-if="poem">

        <header class="poem-head">
          <p class="poem-head__eyebrow">{{ poem.dynasty }} · {{ poem.form }}</p>
          <h1 class="poem-head__title">
            《{{ titleMain }}》<span v-if="titleSub" class="poem-head__subtitle"> · {{ titleSub }}</span>
          </h1>
          <p class="poem-head__author">{{ poem.authorName }} · {{ poem.dynasty }}</p>
          <div v-if="poem.tags.length" class="poem-head__tags">
            <span v-for="tag in poem.tags" :key="tag" class="poem-tag">{{ tag }}</span>
          </div>
        </header>

        <section class="verse-card" :class="{ 'verse-card--long': longPoem }" aria-label="诗文">
          <div class="verse-vertical">
            <p v-for="(line, index) in poem.lines" :key="index" class="verse-line">{{ line }}</p>
          </div>
        </section>

        <section class="poem-note" aria-label="作品信息">
          <template v-if="poem.authorBio">
            <p class="poem-note__label">作者简介</p>
            <p class="poem-note__text">{{ poem.authorBio }}</p>
          </template>
          <p class="poem-note__source">
            来源：
            <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener noreferrer">{{ poem.source }}</a>
            <span v-else>{{ poem.source }}</span>
            <span v-if="poem.edition"> · {{ poem.edition }}</span>
            <span> · {{ poem.license === 'PD' ? '公有领域' : poem.license }}</span>
          </p>
          <button type="button" class="poem-note__copy" @click="copyPoem">
            <Check v-if="copied" :size="15" /><Copy v-else :size="15" />
            {{ copied ? '已复制诗笺' : '复制诗句' }}
          </button>
          <p v-if="copyError" class="poem-action-message" role="status">{{ copyError }}</p>
        </section>

        <nav class="poem-nav" aria-label="切换诗词">
          <button type="button" class="poem-nav__btn" :disabled="navigating || !poem.navigation.previousId" @click="go(-1)">
            <ChevronLeft :size="16" /> 上一首
          </button>
          <button type="button" class="poem-nav__btn" :class="{ 'is-active': speaking }" :disabled="!canSpeak || navigating" @click="toggleSpeak">
            <VolumeX v-if="speaking" :size="16" /><Volume2 v-else :size="16" />
            {{ speaking ? '停止' : '朗读' }}
          </button>
          <button type="button" class="poem-nav__btn" :disabled="navigating" @click="goRandom">
            <Shuffle :size="15" /> 随机
          </button>
          <button type="button" class="poem-nav__btn" :disabled="navigating || !poem.navigation.nextId" @click="go(1)">
            下一首 <ChevronRight :size="16" />
          </button>
        </nav>
        <p v-if="navigationError" class="poem-action-message" role="alert">{{ navigationError }}</p>
        <p class="poem-page__hints">← → 切换&ensp;·&ensp;Space 朗读&ensp;·&ensp;Esc 返回</p>
      </template>

      <div v-else class="poem-missing">
        <p class="poem-missing__title">未寻得这首诗</p>
        <p class="poem-missing__desc">这张诗笺不在选读之中，不如回首页另寻一首。</p>
        <RouterLink to="/" class="poem-missing__link">返回首页</RouterLink>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Shuffle, Volume2, VolumeX } from 'lucide-vue-next'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import { ApiError, errorMessage, getPoem, getRandomPoem, isAbortError } from '../services/poemApi'
import type { PoemDetail } from '../types/poem'

const route = useRoute()
const router = useRouter()

const poem = ref<PoemDetail | null>(null)
const loading = ref(true)
const error = ref('')
const navigating = ref(false)
const navigationError = ref('')
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
const longPoem = computed(() => {
  const lengths = poem.value?.lines.map((line) => Array.from(line).length) ?? []
  // Only compact poems fit the vertical card, even when a long lyric has short stanzas.
  return lengths.length > 8
    || lengths.some((length) => length > 20)
    || lengths.reduce((total, length) => total + length, 0) > 80
})
const sourceUrl = computed(() => {
  if (!poem.value?.sourceUrl) return null
  try {
    const url = new URL(poem.value.sourceUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
})
let controller: AbortController | null = null
let randomController: AbortController | null = null
let requestId = 0
let copyTimer: ReturnType<typeof window.setTimeout> | undefined

const titleParts = computed(() => (poem.value ? poem.value.title.split('·') : []))
const titleMain = computed(() => titleParts.value[0] ?? '')
const titleSub = computed(() => titleParts.value.slice(1).join('·'))

const copied = ref(false)
const speaking = ref(false)
const copyError = ref('')

async function loadPoem() {
  controller?.abort()
  randomController?.abort()
  const current = ++requestId
  controller = new AbortController()
  stopSpeak()
  window.clearTimeout(copyTimer)
  copied.value = false
  copyError.value = ''
  navigationError.value = ''
  navigating.value = false
  poem.value = null
  error.value = ''
  loading.value = true
  const id = typeof route.params.id === 'string' ? route.params.id : ''
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    loading.value = false
    return
  }
  try {
    const result = await getPoem(id, controller.signal)
    if (current !== requestId) return
    poem.value = result
    document.title = `诗境 · 《${result.title}》${result.authorName}`
  } catch (cause) {
    if (current !== requestId || isAbortError(cause)) return
    if (!(cause instanceof ApiError && (cause.status === 404 || cause.status === 400))) {
      error.value = errorMessage(cause)
    }
  } finally {
    if (current === requestId) loading.value = false
  }
}

async function go(delta: number) {
  if (loading.value || navigating.value || !poem.value) return
  const id = delta < 0 ? poem.value.navigation.previousId : poem.value.navigation.nextId
  if (!id) return
  navigating.value = true
  navigationError.value = ''
  try {
    await router.push({ path: `/poem/${id}` })
  } catch {
    navigationError.value = '暂时无法切换诗笺，请稍后重试。'
  } finally {
    navigating.value = false
  }
}

async function goRandom() {
  if (loading.value || navigating.value || !poem.value) return
  const from = poem.value.id
  randomController?.abort()
  const current = new AbortController()
  randomController = current
  navigating.value = true
  navigationError.value = ''
  try {
    const next = await getRandomPoem(from, current.signal)
    if (!current.signal.aborted && poem.value?.id === from) {
      await router.push({ path: `/poem/${next.id}` })
    }
  } catch (cause) {
    if (isAbortError(cause) || current.signal.aborted) return
    navigationError.value = cause instanceof ApiError && cause.status === 404
      ? '暂时没有其他可选读的诗词。'
      : errorMessage(cause)
  } finally {
    if (randomController === current) navigating.value = false
  }
}

function stopSpeak() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  speaking.value = false
}

function toggleSpeak() {
  if (!poem.value || loading.value || navigating.value || !canSpeak) return
  if (speaking.value) {
    stopSpeak()
    return
  }
  const utter = new SpeechSynthesisUtterance(
    `${poem.value.title}。${poem.value.authorName}。${poem.value.lines.join('')}`,
  )
  utter.lang = 'zh-CN'
  utter.rate = 0.85
  utter.onend = () => { speaking.value = false }
  utter.onerror = () => { speaking.value = false }
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
  speaking.value = true
}

async function copyPoem() {
  if (!poem.value) return
  const currentId = poem.value.id
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(
      `${poem.value.title} · ${poem.value.authorName}\n${poem.value.lines.join('\n')}`,
    )
    if (poem.value?.id !== currentId) return
    copied.value = true
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => { copied.value = false }, 1800)
  } catch {
    if (poem.value?.id !== currentId) return
    copied.value = false
    copyError.value = '暂时无法复制，请稍后重试。'
  }
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    void go(-1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    void go(1)
  } else if (e.key === 'Escape') router.push('/')
  else if (e.key === ' ' && target?.tagName !== 'BUTTON') {
    e.preventDefault()
    toggleSpeak()
  }
}

watch(() => route.params.id, () => { void loadPoem() }, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  requestId += 1
  controller?.abort()
  randomController?.abort()
  window.clearTimeout(copyTimer)
  poem.value = null
  window.removeEventListener('keydown', onKeydown)
  stopSpeak()
})
</script>

<style scoped>
.poem-page {
  display: flex;
  min-height: 100vh;
  min-height: 100svh;
  flex-direction: column;
}

.poem-page :deep(.site-footer) {
  position: relative;
}

.poem-page :deep(.site-footer::before) {
  position: absolute;
  top: 0;
  left: 50%;
  width: 100vw;
  height: 1px;
  background: color-mix(in srgb, var(--border), transparent 50%);
  content: '';
  transform: translateX(-50%);
}

.poem-page__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  padding: 100px 20px 40px;
}

.poem-page__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 13px;
  text-decoration: none;
  transition: color .2s ease;
}
.poem-page__back:hover { color: var(--primary); }

/* ---------- 页首：题名 ---------- */
.poem-head {
  margin-top: 50px;
  text-align: center;
}
.poem-head__eyebrow {
  margin: 0;
  color: color-mix(in srgb, var(--primary), transparent 25%);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: .3em;
}
.poem-head__title {
  overflow-wrap: anywhere;
  margin: 18px 0 0;
  font-family: var(--font-serif);
  font-size: clamp(32px, 5.5vw, 50px);
  font-weight: 500;
  letter-spacing: .08em;
  line-height: 1.3;
}
.poem-head__subtitle {
  color: var(--muted-foreground);
  font-size: .55em;
  letter-spacing: .12em;
}
.poem-head__author {
  margin: 14px 0 0;
  color: var(--muted-foreground);
  font-family: var(--font-serif);
  font-size: 15px;
  letter-spacing: .2em;
}
.poem-head__tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
}
.poem-tag {
  border: 1px solid var(--border);
  padding: 3px 10px;
  color: var(--muted-foreground);
  font-family: var(--font-serif);
  font-size: 12px;
  letter-spacing: .15em;
}

/* ---------- 竖排诗文卡片 ---------- */
.verse-card {
  width: 100%;
  min-width: 0;
  margin: 30px auto 0;
  max-width: 880px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  padding: 40px 32px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.verse-card::-webkit-scrollbar { height: 6px; }
.verse-card::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--border); }
.verse-vertical {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.verse-line {
  margin: 0;
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: 20px;
  letter-spacing: .13em;
  line-height: 1.9;
  overflow-wrap: anywhere;
  text-align: center;
}

@media (min-width: 768px) {
  .verse-card {
    display: flex;
    flex-direction: column;
    min-height: 280px;
    padding: 30px 50px;
  }
  .verse-card:not(.verse-card--long) {
    /* Keep any overflow reachable from the right-hand start of vertical text. */
    direction: rtl;
  }
  .verse-vertical {
    display: block;
    flex: none;
    direction: ltr;
    writing-mode: vertical-rl;
    text-orientation: upright;
    width: max-content;
    max-width: none;
    height: max-content;
    margin: 0 auto;
  }
  .verse-line {
    font-size: 23px;
    letter-spacing: .18em;
    line-height: 2.1;
    text-align: start;
    padding-left: 30px;
  }
  .verse-line:last-child { padding-left: 0; }
}

.verse-card--long .verse-vertical {
  display: flex;
  width: 100%;
  height: auto;
  max-width: none;
  align-items: stretch;
  writing-mode: horizontal-tb;
}
.verse-card--long .verse-line {
  padding: 0;
  overflow-wrap: anywhere;
  font-size: 20px;
  line-height: 2;
  text-align: center;
}

/* ---------- 作者与来源 ---------- */
.poem-note {
  width: 100%;
  max-width: 640px;
  margin: 28px auto 0;
}
.poem-note__label {
  margin: 0;
  color: color-mix(in srgb, var(--primary), transparent 25%);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: .3em;
}
.poem-note__text {
  margin: 12px 0 0;
  color: var(--muted-foreground);
  font-size: 15px;
  line-height: 1.9;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.poem-note__source {
  margin-top: 18px;
  overflow-wrap: anywhere;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.8;
}
.poem-note__source a { color: inherit; text-underline-offset: 3px; }
.poem-note__source a:hover { color: var(--primary); }
.poem-note__copy {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  padding: 0 0 6px;
  color: var(--primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
.poem-note__copy:hover { border-color: var(--primary); }

/* ---------- 底部控制 ---------- */
.poem-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 25px;
}
.poem-nav__btn {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  padding: 0 18px;
  color: var(--foreground);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  transition: border-color .2s ease, color .2s ease;
}
.poem-nav__btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.poem-nav__btn:disabled { opacity: .4; cursor: default; }
.poem-nav__btn.is-active { border-color: var(--primary); color: var(--primary); }
.poem-action-message {
  margin-top: 14px;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}
.poem-page__hints {
  margin: 18px 0 0;
  text-align: center;
  color: color-mix(in srgb, var(--muted-foreground), transparent 30%);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: .08em;
}

.poem-missing {
  padding: 120px 0 60px;
  text-align: center;
}
.poem-missing__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 26px;
  letter-spacing: .1em;
}
.poem-missing__desc {
  margin: 14px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
}
.poem-missing__link {
  display: inline-block;
  margin-top: 28px;
  border: 0;
  border-bottom: 1px solid var(--primary);
  background: transparent;
  padding-bottom: 4px;
  color: var(--primary);
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
}
</style>
