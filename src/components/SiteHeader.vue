<template>
<header class="site-header">
      <div class="site-header__inner pv-container">
        <a href="#top" class="site-brand" aria-label="诗境首页" @click.prevent="navigateToSection('top')">
          <span class="site-brand__mark">诗</span>
          <span class="site-brand__copy">
            <span class="site-brand__title">诗境</span>
            <span class="site-brand__subtitle">PoetVerse</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="主导航">
          <a class="site-nav__link"  @click.prevent="navigateToSection('chronicle')">朝代寻踪</a>
          <a class="site-nav__link"  @click.prevent="navigateToSection('collection')">诗词选读</a>
          <a class="site-nav__link"  @click.prevent="navigateToSection('about')">关于诗境</a>
        </nav>
        <div class="site-header__actions">
          <ThemeToggle />
          <a class="site-start-link" @click.prevent="navigateToSection('collection')">
            开始寻诗 <ArrowRight :size="15" class="site-start-link__icon" />
          </a>
        </div>
      </div>
</header>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'
import { scrollToId } from '../utils/scroll'
import ThemeToggle from './ThemeToggle.vue'

const route = useRoute()
const router = useRouter()

async function navigateToSection(id: string) {
  if (route.path !== '/') {
    await router.push({
      path: '/',
      hash: '',
    })
    await nextTick()
  }

  scrollToId(id)
}
</script>

<style scoped>
.site-header { position: fixed; inset: 0 0 auto; z-index: 50; border-bottom: 1px solid color-mix(in srgb, var(--border), transparent 50%); background: color-mix(in srgb, var(--background), transparent 10%); backdrop-filter: blur(12px); }
.site-header__inner { display: flex; min-height: 60px; align-items: center; justify-content: space-between; padding: 10px 20px; }
.site-brand { display: flex; align-items: center; gap: 12px; color: var(--foreground); text-decoration: none; }
.site-brand__mark { display: grid; width: 45px; height: 45px; place-items: center; border: 1px solid color-mix(in srgb, var(--primary), transparent 55%); color: var(--primary); font-family: var(--font-serif); font-size: 30px; line-height: 1; }
.site-brand__copy { display: flex; flex-direction: column; }
.site-brand__title { font-family: var(--font-serif); font-size: 18px; letter-spacing: .18em; line-height: 1.4; }
.site-brand__subtitle { color: var(--muted-foreground); font-family: var(--font-mono); font-size: 9px; letter-spacing: .2em; line-height: 1.4; text-transform: uppercase; }
.site-nav { display: none; align-items: center; gap: 36px; color: var(--muted-foreground); font-size: 14px; }
.site-nav__link { color: inherit; text-decoration: none; transition: color .2s ease; }
.site-nav__link:hover { color: var(--primary); }
.site-header__actions { display: flex; align-items: center; gap: 16px; }
.site-start-link { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid color-mix(in srgb, var(--primary), transparent 60%); padding-bottom: 4px; color: var(--primary); font-size: 14px; text-decoration: none; transition: border-color .2s ease; }
.site-start-link:hover { border-color: var(--primary); }
@media (min-width: 768px) {

  .site-nav { display: flex; }
}
</style>
