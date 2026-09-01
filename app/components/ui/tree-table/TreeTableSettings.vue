<script setup lang="ts">
/*
 * Панель налаштувань колонок дерева-таблиці.
 *
 * Винесена з UiTreeTable за одним критерієм — тут НЕМАЄ жодного
 * споживацького слота. Рядки за тим самим критерієм лишились у
 * головному файлі: слоти `cell-*` довелося б прокидати через v-for по
 * $slots, що не типізується проти defineSlots і вбило б секцію «Слоти»
 * в таблиці API (language-tools#3429).
 *
 * Тека `tree-table/` не потрапляє ні в readdir(UI_DIR) перевірки
 * документації, ні в хук prerender:routes — обидва нерекурсивні. Тож
 * власної сторінки цей файл не потребує, як і RteToolbar.
 */
import UiMenu from '../UiMenu.vue'
import { clampWidth } from '~/utils/treeTable'

/*
 * Структурний тип замість імпорту TreeTableHeader із UiTreeTable.vue:
 * той імпортує цей файл, і типовий імпорт назад замкнув би коло.
 * Структурна типізація робить TreeTableHeader[] сумісним і без нього.
 */
interface SettingsColumn {
  value: string
  text: string
  title?: string
  width?: number
  flex?: boolean
  required?: boolean
  visible?: boolean
}

const props = defineProps<{
  /** Робоча копія колонок — та сама, що йде в `<colgroup>`. */
  headers: SettingsColumn[]
  /** Поточна щільність. Вона ж обирає висоту рядка. */
  density: 'sm' | 'md'
  /** Показати перемикач щільності. */
  densityToggle: boolean
  /** Колонка ієрархії: її не можна ні сховати, ні зрушити з місця. */
  pinned: string
}>()

const emit = defineEmits<{
  'update:headers': [value: SettingsColumn[]]
  'update:density': [value: 'sm' | 'md']
  reset: []
}>()

defineSlots<Record<string, never>>()

// Невидима зона дотику 45×45 для дрібних кнопок панелі. Вимагає relative
// на самій кнопці. Літерал, а не інтерполяція: JIT сканує рядки коду.
const touchTargetClass =
  'pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 ' +
  'pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 ' +
  "pointer-coarse:after:content-[''] pointer-coarse:after:h-12 pointer-coarse:after:w-12"

const iconButtonClass =
  'relative flex h-8 w-8 items-center justify-center rounded-control text-muted transition-colors ' +
  'hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

function label(header: SettingsColumn) {
  return header.title || header.text || header.value
}

function visibleCount() {
  return props.headers.filter((header) => header.visible !== false).length
}

/**
 * Колонку ієрархії ховати не можна ніколи: вона несе відступ, шеврон і
 * напрямні. Без неї решта перетворюється на плоску таблицю, у якій
 * вкладеність існує, але не видима — гірше за відсутню колонку.
 */
function canHide(header: SettingsColumn) {
  if (header.value === props.pinned || header.required) return false
  return visibleCount() > 1
}

function toggleVisibility(header: SettingsColumn) {
  const visible = header.visible !== false
  if (visible && !canHide(header)) return
  emit(
    'update:headers',
    props.headers.map((item) =>
      item.value === header.value ? { ...item, visible: !visible } : item,
    ),
  )
}

function move(index: number, delta: number) {
  // Індекс 0 — колонка ієрархії: ані вона не рухається, ані під неї не
  // підставляються інші.
  const target = index + delta
  if (index === 0 || target < 1 || target >= props.headers.length) return
  const next = [...props.headers]
  const [column] = next.splice(index, 1)
  next.splice(target, 0, column!)
  emit('update:headers', next)
}

const dragIndex = { value: -1 }

function onDragStart(index: number, event: DragEvent) {
  if (index === 0) {
    event.preventDefault()
    return
  }
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = -1
  if (from < 1) return
  const to = Math.max(1, index)
  if (from === to) return
  const next = [...props.headers]
  const [column] = next.splice(from, 1)
  next.splice(to, 0, column!)
  emit('update:headers', next)
}

function setWidth(header: SettingsColumn, raw: string) {
  const width = clampWidth(Number(raw))
  emit(
    'update:headers',
    props.headers.map((item) => (item.value === header.value ? { ...item, width } : item)),
  )
}

function showAll() {
  emit(
    'update:headers',
    props.headers.map((header) => ({ ...header, visible: true })),
  )
}
</script>

<template>
  <UiMenu width="20rem" placement="bottom-end" panel-role="dialog" aria-label="Налаштування колонок">
    <template #trigger="{ toggle, triggerAttrs }">
      <button
        v-bind="triggerAttrs"
        type="button"
        :class="[iconButtonClass, touchTargetClass]"
        class="h-9 w-9"
        aria-label="Налаштування колонок"
        @click="toggle"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle cx="8" cy="6" r="2" fill="currentColor" />
          <circle cx="16" cy="12" r="2" fill="currentColor" />
          <circle cx="10" cy="18" r="2" fill="currentColor" />
        </svg>
      </button>
    </template>

    <template #content>
      <div v-if="densityToggle" class="border-b border-line px-3 py-2">
        <p class="mb-1.5 text-xs font-medium text-muted">Щільність</p>
        <div class="flex gap-1">
          <button
            v-for="option in (['sm', 'md'] as const)"
            :key="option"
            type="button"
            class="flex-1 rounded-control border px-2 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="
              density === option
                ? 'border-primary-200 bg-primary-50 text-accent'
                : 'border-line text-muted hover:bg-hover'
            "
            @click="emit('update:density', option)"
          >
            {{ option === 'sm' ? 'Щільно' : 'Звичайно' }}
          </button>
        </div>
        <!--
          Щільність тут міняє ВИСОТУ рядка, а не паддінг: висота входить
          в арифметику вікна множенням, тож мусить бути числом ще до
          рендеру. Наслідок — перемикач зсуває всю геометрію списку.
        -->
      </div>

      <div class="scrollbar-thin max-h-72 overflow-y-auto py-1">
        <div
          v-for="(header, index) in headers"
          :key="header.value"
          class="flex items-center gap-2 px-2 py-1.5 hover:bg-hover"
          :draggable="index > 0"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent
          @drop.prevent="onDrop(index)"
        >
          <span
            class="text-muted"
            :class="index > 0 ? 'cursor-grab active:cursor-grabbing' : 'opacity-30'"
            aria-hidden="true"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </span>

          <label class="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              class="shrink-0 accent-[var(--accent-solid)]"
              :checked="header.visible !== false"
              :disabled="header.visible !== false && !canHide(header)"
              @change="toggleVisibility(header)"
            />
            <span class="truncate">{{ label(header) }}</span>
          </label>

          <div class="flex shrink-0 gap-0.5">
            <button
              type="button"
              :class="[iconButtonClass, touchTargetClass]"
              :disabled="index <= 1"
              :aria-label="`Перемістити «${label(header)}» вище`"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :class="[iconButtonClass, touchTargetClass]"
              :disabled="index === 0 || index === headers.length - 1"
              :aria-label="`Перемістити «${label(header)}» нижче`"
              @click="move(index, 1)"
            >
              ↓
            </button>
          </div>

          <input
            v-if="!header.flex"
            type="number"
            class="w-16 shrink-0 rounded-control border border-line bg-input px-1.5 py-1 text-right text-xs text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :value="header.width"
            :min="40"
            :max="800"
            aria-label="Ширина колонки, px"
            @change="setWidth(header, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="flex gap-1 border-t border-line px-2 py-2">
        <button
          type="button"
          class="flex-1 rounded-control px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="showAll"
        >
          Показати всі
        </button>
        <button
          type="button"
          class="flex-1 rounded-control px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="emit('reset')"
        >
          Скинути
        </button>
      </div>
    </template>
  </UiMenu>
</template>
