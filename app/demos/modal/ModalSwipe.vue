<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiModal from '~/components/ui/UiModal.vue'

const open = ref(false)
</script>

<template>
  <UiButton @click="open = true">Відкрити шторку</UiButton>

  <UiModal v-model="open" title="Поділитися" size="sm" swipe-to-close>
    <p class="text-muted">
      На телефоні вікно — шторка знизу. Потягніть її за ручку чи шапку вниз,
      щоб закрити, як нативний sheet. На ширшому екрані вікно центроване, і
      жест вимкнено.
    </p>

    <template #footer>
      <UiButton variant="outline" @click="open = false">Скасувати</UiButton>
      <UiButton @click="open = false">Надіслати</UiButton>
    </template>
  </UiModal>
</template>
