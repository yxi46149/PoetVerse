import { createApp } from 'vue'
import { ElButton, ElCard, ElDialog, ElInput, ElRadioButton, ElRadioGroup, ElScrollbar } from 'element-plus'
import '@fontsource-variable/dm-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource-variable/lora'
import '@fontsource-variable/noto-serif-sc'
import App from './App.vue'
import router from './router'
import { SCROLL_RESTORATION_CAPTURE_DEFAULT, ScrollRestoration } from 'vue-router/experimental'
import 'element-plus/dist/index.css'
import './index.css'

const app = createApp(App)

app.use(ScrollRestoration, {
  router,
  capture: SCROLL_RESTORATION_CAPTURE_DEFAULT,
  restore(entry, to) {
    if (entry?.default) {
      window.scrollTo({
        left: entry.default.left ?? 0,
        top: entry.default.top ?? 0,
        behavior: 'auto',
      })
      return
    }

    if (to.hash) {
      const target = document.getElementById(to.hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }

    window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
  },
})
app.use(router)
app.component('ElButton', ElButton)
app.component('ElCard', ElCard)
app.component('ElDialog', ElDialog)
app.component('ElInput', ElInput)
app.component('ElRadioButton', ElRadioButton)
app.component('ElRadioGroup', ElRadioGroup)
app.component('ElScrollbar', ElScrollbar)
app.mount('#app')
