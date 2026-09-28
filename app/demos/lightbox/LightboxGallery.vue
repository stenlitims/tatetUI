<script setup lang="ts">
import { shallowRef } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiLightbox, { type LightboxItem } from '~/components/ui/UiLightbox.vue'
import { useToast } from '~/composables/useToast'

const toast = useToast()

const images: LightboxItem[] = [
  { src: '/demo/vase-terracotta.svg', alt: 'Ваза з червоної глини на світлому тлі', caption: 'Ваза «Теракота» — червона глина, ручне формування, 32 см' },
  { src: '/demo/vase-cobalt.svg', alt: 'Висока ваза під кобальтовою поливою', caption: 'Ваза «Кобальт» — кам’яна маса, полива з крапом' },
  { src: '/demo/mug-cream.svg', alt: 'Чашка з кремовою поливою і коричневим обідком', caption: 'Чашка «Вершки», 350 мл' },
  { src: '/demo/bowl-sage.svg', alt: 'Широка миска під зеленою поливою', caption: 'Миска «Шавлія», діаметр 18 см' },
  { src: '/demo/plate-speckled.svg', alt: 'Тарілка з рябою поливою, вигляд згори' },
]

const open = shallowRef(false)
const index = shallowRef(0)

// Мініатюри на сторінці: з них фото «виростає» при відкритті й у них же
// повертається при закритті — навіть якщо в галереї догорнули до іншого.
const thumbs: (HTMLElement | null)[] = []

function show(at: number) {
  index.value = at
  open.value = true
}
</script>

<template>
  <div class="w-full">
    <ul class="grid grid-cols-3 gap-2 sm:grid-cols-5">
      <li v-for="(image, at) in images" :key="image.src">
        <!-- Мініатюра — кнопка: відкриття галереї — дія, і фокус після
             закриття повернеться саме сюди. -->
        <button
          type="button"
          class="block w-full overflow-clip rounded-card border border-line transition-[border-color,box-shadow] hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
          :aria-label="`Відкрити фото ${at + 1}: ${image.alt}`"
          @click="show(at)"
        >
          <img
            :ref="(element) => (thumbs[at] = element as HTMLElement | null)"
            :src="image.src"
            alt=""
            class="aspect-square w-full object-cover"
          />
        </button>
      </li>
    </ul>

    <UiLightbox v-model="open" v-model:index="index" :images="images" :origin="(i) => thumbs[i]">
      <template #actions="{ image }">
        <UiButton
          variant="outline"
          size="icon"
          class="rounded-full"
          label="Поділитися"
          @click="toast.info(`Посилання на «${image.alt}» скопійовано`)"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </svg>
        </UiButton>
      </template>
    </UiLightbox>
  </div>
</template>
