<template>
  <div class="dashboard-page">
    <aside
      id="dashboard-sidebar"
      :class="['dashboard-sidebar', { 'is-mobile-open': mobileMenuOpen }]"
      @click.self="closeMobileMenu"
    >
      <div :class="['dashboard-sidebar__panel', { 'is-collapsed': collapsed && !mobileMenuOpen }]">
        <div :class="['dashboard-sidebar__header', { 'is-collapsed': collapsed && !mobileMenuOpen }]">
          <template v-if="!collapsed || mobileMenuOpen">
            <div class="dashboard-sidebar__mark">诗</div>
            <span class="dashboard-sidebar__name">诗境工作区</span>
          </template>
          <el-button
            text
            class="poet-sidebar-action"
            :aria-label="mobileMenuOpen ? '关闭菜单' : collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="mobileMenuOpen ? closeMobileMenu() : toggleSidebar()"
          >
            <X v-if="mobileMenuOpen" class="sidebar-toggle-icon" />
            <PanelLeft v-else :class="['sidebar-toggle-icon', { 'is-collapsed': collapsed }]" />
          </el-button>
        </div>

        <div class="dashboard-nav">
          <RouterLink
            to="/app"
            :class="['dashboard-nav__link', { 'is-collapsed': collapsed && !mobileMenuOpen, 'is-active': true }]"
            @click="closeMobileMenu"
          >
            <LayoutDashboard class="dashboard-nav__icon" />
            <span v-if="!collapsed || mobileMenuOpen" class="dashboard-nav__text">工作区</span>
          </RouterLink>
        </div>

        <div :class="['dashboard-sidebar__footer', { 'is-collapsed': collapsed && !mobileMenuOpen }]">
          <button :class="['dashboard-user', { 'is-collapsed': collapsed && !mobileMenuOpen }]" type="button">
            <span class="dashboard-user__avatar">U</span>
            <span v-if="!collapsed || mobileMenuOpen" class="dashboard-user__copy">
              <span class="dashboard-user__name">访客</span>
              <span class="dashboard-user__email">guest@poetverse</span>
            </span>
          </button>
          <ThemeToggle :compact="collapsed && !mobileMenuOpen" show-label />
          <el-button
            text
            :class="['poet-sidebar-signout', { 'is-collapsed': collapsed && !mobileMenuOpen }]"
          >
            <span class="dashboard-action-icon-wrap">
              <LogOut class="dashboard-action-icon" />
            </span>
            <span v-if="!collapsed || mobileMenuOpen">退出登录</span>
          </el-button>
        </div>
      </div>
    </aside>

    <main class="dashboard-main">
      <div class="dashboard-mobile-header">
        <el-button
          text
          class="dashboard-mobile-menu"
          :aria-label="mobileMenuOpen ? '关闭菜单' : '打开菜单'"
          aria-controls="dashboard-sidebar"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <X v-if="mobileMenuOpen" class="dashboard-mobile-icon" />
          <Menu v-else class="dashboard-mobile-icon" />
        </el-button>
        <span class="dashboard-mobile-title">诗境</span>
        <ThemeToggle />
      </div>

      <div class="dashboard-content">
        <div class="dashboard-heading">
          <h1 class="dashboard-heading__title">工作区</h1>
          <p class="dashboard-heading__description">诗境 PoetVerse 的应用工作区。</p>
        </div>

        <div v-if="loading" class="dashboard-status" role="status">正在读取收录概况……</div>
        <div v-else-if="error" class="dashboard-status" role="alert">
          <p>{{ error }}</p>
          <el-button text class="poet-clear-button" @click="loadOverview">重新读取</el-button>
        </div>
        <div v-else-if="overview" class="dashboard-cards">
          <el-card v-for="card in cards" :key="card.title" shadow="never" class="poet-dashboard-card">
            <template #header>
              <h2 class="dashboard-card__title">{{ card.title }}</h2>
            </template>
            <p class="dashboard-card__text">{{ card.text }}</p>
          </el-card>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { LayoutDashboard, LogOut, Menu, PanelLeft, X } from 'lucide-vue-next'
import ThemeToggle from '../components/ThemeToggle.vue'
import { errorMessage, getOverview, isAbortError } from '../services/poemApi'
import type { Overview } from '../types/poem'

const SIDEBAR_COLLAPSED_KEY = 'poetverse-dashboard-sidebar-collapsed'
const collapsed = ref(readSidebarCollapsed())
const mobileMenuOpen = ref(false)
const overview = ref<Overview | null>(null)
const loading = ref(true)
const error = ref('')
let controller: AbortController | null = null
let requestId = 0
const cards = computed(() => {
  const data = overview.value
  if (!data) return []
  return [
    { title: '诗词总览', text: `已收录 ${data.poems.toLocaleString()} 首诗词，涵盖 ${data.dynasties} 个朝代。` },
    { title: '作者与主题', text: `${data.authors.toLocaleString()} 位作者，${data.tags.toLocaleString()} 个主题标签。` },
    { title: '最近收录', text: data.latestImportedAt ? `最近一次导入：${data.latestImportedAt.slice(0, 10)}` : '暂无导入日期记录。' },
  ]
})

async function loadOverview() {
  controller?.abort()
  const current = ++requestId
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const result = await getOverview(controller.signal)
    if (current === requestId) overview.value = result
  } catch (cause) {
    if (current !== requestId || isAbortError(cause)) return
    error.value = errorMessage(cause)
  } finally {
    if (current === requestId) loading.value = false
  }
}

onMounted(() => { void loadOverview() })
onBeforeUnmount(() => {
  requestId += 1
  controller?.abort()
})

function readSidebarCollapsed() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function toggleSidebar() {
  collapsed.value = !collapsed.value

  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed.value))
  } catch {
    // Keep the current session state when storage is unavailable.
  }
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}
</script>

<style scoped>
.dashboard-page {
  display: flex;
  min-height: 100dvh;
  background: var(--background);
  color: var(--foreground);
}

.dashboard-sidebar {
  display: none;
  flex: 0 0 auto;
}

.dashboard-sidebar.is-mobile-open {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: block;
  background: color-mix(in srgb, var(--foreground), transparent 72%);
}

.dashboard-sidebar__panel {
  display: flex;
  width: 240px;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background: var(--background);
  transition: width 200ms ease;
}

.dashboard-sidebar__panel.is-collapsed {
  width: 48px;
}

.dashboard-sidebar__header {
  display: flex;
  height: 56px;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
}

.dashboard-sidebar__header.is-collapsed {
  justify-content: center;
  padding: 0 8px;
}

.dashboard-sidebar__mark {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 12px;
  font-weight: 700;
}

.dashboard-sidebar__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-toggle-icon {
  width: 16px;
  height: 16px;
  transition: transform 200ms ease;
}

.sidebar-toggle-icon.is-collapsed {
  transform: rotate(180deg);
}

.dashboard-nav {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8px;
}

.dashboard-nav__label {
  margin: 4px 12px 5px;
  color: var(--muted-foreground);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

.dashboard-nav__link {
  display: flex;
  width: 100%;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  color: var(--foreground);
  cursor: pointer;
  font-size: 14px;
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.dashboard-nav__link.is-collapsed {
  width: 32px;
  margin: 0 auto;
  justify-content: center;
}

.dashboard-nav__link.is-active {
  background: var(--accent);
  font-weight: 500;
}

.dashboard-nav__link:hover {
  background: var(--accent);
}

.dashboard-nav__icon,
.dashboard-action-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.dashboard-action-icon-wrap {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
}

.dashboard-nav__link:not(.is-collapsed) {
  padding: 8px 12px;
}

.dashboard-nav__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-sidebar__footer {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--background), var(--secondary) 16%);
  padding: 10px 10px;
}

.dashboard-sidebar__footer.is-collapsed {
  align-items: center;
  gap: 8px;
  background: var(--background);
  overflow: hidden;
  padding: 10px 10px;
}

.dashboard-user {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 40px;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  padding: 0 10px;
  text-align: left;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.dashboard-user:hover {
  border-color: var(--border);
  background: var(--secondary);
}

.dashboard-user.is-collapsed {
  width: 32px;
  height: 40px;
  min-height: 40px;
  justify-content: center;
  padding: 0;
}

.dashboard-sidebar__footer.is-collapsed .dashboard-user:hover,
.dashboard-sidebar__footer.is-collapsed .dashboard-user:focus-visible,
.dashboard-sidebar__footer.is-collapsed .poet-sidebar-signout:hover,
.dashboard-sidebar__footer.is-collapsed .poet-sidebar-signout:focus-visible,
.dashboard-sidebar__footer.is-collapsed :deep(.theme-toggle:hover),
.dashboard-sidebar__footer.is-collapsed :deep(.theme-toggle:focus-visible) {
  border-color: transparent;
  background: transparent;
}

.dashboard-user__avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
  background: var(--secondary);
  color: var(--foreground);
  font-size: 11px;
  font-weight: 600;
}

.dashboard-user__copy {
  min-width: 0;
  flex: 1;
}

.dashboard-user__name,
.dashboard-user__email {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-user__name {
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.dashboard-user__email {
  color: var(--muted-foreground);
  font-size: 11px;
  line-height: 1.3;
}

.poet-sidebar-signout {
  width: 100%;
  height: 40px;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  border-radius: 10px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
}

:deep(.poet-sidebar-signout > span) {
  display: contents;
}

.poet-sidebar-signout.is-collapsed {
  width: 32px;
  gap: 0;
  justify-content: center;
  padding: 0;
}

:deep(.poet-sidebar-signout.is-collapsed > span) {
  display: contents;
}

.dashboard-sidebar__footer :deep(.theme-toggle),
.dashboard-sidebar__footer :deep(.theme-toggle.is-compact) {
  width: 100%;
  height: 40px;
  min-height: 40px;
  gap: 10px;
  justify-content: flex-start;
  border-radius: 10px;
  border-color: transparent;
  background: transparent;
  color: var(--muted-foreground);
  padding: 0 10px;
}

.dashboard-sidebar__footer :deep(.theme-toggle:hover),
.dashboard-sidebar__footer :deep(.theme-toggle:focus-visible) {
  border-color: var(--border);
  background: var(--secondary);
  color: var(--foreground);
}

.dashboard-sidebar__footer :deep(.theme-toggle__icon-wrap) {
  width: 30px;
  height: 30px;
}

.dashboard-sidebar__footer.is-collapsed :deep(.theme-toggle),
.dashboard-sidebar__footer.is-collapsed :deep(.theme-toggle.is-compact) {
  width: 32px;
  height: 40px;
  min-height: 40px;
  gap: 0;
  justify-content: center;
  padding: 0;
}

.dashboard-sidebar__footer .dashboard-action-icon-wrap,
.dashboard-sidebar__footer :deep(.theme-toggle__icon-wrap) {
  width: 30px;
  height: 30px;
  border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
  border-radius: 50%;
  background: var(--secondary);
  color: var(--foreground);
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.dashboard-sidebar__footer .dashboard-user:hover .dashboard-user__avatar,
.dashboard-sidebar__footer .dashboard-user:focus-visible .dashboard-user__avatar,
.dashboard-sidebar__footer .poet-sidebar-signout:hover .dashboard-action-icon-wrap,
.dashboard-sidebar__footer .poet-sidebar-signout:focus-visible .dashboard-action-icon-wrap,
.dashboard-sidebar__footer :deep(.theme-toggle:hover .theme-toggle__icon-wrap),
.dashboard-sidebar__footer :deep(.theme-toggle:focus-visible .theme-toggle__icon-wrap) {
  border-color: var(--primary);
  background: var(--accent);
  color: var(--foreground);
}

.dashboard-sidebar__footer.is-collapsed .poet-sidebar-signout > span:not(.dashboard-action-icon-wrap),
.dashboard-sidebar__footer.is-collapsed :deep(.theme-toggle__label) {
  display: none;
}

.dashboard-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.dashboard-mobile-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  height: 56px;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--background);
  padding: 0 16px;
}

.dashboard-mobile-menu {
  width: 32px;
  height: 32px;
  margin-left: -8px;
}

.dashboard-mobile-icon {
  width: 20px;
  height: 20px;
}

.dashboard-mobile-title {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.dashboard-mobile-header :deep(.theme-toggle) {
  margin-left: auto;
}

.dashboard-content {
  flex: 1;
  padding: 24px;
}

.dashboard-heading {
  margin-bottom: 24px;
}

.dashboard-heading__title {
  margin: 0;
  color: var(--foreground);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.dashboard-heading__description {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.5;
}

.dashboard-cards {
  display: grid;
  gap: 16px;
}

.dashboard-status {
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.8;
}

.dashboard-card__title {
  margin: 0;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
}

.dashboard-card__text {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.5;
}

@media (min-width: 640px) {
  .dashboard-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .dashboard-sidebar {
    display: block;
  }

  .dashboard-sidebar.is-mobile-open {
    position: static;
    inset: auto;
    z-index: auto;
    background: transparent;
  }

  .dashboard-mobile-header {
    display: none;
  }
}

@media (min-width: 1024px) {
  .dashboard-content {
    padding: 40px;
  }

  .dashboard-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
