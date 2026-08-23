<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'

type Position = 'left' | 'right' | 'top' | 'bottom'

const open = ref(false)
const position = ref<Position>('right')

function show(next: Position) {
  position.value = next
  open.value = true
}
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <UiButton variant="outline" @click="show('left')">Ліворуч</UiButton>
    <UiButton variant="outline" @click="show('right')">Праворуч</UiButton>
    <UiButton variant="outline" @click="show('top')">Згори</UiButton>
    <UiButton variant="outline" @click="show('bottom')">Знизу</UiButton>
  </div>

  <UiDrawer v-model="open" :position="position" :title="`Позиція: ${position}`" size="sm">
    <p class="text-muted">
      Напрямок анімації задається модифікатором класу на корені, а не окремою
      назвою переходу — інакше набір enter/leave-класів довелося б дублювати
      чотири рази.
    </p>
    <p v-if="position === 'bottom'" class="mt-3 text-muted">
      Нижню панель можна закрити свайпом за ручку зверху.
    </p>
  </UiDrawer>
</template>
