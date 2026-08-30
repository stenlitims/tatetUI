<script setup lang="ts">
import { ref } from 'vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'

const lastCopied = ref('')
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <UiCopyButton text="npx nuxi init my-app" label="Копіювати команду" @copied="lastCopied = $event" />
    <UiCopyButton text="tatetUI" variant="outline" aria-label="Копіювати назву" />
    <p class="text-xs text-muted">В буфері: {{ lastCopied || '—' }}</p>
  </div>
</template>