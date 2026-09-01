<script setup lang="ts">
import UiButton from '~/components/ui/UiButton.vue'
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <UiButton variant="solid">solid</UiButton>
    <UiButton variant="soft">soft</UiButton>
    <UiButton variant="outline">outline</UiButton>
    <UiButton variant="ghost">ghost</UiButton>
    <UiButton variant="danger">danger</UiButton>
    <UiButton variant="link">link</UiButton>
  </div>
</template>
