<script setup lang="ts">
import { ref } from 'vue'
import UiProse from '~/components/ui/UiProse.vue'
import UiRichTextEditor from '~/components/ui/UiRichTextEditor.vue'

const html = ref(
  '<h2>Спробуйте відредагувати</h2><p>Нижче — той самий HTML, показаний через ' +
    '<code>UiProse</code>. Обидва несуть однаковий клас, тож розійтися не можуть.</p>' +
    '<ul><li>жирний через Ctrl+B</li><li>курсив через Ctrl+I</li></ul>',
)
</script>

<template>
  <div class="w-full space-y-3">
    <UiRichTextEditor v-model="html" mode="simple" :max-chars="600" min-height="9rem" />

    <div class="rounded-card border border-line bg-subtle p-4">
      <p class="mb-2 text-xs font-medium text-muted">Те саме через UiProse:</p>
      <UiProse :html="html" />
    </div>
  </div>
</template>
