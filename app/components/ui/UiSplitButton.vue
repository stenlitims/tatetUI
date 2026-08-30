<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMenu from '~/components/ui/UiMenu.vue'

export interface SplitButtonItem {
  /** Стабільний ключ пункту, що приходить у подію `select`. */
  id: string | number
  /** Підпис пункту. */
  label: string
  /** Пояснення під підписом. */
  description?: string
  disabled?: boolean
  /** Небезпечна дія — фарбується як руйнівна. */
  danger?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Альтернативні дії в меню під кареткою. */
    items?: SplitButtonItem[]
    /** Підпис головної дії. Складніший вміст — слот `default`. */
    label?: string
    /** Візуальна вага. Обидві кнопки завжди в одному варіанті. */
    variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'danger'
    /** Висота обох кнопок. */
    size?: 'sm' | 'md' | 'lg'
    /** Індикатор на ГОЛОВНІЙ кнопці. Каретка лишається доступною. */
    loading?: boolean
    /** Блокує лише каретку: головна дія працює, альтернатив зараз немає. */
    menuDisabled?: boolean
    /** Робить головну кнопку посиланням. Каретка лишається кнопкою. */
    to?: string
    /** Тип головної кнопки. Ігнорується, коли задано `to`. */
    type?: 'button' | 'submit' | 'reset'
    /**
     * Доступна назва ГРУПИ. Без неї скрінрідер читає дві сусідні кнопки як
     * незв'язані, і призначення каретки лишається невідомим.
     */
    groupLabel?: string
    /** Доступна назва каретки — власного тексту вона не має. */
    menuLabel?: string
    /** Куди відкривати меню. Проксується в `UiMenu`. */
    placement?: 'bottom-start' | 'bottom' | 'bottom-end' | 'top' | 'right'
    /** Ширина панелі меню, напр. `"14rem"`. */
    menuWidth?: string
    disabled?: boolean
  }>(),
  {
    items: () => [],
    variant: 'solid',
    size: 'md',
    type: 'button',
    groupLabel: 'Дія з варіантами',
    menuLabel: 'Інші дії',
    placement: 'bottom-end',
  },
)

const emit = defineEmits<{
  click: [event: MouseEvent]
  select: [item: SplitButtonItem]
}>()

defineSlots<{
  /** Текст головної дії. Перекриває `label`. */
  default?: () => unknown
  /** Іконка перед текстом головної дії. */
  leading?: () => unknown
  /** Власний вміст меню замість `items`. `toggle` закриває панель. */
  menu?: (props: { toggle: () => void }) => unknown
}>()

// defineSlots дає лише типи; наявність слота в рантаймі читається так.
const slots = useSlots()

const primaryEl = ref<InstanceType<typeof UiButton> | null>(null)

/*
 * Шов між кнопками.
 *
 * Дві `rounded-control` кнопки поруч дають подвоєну лінію на `outline` і
 * видимий стик на `solid`. Тому в головної зрізаний правий край, у каретки
 * — лівий, і каретка підтягнута на -1px. `focus-visible:z-10` обов'язковий:
 * без нього сусідка підрізає кільце фокуса.
 */
const PRIMARY_SEAM = 'relative rounded-r-none focus-visible:z-10'
const CARET_SEAM = 'relative -ml-px rounded-l-none px-2 focus-visible:z-10'

const hasMenu = computed(() => props.items.length > 0 || !!slots.menu)
const caretDisabled = computed(() => props.disabled || props.menuDisabled || !hasMenu.value)

function choose(item: SplitButtonItem, toggle: () => void) {
  if (item.disabled) return
  emit('select', item)
  toggle()
}

defineExpose({
  /** Ставить фокус на головну кнопку. */
  focus: () => primaryEl.value?.focus(),
})
</script>

<template>
  <!--
    Обидві кнопки живуть усередині слота `trigger` UiMenu — інакше головна
    кнопка не дістала б `toggle`, а APG вимагає, щоб ArrowDown на ній теж
    відкривав меню. `triggerAttrs` при цьому йде ЛИШЕ на каретку: це вона
    керує панеллю, а не група.
  -->
  <UiMenu
    :placement="placement"
    :width="menuWidth"
    :disabled="caretDisabled"
    :aria-label="menuLabel"
  >
    <template #trigger="{ toggle, triggerAttrs }">
      <div role="group" :aria-label="groupLabel" class="inline-flex items-stretch">
        <UiButton
          ref="primaryEl"
          :variant="variant"
          :size="size"
          :loading="loading"
          :disabled="disabled"
          :to="to"
          :type="to ? undefined : type"
          :class="PRIMARY_SEAM"
          @click="emit('click', $event)"
          @keydown.down.prevent="caretDisabled ? undefined : toggle()"
        >
          <template v-if="$slots.leading" #leading>
            <slot name="leading" />
          </template>
          <slot>{{ label }}</slot>
        </UiButton>

        <UiButton
          :variant="variant"
          :size="size"
          :disabled="caretDisabled"
          :aria-label="menuLabel"
          :class="CARET_SEAM"
          v-bind="triggerAttrs"
          @click="toggle"
        >
          <span aria-hidden="true" class="text-[0.7em] leading-none">▼</span>
        </UiButton>
      </div>
    </template>

    <template #content="{ toggle }">
      <slot name="menu" :toggle="toggle">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          class="block w-full rounded-control px-3 py-3 text-left text-sm transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:py-2"
          :class="item.danger ? 'text-danger' : 'text-ink'"
          @click="choose(item, toggle)"
        >
          <span class="block font-medium">{{ item.label }}</span>
          <span v-if="item.description" class="mt-0.5 block text-xs text-muted">
            {{ item.description }}
          </span>
        </button>
      </slot>
    </template>
  </UiMenu>
</template>
