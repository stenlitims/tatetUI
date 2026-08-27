<script setup lang="ts">
import { nextTick, onBeforeUpdate, ref, useId, watch } from 'vue'

export interface TabItem {
  id: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Панелі вкладок. */
    tabs: TabItem[]
    /** Активна вкладка. Використовуйте через `v-model`. */
    modelValue?: string
    /**
     * Вигляд. `underline` — класичні вкладки з лінією, `pills` — сегментний
     * перемикач (фонова підкладка, активна сегмента «піднята»).
     */
    variant?: 'underline' | 'pills'
    /**
     * Назва query-параметра, з яким синхронізується активна вкладка.
     * Напр. `"tab"` — стан читається з `?tab=` і пишеться туди через
     * `router.replace`. Потрібен лише для вкладок, що мають переживати
     * перезавантаження сторінки.
     */
    queryParam?: string
    /** Доступна назва для `role="tablist"`. */
    ariaLabel?: string
  }>(),
  { modelValue: undefined, variant: 'underline', queryParam: undefined, ariaLabel: 'Вкладки' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Активна вкладка змінилася (клік, клавіатура або навігація за URL). */
  change: [id: string]
}>()

defineSlots<{
  /** Вміст активної панелі, якщо не задано слот `panel-<id>`. */
  default?: () => unknown
  /** `panel-<id>` — вміст панелі вкладки з цим id. Рендериться лише активна. */
  [key: `panel-${string}`]: () => unknown
  /** `tab-<id>` — власний рендер кнопки вкладки: іконка, лічильник. */
  [key: `tab-${string}`]: (props: { tab: TabItem; active: boolean }) => unknown
}>()

const route = useRoute()
const router = useRouter()

const baseId = useId()
const tabButtonEls = ref<(HTMLElement | null)[]>([])

// Template-refs у v-for накопичуються між рендерами: без скидання масив
// тримав би хибні елементи після зміни набору вкладок (той самий патерн,
// що в UiSelect).
onBeforeUpdate(() => {
  tabButtonEls.value = []
})

const firstEnabled = props.tabs.find((tab) => !tab.disabled)?.id ?? props.tabs[0]?.id ?? ''
const active = ref(props.modelValue ?? firstEnabled)

// Відновлення стану з URL має пріоритет над props.modelValue.
if (props.queryParam && typeof route.query[props.queryParam] === 'string') {
  const fromQuery = route.query[props.queryParam] as string
  if (props.tabs.some((tab) => tab.id === fromQuery && !tab.disabled)) active.value = fromQuery
}

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined && value !== active.value) active.value = value
  },
)

// Назад/вперед у браузері: вкладка слідує за URL.
watch(
  () => (props.queryParam ? route.query[props.queryParam] : undefined),
  (value) => {
    if (typeof value === 'string' && props.tabs.some((tab) => tab.id === value)) {
      if (value !== active.value) active.value = value
    }
  },
)

function syncQuery(id: string) {
  if (!props.queryParam) return
  const query = { ...route.query, [props.queryParam]: id }
  // Перший таб не пише параметр: URL лишається чистим для стану за замовчуванням.
  if (id === firstEnabled) delete query[props.queryParam]
  void router.replace({ query })
}

function select(id: string) {
  if (id === active.value) return
  active.value = id
  emit('update:modelValue', id)
  emit('change', id)
  syncQuery(id)
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const enabled = props.tabs.map((tab, i) => ({ tab, i })).filter(({ tab }) => !tab.disabled)
  if (!enabled.length) return
  let pos = enabled.findIndex(({ i }) => i === index)
  if (pos === -1) pos = 0
  if (event.key === 'ArrowRight') pos = (pos + 1) % enabled.length
  else if (event.key === 'ArrowLeft') pos = (pos - 1 + enabled.length) % enabled.length
  else if (event.key === 'Home') pos = 0
  else pos = enabled.length - 1
  const target = enabled[pos]!
  select(target.tab.id)
  void nextTick(() => tabButtonEls.value[target.i]?.focus())
}
</script>

<template>
  <div>
    <div class="scrollbar-none overflow-x-auto" :class="variant === 'underline' ? 'border-b border-line' : ''">
      <div
        role="tablist"
        :aria-label="ariaLabel"
        :class="
          variant === 'underline'
            ? 'flex min-w-max gap-1'
            : 'inline-flex min-w-max items-center gap-1 rounded-control bg-hover p-1'
        "
      >
        <template v-for="(tab, index) in tabs" :key="tab.id">
          <slot :name="`tab-${tab.id}`" :tab="tab" :active="tab.id === active">
            <button
              :id="`${baseId}-tab-${tab.id}`"
              :ref="(el) => (tabButtonEls[index] = el as HTMLElement)"
              type="button"
              role="tab"
              :aria-selected="tab.id === active"
              :aria-controls="`${baseId}-panel-${tab.id}`"
              :tabindex="tab.id === active ? 0 : -1"
              :disabled="tab.disabled"
              :class="[
                'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab.disabled ? 'cursor-not-allowed opacity-50' : '',
                variant === 'underline'
                  ? [
                      '-mb-px h-11 rounded-t-control border-b-2 px-3.5 text-sm md:h-9',
                      tab.id === active
                        ? 'border-accent-solid text-accent'
                        : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
                    ]
                  : [
                      'h-11 rounded-[calc(var(--radius-control)_-_0.125rem)] px-3.5 text-sm md:h-8',
                      tab.id === active
                        ? 'bg-card text-ink shadow-card'
                        : 'text-muted hover:text-ink',
                    ],
              ]"
              @click="!tab.disabled && select(tab.id)"
              @keydown="onKeydown($event, index)"
            >
              {{ tab.label }}
            </button>
          </slot>
        </template>
      </div>
    </div>

    <template v-for="tab in tabs" :key="tab.id">
      <div
        v-if="tab.id === active"
        :id="`${baseId}-panel-${tab.id}`"
        role="tabpanel"
        :aria-labelledby="`${baseId}-tab-${tab.id}`"
        class="mt-4"
      >
        <slot :name="`panel-${tab.id}`">
          <slot />
        </slot>
      </div>
    </template>
  </div>
</template>