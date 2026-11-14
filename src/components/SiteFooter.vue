<template>
  <footer class="site-footer pv-container">
    <span class="site-footer__brand"><span>诗境</span><span class="site-footer__brand-english">PoetVerse</span></span>
    <span>在字里行间，和古人相逢。</span>
  </footer>
</template>

<style scoped>
.site-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 20px;
  color: var(--muted-foreground);
  font-size: 11px;
  white-space: nowrap;
}

.site-footer__brand {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5em;
  font-family: var(--font-serif);
  letter-spacing: 0.18em;
}

.site-footer__brand-english {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  line-height: 1.4;
  text-transform: uppercase;
}

@media (min-width: 640px) {
  .site-footer {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

@media (min-width: 1024px) {
  .site-footer {
    padding-right: 20px;
    padding-left: 20px;
  }
}
</style>
