<template>
  <div class="poet-page not-found-page">
    <SiteHeader />
    <main class="not-found__main">
      <span class="not-found__glyph" aria-hidden="true">迷</span>
      <div class="not-found__inner">
        <p class="section-eyebrow not-found__eyebrow"><span class="section-eyebrow__rule" />404 · 迷途</p>
        <h1 class="not-found__title">暂未寻得此页</h1>
        <div class="not-found__poem">
          <p class="not-found__meta">《游山西村》宋 · 陆游</p>
          <p class="not-found__lines">山重水复疑无路，<br />柳暗花明又一村。</p>
        </div>
        <p class="not-found__note">此处并无诗笺——不如转身，柳暗花明处，自有另一村。</p>
        <div class="not-found__actions">
          <RouterLink to="/" class="not-found__button not-found__button--primary">返回首页</RouterLink>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
</script>

<style scoped>
.not-found-page {
  display: flex;
  min-height: 100vh;
  min-height: 100svh;
  flex-direction: column;
}

.not-found-page :deep(.site-footer) {
  position: relative;
}

.not-found-page :deep(.site-footer::before) {
  position: absolute;
  top: 0;
  left: 50%;
  width: 100vw;
  height: 1px;
  background: color-mix(in srgb, var(--border), transparent 50%);
  content: '';
  transform: translateX(-50%);
}

.not-found__main {
  position: relative;
  display: grid;
  flex: 1;
  place-items: center;
  overflow: clip;
  padding: 120px 20px 70px;
}

.not-found__glyph {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 0;
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: clamp(280px, 46vw, 560px);
  line-height: 1;
  opacity: 0.05;
  pointer-events: none;
  transform: translate(-50%, -54%);
  user-select: none;
}

.not-found__inner {
  position: relative;
  z-index: 1;
  display: flex;
  max-width: 560px;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: not-found-fade 0.45s ease-out both;
}

.not-found__eyebrow {
  justify-content: center;
  margin-bottom: 28px;
}

.not-found__title {
  margin: 0 0 8px;
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: clamp(40px, 7vw, 68px);
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.25;
}

.not-found__poem {
  margin: 28px 0 8px;
  padding: 28px 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.not-found__meta {
  margin: 0 0 14px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.22em;
}

.not-found__lines {
  margin: 0;
  color: var(--card-foreground);
  font-family: var(--font-serif);
  font-size: clamp(20px, 3.4vw, 27px);
  letter-spacing: 0.32em;
  line-height: 2.1;
  text-indent: 0.32em;
}

.not-found__note {
  margin: 20px 0 0;
  color: var(--muted-foreground);
  font-family: var(--font-serif);
  font-size: 15px;
  letter-spacing: 0.06em;
  line-height: 1.9;
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 36px;
}

.not-found__button {
  display: inline-flex;
  min-height: 3rem;
  align-items: center;
  padding: 0 1.75rem;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--card);
  color: var(--foreground);
  font-size: 0.875rem;
  letter-spacing: 0.12em;
  text-decoration: none;
  transition: border-color 180ms ease, background-color 180ms ease, transform 180ms ease;
}

.not-found__button:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.not-found__button--primary {
  border: 0;
  background: var(--primary);
  color: var(--primary-foreground);
}

.not-found__button--primary:hover {
  border: 0;
  box-shadow: var(--shadow-md);
}

@keyframes not-found-fade {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-found__inner {
    animation-duration: 1ms;
  }
}
</style>
