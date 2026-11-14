<template>
<section ref="heroRef" id="top" class="hero-section">
      <img class="hero-section__image" src="/images/01.webp" alt="" />
      <div class="hero-section__gradient hero-section__gradient--right" />
      <div class="hero-section__gradient hero-section__gradient--bottom" />
      <div class="hero-section__inner pv-container">
        <div class="hero-copy">
          <p class="section-eyebrow"><span class="section-eyebrow__rule" />古典诗词 · 一卷人间</p>
          <h1 class="hero-title">山河入诗<br /><span>心事成词</span></h1>
          <p class="hero-description">循着朝代、格律与心境，走近那些写山水、月色与离别的人。让一首古诗，成为今日的停留。</p>
          <div class="hero-actions">
            <el-button tag="a" href="#collection" type="primary" class="poet-hero-button" @click.prevent="scrollToId('collection')">读一首诗 <ArrowRight :size="16" class="hero-button__icon" /></el-button>
            <span class="hero-quote">“诗，可以兴，可以观。”</span>
          </div>
          <div
            v-if="featuredPoem"
            class="hero-mobile-feature"
            aria-live="polite"
            aria-atomic="true"
            @pointerdown="startFeatureSwipe"
            @pointerup="finishFeatureSwipe"
            @pointercancel="cancelFeatureSwipe"
            @lostpointercapture="cancelFeatureSwipe"
          >
            <p class="hero-mobile-feature__meta">{{ featuredPoem.dynasty }} · {{ featuredPoem.scene }} · {{ featuredPoem.form }}</p>
            <p class="hero-mobile-feature__title">{{ featuredPoem.title }}<span>{{ featuredPoem.authorName }}</span></p>
            <div class="hero-mobile-feature__lines">
              <p v-for="(line, index) in previewLines" :key="index">{{ line }}</p>
            </div>
          </div>
          <div v-else class="hero-mobile-feature hero-feature-status" :role="error ? 'alert' : 'status'">
            <p>{{ featureStatus }}</p>
            <el-button v-if="error" text class="poet-clear-button" @click="loadFeatured">重新读取</el-button>
          </div>
        </div>

        <div class="hero-card-area">
          <div class="hero-card">
            <div class="hero-card__inset" />
            <div v-if="featuredPoem" class="hero-card__content">
              <div class="hero-card__copy">
                <h2 class="hero-card__title">{{ featuredPoem.title }}</h2>
                <p class="hero-card__author">{{ featuredPoem.authorName }} {{ featuredPoem.form }}</p>
                <div class="hero-card__lines"><p v-for="(line, index) in previewLines" :key="index">{{ line }}</p></div>
                <p v-if="featuredPoem.tags.length" class="hero-card__note">{{ featuredPoem.tags.join(' · ') }}</p>
              </div>
              <div aria-hidden="true" class="hero-card__glyph">境</div>
            </div>
            <div v-else class="hero-feature-status" :role="error ? 'alert' : 'status'">
              <p>{{ featureStatus }}</p>
              <el-button v-if="error" text class="poet-clear-button" @click="loadFeatured">重新读取</el-button>
            </div>
            <span class="hero-card__caption">A POEM, A LANDSCAPE</span>
          </div>
        </div>

        <div class="hero-tabs">
          <button
            v-for="(poem, index) in featuredPoems"
            :key="poem.id"
            type="button"
            :class="['hero-tab', { 'is-active': activeFeature === index }]"
            :aria-pressed="activeFeature === index"
            :aria-label="`${poem.scene}：${poem.title}`"
            :title="`${poem.scene} · ${poem.title}`"
            @click="activeFeature = index"
          >
            {{ poem.title }}
          </button>
          <span class="hero-scroll-hint"><ArrowDown :size="12" /> 向下漫游</span>
        </div>
      </div>
      <span class="hero-index">山水长卷</span>
    </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDown, ArrowRight } from 'lucide-vue-next'
import { errorMessage, getFeaturedPoems, isAbortError } from '../services/poemApi'
import type { FeaturedPoem } from '../types/poem'
import { scrollToId } from '../utils/scroll'

const activeFeature = ref(0)
const heroRef = ref<HTMLElement | null>(null)
const featuredPoems = ref<FeaturedPoem[]>([])
const loading = ref(true)
const error = ref('')
const featuredPoem = computed(() => featuredPoems.value[activeFeature.value] ?? null)
const featureStatus = computed(() => loading.value ? '正在展卷……' : error.value || '暂无可选读的诗词')
const previewLines = computed(() => {
  const sentences = featuredPoem.value?.content.match(/[^，。！？；\r\n]+[，。！？；]?/gu) ?? []
  return sentences.slice(0, 4).map((line) => line.length > 16 ? `${line.slice(0, 15)}…` : line)
})
let controller: AbortController | null = null
let requestId = 0
let desktopLayout: MediaQueryList | null = null
let featureSwipe: { pointerId: number; x: number; y: number } | null = null

async function loadFeatured() {
  controller?.abort()
  const current = ++requestId
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const result = await getFeaturedPoems(controller.signal)
    if (current !== requestId) return
    featuredPoems.value = result.slice(0, 5)
    activeFeature.value = 0
    onScroll()
  } catch (cause) {
    if (current !== requestId || isAbortError(cause)) return
    error.value = errorMessage(cause)
  } finally {
    if (current === requestId) loading.value = false
  }
}

function startFeatureSwipe(event: PointerEvent) {
  if (!event.isPrimary || event.pointerType === 'mouse' || desktopLayout?.matches || featuredPoems.value.length < 2) {
    featureSwipe = null
    return
  }
  featureSwipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
}

function finishFeatureSwipe(event: PointerEvent) {
  const start = featureSwipe
  featureSwipe = null
  if (!start || start.pointerId !== event.pointerId || desktopLayout?.matches) return

  const deltaX = event.clientX - start.x
  const deltaY = event.clientY - start.y
  const count = featuredPoems.value.length
  if (count < 2 || Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return

  activeFeature.value = (activeFeature.value + (deltaX < 0 ? 1 : -1) + count) % count
}

function cancelFeatureSwipe() {
  featureSwipe = null
}

function onScroll() {
  if (!desktopLayout?.matches || !heroRef.value) return
  const rect = heroRef.value.getBoundingClientRect()
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return
  const progress = Math.max(0, Math.min(0.999, -rect.top / Math.max(1, rect.height * 0.7)))
  const count = featuredPoems.value.length
  if (count === 0) return
  const next = Math.min(count - 1, Math.floor(progress * count))
  if (activeFeature.value !== next) activeFeature.value = next
}

onMounted(() => {
  desktopLayout = window.matchMedia('(min-width: 1024px)')
  void loadFeatured()
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  requestId += 1
  controller?.abort()
  cancelFeatureSwipe()
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.hero-section { position: relative; isolation: isolate; display: flex; min-height: 660px; margin-top: 65px; align-items: center; }
.hero-section__image { position: absolute; inset: 0 0 0 auto; z-index: -20; width: 100%; height: 100%; object-fit: cover; object-position: 58% center; opacity: .45; }
.hero-section__gradient { position: absolute; inset: 0; z-index: -10; pointer-events: none; }
.hero-section__gradient--right { background: linear-gradient(to right, var(--background), color-mix(in srgb, var(--background), transparent 10%), color-mix(in srgb, var(--background), transparent 85%)); }
.hero-section__gradient--bottom { background: linear-gradient(to top, color-mix(in srgb, var(--background), transparent 15%), transparent, color-mix(in srgb, var(--background), transparent 80%)); }
.hero-section__inner { display: grid; grid-template-columns: 1fr; align-items: center; gap: 48px; padding: 48px 20px; }
.hero-copy { max-width: 600px; animation: poet-fade-in .3s ease-in-out; }
.hero-title { margin: 0; color: var(--foreground); font-family: var(--font-serif); font-size: clamp(3.5rem, 8vw, 7rem); font-weight: 400; letter-spacing: .08em; line-height: 1.16; }
.hero-title span { margin-left: .4em; color: var(--primary); }
.hero-description { max-width: 390px; margin: 28px 0 0; color: var(--muted-foreground); font-size: 14px; line-height: 2; }
.hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; margin-top: 36px; }
.hero-quote { color: var(--muted-foreground); font-family: var(--font-serif); font-size: 14px; font-style: italic; }
.hero-mobile-feature { min-height: 12rem; margin-top: 36px; border-left: 1px solid color-mix(in srgb, var(--primary), transparent 55%); padding-left: 16px; touch-action: pan-y pinch-zoom; }
.hero-mobile-feature__title { min-height: 2.8em; margin: 8px 0 0; font-family: var(--font-serif); font-size: 18px; letter-spacing: .12em; line-height: 1.4; }
.hero-mobile-feature__title span { margin-left: 12px; color: var(--muted-foreground); font-size: 12px; }
.hero-mobile-feature__lines { margin-top: 8px; color: var(--muted-foreground); font-family: var(--font-serif); font-size: 14px; letter-spacing: .08em; line-height: 1.75; }
.hero-mobile-feature__lines p { margin: 0; }
.hero-feature-status { position: relative; color: var(--muted-foreground); font-size: 14px; line-height: 1.9; }
.hero-card-area { display: none; min-height: 400px; align-items: center; justify-content: flex-end; }
.hero-card { position: relative; display: flex; width: min(100%, 460px); min-height: 430px; margin-right: 6%; align-items: center; justify-content: center; border: 1px solid color-mix(in srgb, var(--foreground), transparent 80%); background: color-mix(in srgb, var(--background), transparent 90%); padding: 32px; backdrop-filter: blur(1px); }
.hero-card__inset { position: absolute; inset: 12px; border: 1px solid color-mix(in srgb, var(--foreground), transparent 85%); }
.hero-card__content { position: relative; display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 24px; padding: 0 20px; }
.hero-card__copy { min-width: 0; max-width: 260px; }
.hero-card__title { display: -webkit-box; overflow: hidden; margin: 0; overflow-wrap: anywhere; font-family: var(--font-serif); font-size: 30px; font-weight: 400; letter-spacing: .15em; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.hero-card__author { margin: 8px 0 0; color: var(--muted-foreground); font-size: 12px; letter-spacing: .2em; }
.hero-card__lines { display: flex; flex-direction: column; gap: 8px; margin-top: 32px; font-family: var(--font-serif); font-size: 18px; letter-spacing: .15em; line-height: 2; }
.hero-card__lines p { margin: 0; }
.hero-card__note { max-width: 230px; margin: 24px 0 0; border-left: 1px solid color-mix(in srgb, var(--primary), transparent 50%); padding-left: 12px; color: var(--muted-foreground); font-size: 12px; line-height: 1.8; }
.hero-card__glyph { flex: 0 0 auto; color: color-mix(in srgb, var(--primary), transparent 25%); font-family: var(--font-serif); font-size: 80px; line-height: 1; user-select: none; }
.hero-card__caption { position: absolute; right: 32px; bottom: -16px; background: var(--background); padding: 0 12px; color: var(--muted-foreground); font-family: var(--font-mono); font-size: 9px; letter-spacing: .18em; }
.hero-tabs { display: flex; min-width: 0; max-width: 100%; flex-wrap: wrap; align-items: center; gap: 12px; }
.hero-tab { min-width: 0; min-height: 44px; max-width: min(180px, 100%); overflow: hidden; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--foreground), transparent 80%); background: transparent; padding: 0 8px; color: var(--muted-foreground); cursor: pointer; font-family: inherit; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; transition: color .2s ease, border-color .2s ease; }
.hero-tab:hover, .hero-tab.is-active { color: var(--primary); }
.hero-tab.is-active { border-color: var(--primary); }
.hero-scroll-hint { display: none; align-items: center; gap: 8px; margin-left: 8px; color: var(--muted-foreground); font-family: var(--font-mono); font-size: 9px; letter-spacing: .14em; }
.hero-index { display: none; position: absolute; right: 32px; bottom: 36px; color: color-mix(in srgb, var(--foreground), transparent 40%); font-family: var(--font-mono); font-size: 9px; letter-spacing: .18em; }

@keyframes poet-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (min-width: 640px) {
  .hero-section { min-height: 720px; }
  .hero-section__image { width: 72%; opacity: .8; }
  .hero-title { font-size: clamp(3.5rem, 8vw, 7rem); }
}
@media (min-width: 1024px) {
  .hero-section__image { width: 67%; }
  .hero-section__inner { grid-template-columns: .95fr 1.05fr; }
  .hero-card-area { display: flex; }
  .hero-mobile-feature { display: none; }
  .hero-tabs { position: absolute; right: 20px; bottom: 48px; left: max(64px, calc((100vw - var(--page-container-max-width)) / 2 + 64px)); }
  .hero-scroll-hint, .hero-index { display: flex; }
  .hero-index { display: block; }
}
@media (max-width: 639px) {

  .hero-title { font-size: clamp(3.5rem, 15vw, 5.5rem); }
}
</style>
