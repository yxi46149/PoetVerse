<template>
<section id="chronicle" class="chronicle-section">
      <div class="chronicle-section__inner pv-container">
        <div class="chronicle-intro">
          <p class="section-eyebrow">01 / 朝代寻踪</p>
          <h2 class="chronicle-title pv-section-title">从盛唐的山月，<br />走到两宋的清词。</h2>
          <p class="chronicle-description pv-section-desc">一条轻轻展开的时间线，带你循着诗人的脚步，遇见不同年代的声息。</p>
        </div>
        <div v-if="timeline.length" class="timeline" :style="{ '--timeline-count': timeline.length }">
          <div class="timeline__line" />
          <button
            v-for="([name, caption], index) in timeline"
            :key="name"
            type="button"
            :class="['timeline__item', { 'is-active': name === dynasty }]"
            :aria-pressed="name === dynasty"
            @click="selectDynasty(name)"
          >
            <span class="timeline__number">{{ index + 1 }}</span>
            <span class="timeline__name">{{ name }}</span>
            <span class="timeline__caption">{{ caption }}</span>
          </button>
        </div>
        <div v-else class="chronicle-status" :role="error ? 'alert' : 'status'">
          <p>{{ loading ? '正在读取朝代……' : error || '暂无可选读的朝代' }}</p>
          <el-button v-if="error" text class="poet-clear-button" @click="reload">重新读取</el-button>
        </div>
      </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCatalog } from '../composables/useCatalog'

defineProps<{ dynasty: string }>()

const { catalog, loading, error, reload } = useCatalog()
const captions: Record<string, string> = {
  先秦: '风雅之源',
  汉末: '古意初成',
  唐: '诗意万千',
  五代: '花间新声',
  宋: '词心婉转',
  元: '曲韵悠长',
  清: '余音入梦',
}
const timeline = computed(() => (catalog.value?.dynasties ?? [])
  .map((name) => [name, captions[name] ?? '诗意流传']))

const emit = defineEmits<{ (event: 'select-dynasty', name: string): void }>()

function selectDynasty(name: string) {
  emit('select-dynasty', name)
}
</script>

<style scoped>
.chronicle-section { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--secondary), transparent 55%); }
.chronicle-section__inner { display: grid; gap: 40px; padding: 48px 20px; }
.chronicle-title { font-size: 30px; line-height: 1.75; }
.chronicle-description { max-width: 384px; }
.chronicle-status { color: var(--muted-foreground); font-size: 14px; line-height: 1.8; }
.timeline { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.timeline__line { display: none; position: absolute; top: 18px; right: 8%; left: 8%; height: 1px; background: var(--border); }
.timeline__item { position: relative; display: flex; min-height: 96px; flex-direction: column; align-items: center; gap: 12px; border: 0; background: transparent; color: var(--muted-foreground); cursor: pointer; font-family: inherit; text-align: center; }
.timeline__number { z-index: 1; display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: var(--background); font-size: 12px; transition: all .2s ease; }
.timeline__name { color: var(--foreground); font-family: var(--font-serif); font-size: 18px; letter-spacing: .12em; }
.timeline__caption { display: block; color: var(--muted-foreground); font-size: 11px; line-height: 1.5; }
.timeline__item:hover .timeline__number, .timeline__item.is-active .timeline__number { border-color: var(--primary); color: var(--primary); }
.timeline__item.is-active .timeline__number { background: var(--primary); color: var(--primary-foreground); }
.timeline__item:hover .timeline__name { color: var(--primary); }
@media (max-width: 639px) {

  .timeline__item { min-height: 112px; gap: 8px; }
  .timeline__caption { font-size: 12px; }
}
@media (min-width: 640px) {
  .timeline { grid-template-columns: repeat(var(--timeline-count), minmax(0, 1fr)); gap: 16px; }
  .timeline__line { display: block; }
  .timeline__caption { display: block; }
}
@media (min-width: 1024px) {
  .chronicle-section__inner { grid-template-columns: .7fr 1.3fr; align-items: center; padding-top: 80px; padding-bottom: 80px; }
}
</style>
