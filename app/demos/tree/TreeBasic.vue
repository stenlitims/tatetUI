<script setup lang="ts">
import { ref } from 'vue'
import UiTree from '~/components/ui/UiTree.vue'
import type { TreeNode } from '~/components/ui/UiTree.vue'

const items: TreeNode[] = [
  {
    id: 'example',
    label: 'example.com',
    children: [
      { id: 'home', label: 'Головна' },
      { id: 'about', label: 'Про нас' },
      {
        id: 'blog',
        label: 'Блог',
        children: [
          { id: 'post-1', label: 'Перший пост' },
          { id: 'post-2', label: 'Другий пост' },
        ],
      },
    ],
  },
  {
    id: 'shop',
    label: 'shop.example.com',
    children: [
      { id: 'catalog', label: 'Каталог' },
      { id: 'cart', label: 'Кошик' },
    ],
  },
  { id: 'trash', label: 'Кошик (порожній)', disabled: true },
]

const selected = ref<string | null>('home')
const expanded = ref<string[]>(['example'])
const lastClick = ref('—')
</script>

<template>
  <div class="max-w-sm">
    <UiTree
      v-model="selected"
      v-model:expanded="expanded"
      :items="items"
      @item-click="lastClick = $event.node.label"
    />
    <p class="mt-2 text-xs text-muted">
      Вибрано: {{ selected || '—' }} · відкриті: {{ expanded.join(', ') || '—' }} · клік: {{ lastClick }}
    </p>
  </div>
</template>