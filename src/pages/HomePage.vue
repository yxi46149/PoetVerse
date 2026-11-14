<template>
  <main class="poet-page">
    <SiteHeader />
    <HeroSection />
    <ChronicleSection :dynasty="dynasty" @select-dynasty="onSelectDynasty" />
    <CollectionSection ref="collectionRef" v-model:dynasty="dynasty" />
    <AboutSection />
  </main>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import SiteHeader from '../components/SiteHeader.vue'
import HeroSection from '../components/HeroSection.vue'
import ChronicleSection from '../components/ChronicleSection.vue'
import CollectionSection from '../components/CollectionSection.vue'
import AboutSection from '../components/AboutSection.vue'
import { collectionState } from '../state/collection'

const dynasty = toRef(collectionState, 'dynasty')
const collectionRef = ref<InstanceType<typeof CollectionSection> | null>(null)

function onSelectDynasty(name: string) {
  collectionRef.value?.applyDynasty(name)
  document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })
}
</script>
