<script setup lang="ts">
import { ref } from 'vue'
import UiTagInput from '~/components/ui/UiTagInput.vue'

const tags = ref<string[]>(['vip', 'терміново'])
const rejected = ref('')

function onReject(tag: string, reason: string) {
  const reasons: Record<string, string> = {
    duplicate: 'така мітка вже є',
    max: 'досягнуто межі',
    length: 'задовга мітка',
    empty: 'порожня мітка',
  }
  rejected.value = `«${tag}» — ${reasons[reason] ?? reason}`
}
</script>

<template>
  <div class="w-full max-w-md space-y-3">
    <UiTagInput
      v-model="tags"
      label="Мітки клієнта"
      placeholder="Введіть і натисніть Enter"
      :max="6"
      :max-length="20"
      hint="Enter або кома завершують мітку. Backspace двічі — видаляє останню."
      @reject="onReject"
    />
    <p v-if="rejected" class="text-sm text-warning">Відхилено: {{ rejected }}</p>
    <p class="text-sm text-muted">Збережеться як: {{ tags.length ? tags.join(', ') : 'порожньо' }}</p>
  </div>
</template>
