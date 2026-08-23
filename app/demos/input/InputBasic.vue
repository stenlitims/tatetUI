<script setup lang="ts">
import { ref } from 'vue'
import UiInput from '~/components/ui/UiInput.vue'

const email = ref('')
</script>

<template>
  <div class="w-full max-w-sm">
    <UiInput v-model="email" label="Робоча пошта" type="email" placeholder="you@company.com" />
  </div>
</template>
