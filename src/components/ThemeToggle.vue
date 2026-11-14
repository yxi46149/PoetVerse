<template>
  <button
    type="button"
    :class="['theme-toggle', { 'is-compact': compact, 'is-dark': isDark }]"
    :aria-pressed="isDark"
    @click="handleToggle"
  >
    <span class="theme-toggle__icon-wrap" aria-hidden="true">
      <Sun v-if="isDark" class="theme-toggle__icon" :size="16" />
      <Moon v-else class="theme-toggle__icon" :size="16" />
    </span>
    <span v-if="showLabel" class="theme-toggle__label">
      {{ isDark ? '亮色模式' : '暗色模式' }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '../theme'

withDefaults(defineProps<{ compact?: boolean; showLabel?: boolean }>(), {
  compact: false,
  showLabel: false,
})

const { isDark, toggleTheme } = useTheme()

function handleToggle(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const bounds = button.getBoundingClientRect()

  toggleTheme({
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  })
}
</script>

<style scoped>
.theme-toggle {
  position: relative;
  display: inline-flex;
  width: 36px;
  height: 36px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 0;
  border: 1px solid color-mix(in srgb, var(--border), transparent 12%);
  border-radius: 50%;
  background: color-mix(in srgb, var(--background), transparent 6%);
  padding: 0;
  color: var(--muted-foreground);
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.1em;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease, transform 180ms ease;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  border-color: var(--primary);
  background: var(--secondary);
  color: var(--foreground);
  outline: none;
}

.theme-toggle:active {
  transform: scale(0.96);
}

.theme-toggle.is-compact {
  width: 32px;
  height: 32px;
  min-height: 32px;
}

.theme-toggle__icon {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  transition: transform 260ms ease;
}

.theme-toggle__icon-wrap {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--foreground);
}

.theme-toggle.is-dark .theme-toggle__icon {
  transform: rotate(18deg);
}

.theme-toggle__label {
  line-height: 1;
  letter-spacing: normal;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .theme-toggle,
  .theme-toggle__icon {
    transition-duration: 0.01ms;
  }
}
</style>
