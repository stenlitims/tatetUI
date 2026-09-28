<script setup lang="ts">
import { shallowRef } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiLightbox, { type LightboxItem } from '~/components/ui/UiLightbox.vue'
import { useToast } from '~/composables/useToast'

const toast = useToast()

/*
 * Вид слайда визначається за адресою: файл .mp4 — відео, посилання
 * YouTube — вбудований плеєр. Явний type потрібен лише для iframe і
 * власного вмісту.
 */
const items: LightboxItem[] = [
  {
    src: '/demo/vase-terracotta.svg',
    alt: 'Ваза з червоної глини на світлому тлі',
    caption: 'Фото: ваза «Теракота», 32 см',
  },
  {
    src: '/demo/pottery-wheel.mp4',
    poster: '/demo/pottery-wheel.jpg',
    alt: 'Ваза обертається на гончарному колі',
    caption: 'Відеофайл: ваза на гончарному колі, 5 с',
  },
  {
    src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    alt: 'Big Buck Bunny — відкритий мультфільм Blender Foundation',
    caption: 'YouTube: плеєр вбудовується без cookies, доки не натиснуто «відтворити»',
  },
  {
    type: 'iframe',
    src: 'https://www.openstreetmap.org/export/embed.html?bbox=34.570%2C49.938%2C34.650%2C49.978&layer=mapnik&marker=49.9584%2C34.6093',
    alt: 'Мапа Опішні — столиці українського гончарства',
    caption: 'Iframe: мапа OpenStreetMap',
  },
  {
    type: 'custom',
    src: 'workshop',
    alt: 'Майстер-клас у майстерні',
    caption: 'Власний вміст через слот custom — з кнопками й формами',
  },
]

const tiles = [
  { label: 'Фото', image: '/demo/vase-terracotta.svg' },
  { label: 'Відео', image: '/demo/pottery-wheel.jpg' },
  { label: 'YouTube', image: null },
  { label: 'Мапа', image: null },
  { label: 'Свій слайд', image: null },
]

const open = shallowRef(false)
const index = shallowRef(0)

function show(at: number) {
  index.value = at
  open.value = true
}
</script>

<template>
  <div class="w-full">
    <ul class="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <li v-for="(tile, at) in tiles" :key="tile.label">
        <button
          type="button"
          class="relative block w-full overflow-clip rounded-card border border-line bg-subtle transition-[border-color,box-shadow] hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
          :aria-label="`Відкрити: ${items[at]!.alt}`"
          @click="show(at)"
        >
          <img v-if="tile.image" :src="tile.image" alt="" class="aspect-square w-full object-cover" />
          <span v-else class="flex aspect-square w-full items-center justify-center text-muted" aria-hidden="true">
            <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3.5" y="5" width="17" height="14" rx="2" />
              <path d="M3.5 9h17" />
            </svg>
          </span>
          <span class="absolute bottom-2 left-2 rounded-full border border-line bg-card/90 px-2 py-0.5 text-xs font-medium text-ink shadow-card">
            {{ tile.label }}
          </span>
        </button>
      </li>
    </ul>

    <UiLightbox v-model="open" v-model:index="index" :images="items" aria-label="Медіа галереї">
      <template #custom="{ active }">
        <div class="w-[min(26rem,calc(100vw-2rem))] rounded-overlay border border-line bg-card p-5 text-ink shadow-overlay">
          <p class="text-xs font-medium tracking-wide text-muted uppercase">Субота, 11:00</p>
          <h3 class="mt-1 text-lg font-semibold">Майстер-клас на гончарному колі</h3>
          <p class="mt-2 text-sm text-muted">
            Дві години з майстринею: центрування глини, перша чашка, покриття поливою. Випалений
            виріб заберете за тиждень.
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <UiButton :disabled="!active" @click="toast.success('Місце заброньовано')">Записатися</UiButton>
            <UiButton variant="outline" :disabled="!active" @click="toast.info('Програму надіслано на пошту')">Програма</UiButton>
          </div>
        </div>
      </template>
    </UiLightbox>
  </div>
</template>
