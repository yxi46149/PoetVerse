<template>
<section id="about" class="about-section">
      <div class="about-section__glyph" aria-hidden="true">诗</div>
      <div class="about-section__inner">
        <div class="about-copy">
          <p class="section-eyebrow">03 / 关于诗境</p>
          <p class="about-title">隔着千年，<br class="about-title__break" />仍有一句诗，<span>恰好说中此刻。</span></p>
          <p class="about-description">诗境是一间持续收录的古典诗词小馆。从《诗经》《楚辞》到唐诗宋词，每一篇都保留作品来源；你可以从朝代、格律或心情开始，沿着自己的路径读下去。</p>
        </div>
        <a href="#collection" class="about-link" @click.prevent="scrollToId('collection')">再寻一首诗 <ArrowRight :size="16" class="about-link__icon" /></a>
      </div>
    </section>

    <SiteFooter />
</template>

<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import SiteFooter from './SiteFooter.vue'
import { scrollToId } from '../utils/scroll'
</script>

<style scoped>
.about-section { position: relative; overflow: hidden; background: var(--about-background); color: var(--about-foreground); }
.about-section__glyph { position: absolute; top: -80px; right: -80px; color: color-mix(in srgb, var(--primary), transparent 96.5%); font-family: var(--font-serif); font-size: 448px; line-height: 1; user-select: none; }
.about-section__inner { position: relative; display: grid; max-width: var(--page-container-max-width); margin: 0 auto; align-items: end; gap: 40px; padding: 48px 20px; }
.about-title { margin: 24px 0 0; font-family: var(--font-serif); font-size: 30px; letter-spacing: .1em; line-height: 1.8; }
.about-title span { color: var(--primary); }
.about-title__break { display: initial; }
.about-description { max-width: 512px; margin: 20px 0 0; color: var(--about-muted); font-size: 14px; line-height: 1.75; }
.about-link { display: inline-flex; min-height: 48px; align-items: center; gap: 16px; align-self: start; border-bottom: 1px solid color-mix(in srgb, var(--primary), transparent 50%); padding-bottom: 8px; color: var(--primary); font-size: 14px; text-decoration: none; transition: border-color .2s ease; }
.about-link:hover { border-color: var(--primary); }

@media (min-width: 1024px) {
  .about-section__inner { grid-template-columns: 1fr auto; padding-top: 80px; padding-bottom: 80px; }
  .about-title { font-size: 36px; }
  .about-title__break { display: none; }
}
</style>
