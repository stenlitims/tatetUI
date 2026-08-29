<script setup lang="ts">
import { computed } from 'vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'

export interface AvatarGroupItem {
  /** Стабільний ключ для `:key`. */
  id: string | number
  /** Ім'я: джерело ініціалів і доступної назви. */
  name?: string
  /** Адреса зображення. Немає — буде показано ініціали. */
  src?: string
}

const props = withDefaults(
  defineProps<{
    /** Учасники. Порядок зберігається: перший малюється поверх решти. */
    items: AvatarGroupItem[]
    /**
     * Скільки аватарів показати до плитки «+N». Решта лишається лише в
     * підписі лічильника — саме тому він перелічує їх поіменно.
     */
    max?: number
    /** Розмір кожного аватара в пікселях. Проксується в `UiAvatar`. */
    size?: number
    /**
     * Доступна назва ГРУПИ: «Учасники проєкту». Обов'язкова — інакше
     * скрінрідер зачитає підряд вісім безіменних зображень.
     */
    label: string
    /** Наскільки аватари налазять один на одного. */
    overlap?: 'none' | 'tight' | 'normal'
  }>(),
  { max: 5, size: 32, overlap: 'normal' },
)

type Overlap = NonNullable<typeof props.overlap>

defineSlots<{
  /** Власний рендер одного аватара — наприклад, обгортка в посилання. */
  avatar?: (props: { item: AvatarGroupItem; index: number }) => unknown
  /**
   * Лічильник переповнення замість типового «+N». Отримує решту учасників,
   * щоб їх можна було показати в попапі.
   */
  overflow?: (props: { count: number; items: AvatarGroupItem[] }) => unknown
}>()

const OVERLAP: Record<Overlap, string> = {
  none: 'gap-1',
  tight: '-space-x-3',
  normal: '-space-x-2',
}

const visible = computed(() => props.items.slice(0, Math.max(0, props.max)))
const hidden = computed(() => props.items.slice(Math.max(0, props.max)))

const overflowLabel = computed(() => {
  const names = hidden.value.map((item) => item.name).filter(Boolean)
  if (!names.length) return `Ще ${hidden.value.length}`
  return `Ще ${hidden.value.length}: ${names.join(', ')}`
})

const ringStyle = { boxShadow: '0 0 0 2px var(--bg-card)' }
</script>

<template>
  <ul :aria-label="label" class="flex items-center" :class="OVERLAP[overlap]">
    <!--
      z-index спадає: у DOM пізніший сусід малюється поверх раннього, а
      візуально стек має йти навпаки — перший аватар зверху. Це локальний
      контекст накладання, зі стеком оверлеїв він не пов'язаний.
    -->
    <li
      v-for="(item, index) in visible"
      :key="item.id"
      class="relative"
      :style="{ zIndex: items.length - index }"
    >
      <slot name="avatar" :item="item" :index="index">
        <UiAvatar
          :src="item.src"
          :name="item.name"
          :size="size"
          class="rounded-full"
          :style="ringStyle"
        />
      </slot>
    </li>

    <li v-if="hidden.length" class="relative" :style="{ zIndex: 0 }">
      <slot name="overflow" :count="hidden.length" :items="hidden">
        <span
          class="inline-flex items-center justify-center rounded-full bg-neutral-bg font-medium text-neutral"
          :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px`, ...ringStyle }"
          role="img"
          :aria-label="overflowLabel"
        >
          <span aria-hidden="true">+{{ hidden.length }}</span>
        </span>
      </slot>
    </li>
  </ul>
</template>
