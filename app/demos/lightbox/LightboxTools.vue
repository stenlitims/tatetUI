<script setup lang="ts">
import { shallowRef } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiLightbox, { type LightboxItem } from '~/components/ui/UiLightbox.vue'

const images: LightboxItem[] = [
  { src: '/demo/vase-terracotta-detail.svg', alt: 'Крупний план поливи й пояска теракотової вази', caption: 'Прозора полива лише на пояску — решта матова' },
  { src: '/demo/vase-cobalt-detail.svg', alt: 'Крупний план кобальтової поливи з білим крапом', caption: 'Білий крап — окиси в поливі, кожна ваза унікальна' },
  { src: '/demo/plate-speckled.svg', alt: 'Тарілка з рябою поливою, вигляд згори', caption: 'Тарілка «Ряба», діаметр 26 см' },
  { src: '/demo/bowl-sage.svg', alt: 'Широка миска під зеленою поливою', caption: 'Миска «Шавлія», діаметр 18 см' },
]

const open = shallowRef(false)
const slideshow = shallowRef(false)

function show(autoplay: boolean) {
  slideshow.value = autoplay
  open.value = true
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UiButton @click="show(false)">Переглянути з інструментами</UiButton>
    <UiButton variant="outline" @click="show(true)">Запустити слайдшоу</UiButton>

    <!-- Колесо гортає, а не збільшує; щипок на тачпаді однаково збільшує.
         Панелі ховаються через 2,5 с без руху миші. -->
    <UiLightbox
      v-model="open"
      :images="images"
      :toolbar="['zoomIn', 'zoomOut', 'rotate', 'flip', 'download', 'slideshow', 'fullscreen', 'thumbnails']"
      :autoplay="slideshow"
      :interval="2500"
      :idle="2500"
      transition="fade"
      wheel="navigate"
      loop
    />
  </div>
</template>
