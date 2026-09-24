<script setup lang="ts">
import { computed, ref } from 'vue'
import UiActionBar from '~/components/ui/UiActionBar.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import { useToast } from '~/composables/useToast'

interface Photo {
  id: number
  name: string
  src: string
  size: string
}

const toast = useToast()

const photos = ref<Photo[]>([
  { id: 1, name: 'Ваза «Теракота»', src: '/demo/vase-terracotta.svg', size: '2,4 МБ' },
  { id: 2, name: 'Ваза «Кобальт»', src: '/demo/vase-cobalt.svg', size: '1,9 МБ' },
  { id: 3, name: 'Чашка «Вершки»', src: '/demo/mug-cream.svg', size: '1,1 МБ' },
  { id: 4, name: 'Миска «Шавлія»', src: '/demo/bowl-sage.svg', size: '1,6 МБ' },
  { id: 5, name: 'Тарілка «Ряба»', src: '/demo/plate-speckled.svg', size: '1,3 МБ' },
])

const selected = ref<number[]>([])
const allChecked = computed(() => selected.value.length === photos.value.length)

function toggle(id: number, value: boolean) {
  selected.value = value ? [...selected.value, id] : selected.value.filter((item) => item !== id)
}

function toggleAll(value: boolean) {
  selected.value = value ? photos.value.map((photo) => photo.id) : []
}

function remove() {
  const count = selected.value.length
  photos.value = photos.value.filter((photo) => !selected.value.includes(photo.id))
  selected.value = []
  toast.success(`Видалено фото: ${count}`)
}
</script>

<template>
  <div class="w-full">
    <div class="mb-3 flex items-center justify-between">
      <UiCheckbox
        :model-value="allChecked"
        :indeterminate="selected.length > 0 && !allChecked"
        label="Обрати всі"
        @update:model-value="toggleAll"
      />
      <span class="text-sm text-muted">{{ photos.length }} фото</span>
    </div>

    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <li
        v-for="photo in photos"
        :key="photo.id"
        class="overflow-hidden rounded-card border bg-card transition-colors"
        :class="selected.includes(photo.id) ? 'border-accent-solid ring-[3px] ring-ring/15' : 'border-line'"
      >
        <img :src="photo.src" :alt="photo.name" class="aspect-[4/3] w-full object-cover" />
        <div class="p-3">
          <UiCheckbox
            :model-value="selected.includes(photo.id)"
            :label="photo.name"
            :description="photo.size"
            @update:model-value="toggle(photo.id, $event)"
          />
        </div>
      </li>
    </ul>

    <!-- sticky: панель прилипає до низу екрана, поки видно список, і
         стоїть у потоці одразу після нього — Tab доходить до дій природно. -->
    <UiActionBar :open="selected.length > 0" :count="selected.length" label="фото обрано" @dismiss="selected = []">
      <UiButton variant="ghost" size="sm" @click="toast.info('Архів готується')">Завантажити</UiButton>
      <UiButton variant="danger" size="sm" @click="remove">Видалити</UiButton>
    </UiActionBar>
  </div>
</template>
