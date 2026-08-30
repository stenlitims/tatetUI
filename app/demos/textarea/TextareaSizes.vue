<script setup lang="ts">
import { ref } from 'vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'

const quick = ref('')
const standard = ref('')
const main = ref('')
</script>

<!--
  Три щільності: sm — швидкий пошук/коментар, md — типовий, lg — головне
  поле сторінки. На мобільному текст 16px — без авто-зуму iOS Safari,
  висота росте з контентом (min-h), md: повертає щільні паддінги.
-->
<template>
  <div class="flex flex-col gap-4">
    <UiTextarea v-model="quick" size="sm" :rows="2" placeholder="Швидкий коментар (sm)…" />
    <UiTextarea v-model="standard" size="md" :rows="3" label="Опис (md)" placeholder="Типове поле…" />
    <UiTextarea v-model="main" size="lg" :rows="4" label="Текст листа (lg)" placeholder="Головне поле сторінки…" />
  </div>
</template>