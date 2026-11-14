/** Smooth-scroll to an in-page section without changing the URL fragment. */
export function scrollToId(id: string) {
  if (typeof document === 'undefined') return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
