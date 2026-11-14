import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import DashboardPage from './pages/DashboardPage.vue'
import PoemPage from './pages/PoemPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'

const router = createRouter({
  // Web history keeps clean URLs (e.g. /app). If you later deploy to a
  // pure static host without SPA fallback rewrites, deep-link refreshes
  // on /app will 404 there — add the host's fallback config at that point.
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage, meta: { title: '诗境 PoetVerse｜循朝代与心境，读一首古诗' } },
    { path: '/app', component: DashboardPage, meta: { title: '工作区 · 诗境 PoetVerse' } },
    { path: '/poem/:id', component: PoemPage, meta: { title: '诗笺 · 诗境 PoetVerse' } },
    { path: '/:pathMatch(.*)*', component: NotFoundPage, meta: { title: '迷途 · 诗境 PoetVerse' } },
  ],
})

router.afterEach((to) => {
  if (typeof document !== 'undefined' && typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
