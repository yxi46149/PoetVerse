import { computed, readonly, ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'poetverse-theme'
const theme = ref<ThemeMode>(readInitialTheme())

export interface ThemeTransitionOrigin {
  x: number
  y: number
}

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.theme = mode
  root.style.colorScheme = mode
}

function persistTheme(mode: ThemeMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Ignore storage restrictions and keep the current session theme active.
  }
}

applyTheme(theme.value)

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  function updateTheme(mode: ThemeMode) {
    theme.value = mode
    applyTheme(mode)
    if (typeof window !== 'undefined') persistTheme(mode)
  }

  function setTheme(mode: ThemeMode, origin?: ThemeTransitionOrigin) {
    if (mode === theme.value) return

    if (typeof document === 'undefined' || !origin) {
      updateTheme(mode)
      return
    }

    const root = document.documentElement
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion) {
      updateTheme(mode)
      return
    }

    root.style.setProperty('--theme-transition-x', `${origin.x}px`)
    root.style.setProperty('--theme-transition-y', `${origin.y}px`)
    root.dataset.themeTransition = mode === 'dark' ? 'to-dark' : 'to-light'

    let transition: ViewTransition
    try {
      transition = document.startViewTransition(() => updateTheme(mode))
    } catch {
      root.style.removeProperty('--theme-transition-x')
      root.style.removeProperty('--theme-transition-y')
      delete root.dataset.themeTransition
      updateTheme(mode)
      return
    }

    void transition.finished.then(
      () => {
        root.style.removeProperty('--theme-transition-x')
        root.style.removeProperty('--theme-transition-y')
        delete root.dataset.themeTransition
      },
      () => {
        root.style.removeProperty('--theme-transition-x')
        root.style.removeProperty('--theme-transition-y')
        delete root.dataset.themeTransition
      },
    )
  }

  function toggleTheme(origin?: ThemeTransitionOrigin) {
    setTheme(isDark.value ? 'light' : 'dark', origin)
  }

  return {
    theme: readonly(theme),
    isDark,
    setTheme,
    toggleTheme,
  }
}
