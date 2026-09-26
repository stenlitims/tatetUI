<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { useScrollLock } from '~/composables/useScrollLock'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { readDurationToken, useReducedMotion } from '~/composables/useReducedMotion'
import { fieldClass } from '~/utils/uiFieldStyles'
import UiKbd from '~/components/ui/UiKbd.vue'

/**
 * ⌘K-палітра команд.
 *
 * НЕ обгортка над UiModal, а власний Teleport + backdrop — але зареєстрований
 * в ТОМУ САМОМУ overlay-стеку (useOverlayLayer), що й UiModal, UiDrawer і
 * UiConfirmDialog. Саме тому палітра, відкрита поверх модалки, правильно
 * переживає Escape (закривається лише верхній оверлей) і не пірнає під неї
 * за z-index.
 */
export interface CommandItem {
  id: string
  label: string
  /** Правий підпис рядка: шпаринка, підрозділ, стан. */
  hint?: string
}

export interface CommandGroup {
  id: string
  label?: string
  items: CommandItem[]
}

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /** Групи команд у порядку показу. */
    groups: CommandGroup[]
    /** Placeholder поля пошуку. */
    placeholder?: string
    /** Текст, коли за запитом нічого не знайдено. */
    emptyText?: string
    /** Глобальний Ctrl+K / Cmd+K відкриває палітру. */
    hotkey?: boolean
  }>(),
  {
    modelValue: false,
    groups: () => [],
    placeholder: 'Пошук…',
    emptyText: 'Нічого не знайдено',
    hotkey: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Обрано команду. `item` — id елемента, не його label. */
  select: [payload: { groupId: string; item: string }]
  /** Запит змінився — на кожен ввід, включно з порожнім рядком. */
  search: [query: string]
}>()

defineSlots<{
  /**
   * Повний рендер рядка замість типового.
   * `active` — чи рядок підсвічений навігацією ↑↓.
   */
  item?: (slotProps: { item: CommandItem; group: CommandGroup; active: boolean }) => unknown
  /** Замінює блок «Нічого не знайдено». */
  empty?: () => unknown
}>()

const generatedId = useId()
const listboxId = `${generatedId}-listbox`
const optionId = (index: number) => `${generatedId}-option-${index}`

const backdropEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

const query = ref('')
const activeIndex = ref(0)
const teleportReady = shallowRef(false)

/* ------------------------------------------------------------------ */
/*  Фільтр і плоский список збігів                                    */
/* ------------------------------------------------------------------ */

/*
 * Фільтр по label: includes, case-insensitive — свідомо без нечіткого
 * пошуку й залежностей. Навігація ↑↓ працює по ПЛОСКОМУ масиву збігів,
 * а не по дереву груп: заголовки груп не фокусуються, а індекс підсвіченого
 * рядка не залежить від того, у скількох групах він лежить.
 */
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  const out: { item: CommandItem; group: CommandGroup }[] = []
  for (const group of props.groups) {
    for (const item of group.items) {
      if (!q || item.label.toLowerCase().includes(q)) out.push({ item, group })
    }
  }
  return out
})

/*
 * Рядки для рендера: ті самі збіги, але з заголовками груп між ними і з
 * ГОТОВИМ плоским індексом кожного рядка — шаблону не доводиться шукати
 * позицію рядка в matches на кожен порівняння.
 */
interface PaletteRow {
  type: 'label' | 'item'
  group: CommandGroup
  item?: CommandItem
  index?: number
}

const rows = computed<PaletteRow[]>(() => {
  const out: PaletteRow[] = []
  let lastIndex = -1
  for (const group of props.groups) {
    const items = matches.value.filter((match) => match.group.id === group.id)
    if (items.length === 0) continue
    if (group.label) out.push({ type: 'label', group })
    for (const item of items.map((match) => match.item)) {
      out.push({ type: 'item', group, item, index: ++lastIndex })
    }
  }
  return out
})

watch(matches, () => {
  activeIndex.value = 0
})

/*
 * Підсвічений рядок має бути видимим. aria-activedescendant сам нічого не
 * прокручує, тож у списку з max-h-80 після восьмого рядка стрілки водили
 * підсвітку за нижній край, і людина вибирала наосліп.
 */
watch(activeIndex, (index) => {
  if (!props.modelValue) return
  void nextTick(() => {
    document.getElementById(optionId(index))?.scrollIntoView?.({ block: 'nearest' })
  })
})

/* ------------------------------------------------------------------ */
/*  Overlay-стек, лок прокрутки, пастка фокуса                        */
/* ------------------------------------------------------------------ */

// Escape — через спільний стек: закривається лише верхній шар, і підказка
// чи меню поверх палітри отримують його першими.
const layer = useOverlayLayer(undefined, { onEscape: () => closePalette() })
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const prefersReducedMotion = useReducedMotion()

// Transition-и висять на ДІТЯХ кореня — Vue не виведе тривалість сам.
// Числа — з тих самих токенів, що й CSS нижче.
const transitionDuration = computed(() =>
  prefersReducedMotion.value
    ? 0
    : { enter: readDurationToken('--duration-base', 180), leave: readDurationToken('--duration-fast', 120) },
)

async function handleOpen() {
  if (query.value) {
    query.value = ''
    // Запит скинуто — споживач з асинхронним пошуком мусить про це дізнатися,
    // інакше під порожнім полем лишилися б результати старого запиту.
    emit('search', '')
  }
  activeIndex.value = 0
  layer.activate()
  scrollLock.lock()
  await nextTick()
  // initialFocus на поле, а не на панель: палітра — це насамперед введення
  // запиту, і на відміну від загальної модалки підняття клавіатури на
  // мобільних тут є бажаною поведінкою.
  focusTrap.activate({ initialFocus: inputEl.value ?? null })
}

function handleClose() {
  focusTrap.deactivate()
  scrollLock.unlock()
  // Шар знімаємо одразу (щоб Escape коректно дістався наступного оверлея),
  // а z-index лишається зафіксованим до кінця анімації виходу.
  layer.deactivate()
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) void handleOpen()
    else handleClose()
  },
)

function openPalette() {
  if (props.modelValue) return
  emit('update:modelValue', true)
}

function closePalette() {
  if (!props.modelValue) return
  emit('update:modelValue', false)
}

/* ------------------------------------------------------------------ */
/*  Вибір і клавіатура                                                */
/* ------------------------------------------------------------------ */

function selectActive() {
  const active = matches.value[activeIndex.value]
  if (!active) return
  emit('select', { groupId: active.group.id, item: active.item.id })
  closePalette()
}

function selectAt(index: number) {
  const match = matches.value[index]
  if (!match) return
  activeIndex.value = index
  emit('select', { groupId: match.group.id, item: match.item.id })
  closePalette()
}

function onSearch(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  emit('search', query.value)
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const total = matches.value.length
    if (total === 0) return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    // Циклічна навігація: після останнього рядка — знову перший.
    activeIndex.value = (activeIndex.value + step + total) % total
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    selectActive()
  }
}

/**
 * pointermove, а не mouseenter: коли стрілки прокручують список під
 * нерухомим курсором, браузер шле mouseenter рядку, що заїхав під нього, —
 * і підсвітка стрибала б назад під мишу посеред навігації з клавіатури.
 */
function onRowPointerMove(index: number) {
  if (activeIndex.value !== index) activeIndex.value = index
}

/* ------------------------------------------------------------------ */
/*  Глобальний ⌘K / Ctrl+K                                            */
/* ------------------------------------------------------------------ */

/*
 * Слухаємо на document, поки компонент змонтований — це ціна глобального
 * хоткея. Слухач ставиться незалежно від стану відкритості: палітра має
 * відкриватися звідки завгодно.
 *
 * Коли фокус уже в текстовому полі, ⌘K не перехоплюємо: у полях браузерні
 * й застосункові комбінації (знайти й замінити, адресний рядок) цінніші,
 * ніж ще один спосіб відкрити палітру.
 */
/**
 * `key` — щоб Ctrl+K працював на Dvorak чи Colemak, де «K» стоїть деінде;
 * `code` — для кирилиці: на українській розкладці key дає «л», і хоткей
 * мовчки не спрацьовував саме для основної аудиторії (той самий капкан
 * описано в UiTreeTable).
 */
function isPaletteHotkey(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey)) return false
  const key = event.key.toLowerCase()
  return key === 'k' || (event.code === 'KeyK' && !/^[a-z]$/.test(key))
}

function onHotkey(event: KeyboardEvent) {
  if (!props.hotkey || !isPaletteHotkey(event)) return

  const active = document.activeElement
  if (
    active instanceof HTMLElement &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable)
  ) {
    return
  }

  event.preventDefault()
  openPalette()
}

/* ------------------------------------------------------------------ */
/*  Клік по фону                                                      */
/* ------------------------------------------------------------------ */

/*
 * Той самий захист, що в UiModal: закриваємо лише коли натискання ПОЧАЛОСЯ
 * на фоні. Виділення тексту зі списку з відпусканням мишки над фоном інакше
 * закривало б палітру разом із набраним запитом.
 */
let pressedOnBackdrop = false

function onRootPointerDown(event: PointerEvent) {
  pressedOnBackdrop = event.target === backdropEl.value
}

function onRootClick(event: MouseEvent) {
  if (!pressedOnBackdrop) return
  pressedOnBackdrop = false
  if (event.target !== backdropEl.value) return
  closePalette()
}

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onHotkey)
  if (props.modelValue) void handleOpen()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onHotkey)
  // Компонент могли знищити відкритим (навігація) — handleClose знімає і
  // лок прокрутки, і пастку фокуса, і шар зі стеку.
  handleClose()
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <Transition name="ui-command-palette" :duration="transitionDuration" @after-leave="layer.settle()">
      <div
        v-if="modelValue"
        data-ui-overlay
        class="ui-command-palette fixed inset-0 overflow-y-auto"
        :style="{ zIndex: layer.zIndex.value }"
        @pointerdown="onRootPointerDown"
        @click="onRootClick"
      >
        <div ref="backdropEl" class="ui-command-palette-backdrop fixed inset-0 bg-backdrop/50 backdrop-blur-sm" />

        <!-- Командний рядок живе зверху сторінки, як spotlight-пошук, а не в
             центрі: око не бігає по екрану між кнопкою, що відкрила
             палітру, і полем. -->
        <div
          ref="panelEl"
          class="ui-command-palette-panel relative mx-auto mt-[10vh] w-full max-w-lg overflow-hidden rounded-overlay border border-line bg-card shadow-overlay outline-none"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-label="placeholder"
        >
          <div class="border-b border-line p-2">
            <!-- Палітра — передусім поле пошуку, тож fieldClass('md') дає
                 спільний з усіма полями бібліотеки вигляд. -->
            <input
              ref="inputEl"
              :value="query"
              type="text"
              role="combobox"
              aria-expanded="true"
              :aria-controls="listboxId"
              aria-autocomplete="list"
              :aria-activedescendant="matches.length ? optionId(activeIndex) : undefined"
              :placeholder="placeholder"
              :class="fieldClass('md')"
              @input="onSearch"
              @keydown="onPanelKeydown"
            />
          </div>

          <div
            :id="listboxId"
            role="listbox"
            class="scrollbar-thin max-h-80 overflow-y-auto overscroll-contain p-1.5"
          >
            <template v-if="matches.length > 0">
              <template
                v-for="row in rows"
                :key="row.type === 'item' ? `${row.group.id}/${row.item!.id}` : `label-${row.group.id}`"
              >
                <!-- v-if і v-for — на різних вузлах: у Vue 3 v-if має вищий
                     пріоритет і не бачив би змінну циклу. -->
                <div
                  v-if="row.type === 'label'"
                  role="presentation"
                  class="px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted"
                >
                  {{ row.group.label }}
                </div>
                <div
                  v-else
                  :id="optionId(row.index!)"
                  role="option"
                  :aria-selected="row.index === activeIndex"
                  class="flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-3 text-base transition-colors md:py-2 md:text-sm"
                  :class="row.index === activeIndex ? 'bg-primary-50 text-accent' : 'text-ink hover:bg-hover'"
                  @pointermove="onRowPointerMove(row.index!)"
                  @click="selectAt(row.index!)"
                >
                  <slot
                    name="item"
                    :item="row.item!"
                    :group="row.group"
                    :active="row.index === activeIndex"
                  >
                    <span class="min-w-0 truncate">{{ row.item!.label }}</span>
                    <span v-if="row.item!.hint" class="shrink-0 text-xs text-muted">
                      {{ row.item!.hint }}
                    </span>
                  </slot>
                </div>
              </template>
            </template>

            <div v-else class="px-3 py-6 text-center text-sm text-muted">
              <slot name="empty">{{ emptyText }}</slot>
            </div>
          </div>

          <!-- Підказки клавіш. Палітру відкривають хоткеєм, тобто з
               клавіатури — і саме тут людина вперше бачить, що стрілки й
               Enter працюють без миші. На дотику рядок зайвий. -->
          <div
            class="hidden items-center gap-4 border-t border-line bg-subtle px-3 py-2 text-xs text-muted pointer-fine:flex"
            aria-hidden="true"
          >
            <span class="flex items-center gap-1"><UiKbd combo="ArrowUp" /><UiKbd combo="ArrowDown" /> навігація</span>
            <span class="flex items-center gap-1"><UiKbd combo="Enter" /> обрати</span>
            <span class="ml-auto flex items-center gap-1"><UiKbd combo="Escape" /> закрити</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Тривалість задана явно через :duration у шаблоні, бо transition-и висять
 * на ДІТЯХ — з кореневого елемента Vue вивести її не може. Палітра легша за
 * модалку: поява --duration-base, вихід --duration-fast.
 */

.ui-command-palette-enter-active .ui-command-palette-backdrop {
  transition: opacity var(--duration-base) var(--ease-out);
}

.ui-command-palette-leave-active .ui-command-palette-backdrop {
  transition: opacity var(--duration-fast) var(--ease-in);
}

.ui-command-palette-enter-from .ui-command-palette-backdrop,
.ui-command-palette-leave-to .ui-command-palette-backdrop {
  opacity: 0;
}

.ui-command-palette-enter-active .ui-command-palette-panel {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-emphasized);
}

.ui-command-palette-leave-active .ui-command-palette-panel {
  transition:
    opacity var(--duration-fast) var(--ease-in),
    transform var(--duration-fast) var(--ease-emphasized);
}

.ui-command-palette-enter-from .ui-command-palette-panel,
.ui-command-palette-leave-to .ui-command-palette-panel {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .ui-command-palette-enter-active .ui-command-palette-backdrop,
  .ui-command-palette-leave-active .ui-command-palette-backdrop,
  .ui-command-palette-enter-active .ui-command-palette-panel,
  .ui-command-palette-leave-active .ui-command-palette-panel {
    transition-duration: 1ms;
  }

  .ui-command-palette-enter-from .ui-command-palette-panel,
  .ui-command-palette-leave-to .ui-command-palette-panel {
    transform: none;
  }
}
</style>
