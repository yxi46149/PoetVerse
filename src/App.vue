<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useScrollRestoration } from 'vue-router/experimental'

useScrollRestoration()
</script>
