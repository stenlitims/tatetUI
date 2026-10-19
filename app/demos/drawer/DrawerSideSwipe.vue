<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import { menuItemClass } from '~/utils/uiFieldStyles'

const open = ref(false)
const ITEMS = ['Контакти', 'Нова група', 'Архів', 'Налаштування', 'Довідка', 'Про застосунок']
const TAGS = ['Усі', 'Особисті', 'Робота', 'Канали', 'Боти', 'Непрочитані', 'Архів']
</script>

<template>
  <UiButton @click="open = true">Головне меню</UiButton>

  <UiDrawer v-model="open" position="left" size="xs" title="Меню" close-on-backdrop swipe-to-close-side>
    <p class="mb-3 text-muted">
      На телефоні потягніть панель ліворуч. Смуга нижче прокручується вбік і
      панель не тягне.
    </p>
    <div class="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
      <span
        v-for="tag in TAGS"
        :key="tag"
        class="shrink-0 rounded-full border border-line bg-subtle px-3 py-1 text-sm text-ink"
      >
        {{ tag }}
      </span>
    </div>
    <div class="-mx-2 flex flex-col">
      <button v-for="item in ITEMS" :key="item" type="button" :class="[menuItemClass, 'text-ink']" @click="open = false">
        {{ item }}
      </button>
    </div>
  </UiDrawer>
</template>
