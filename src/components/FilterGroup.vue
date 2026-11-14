<template>
  <div>
    <h3 class="filter-group__title">{{ title }}</h3>
    <el-radio-group
      :model-value="modelValue"
      class="poet-filter-group"
      :aria-label="title"
      @update:model-value="onUpdate"
    >
      <el-radio-button
        v-for="option in options"
        :key="option"
        :value="option"
      >
        {{ option }}
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  options: string[]
  modelValue: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function onUpdate(value: string | number | boolean | undefined) {
  if (value !== undefined) emit('update:modelValue', String(value))
}
</script>

<style scoped>
.filter-group__title {
  margin: 0 0 12px;
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.15em;
  line-height: 1.4;
}
</style>
