<script setup lang="ts">
import UiRating from '~/components/ui/UiRating.vue'

const products = [
  { name: 'Ваза «Теракота»', src: '/demo/vase-terracotta.svg', price: '₴1 450', rating: 4.8, reviews: 128 },
  { name: 'Чашка «Вершки»', src: '/demo/mug-cream.svg', price: '₴390', rating: 4.3, reviews: 57 },
  { name: 'Миска «Шавлія»', src: '/demo/bowl-sage.svg', price: '₴620', rating: 3.6, reviews: 21 },
]
</script>

<template>
  <ul class="grid w-full gap-4 sm:grid-cols-3">
    <li v-for="product in products" :key="product.name" class="overflow-hidden rounded-card border border-line bg-card">
      <img :src="product.src" :alt="product.name" class="aspect-[4/3] w-full object-cover" />
      <div class="space-y-1.5 p-3">
        <p class="text-sm font-medium text-ink">{{ product.name }}</p>
        <UiRating :model-value="product.rating" readonly size="sm" show-value :count="product.reviews" />
        <p class="text-base font-semibold tabular-nums text-ink">{{ product.price }}</p>
      </div>
    </li>
  </ul>
</template>
