<script setup lang="ts">
/*
 * Панель налаштувань колонок — СПІЛЬНА для UiTable і UiTreeTable.
 *
 * Раніше цей екран існував двічі: власна копія в кожній таблиці. Копії
 * розійшлися рівно так, як розходяться всі копії — у дереві кнопки
 * порядку отримали зону дотику й SVG-стрілки, у плоскій таблиці лишились
 * текстові «↑↓» без зони; ширина колонки в одній мала табличні цифри, в
 * іншій ні. Спільний файл робить розбіжність неможливою, а не
 * малоймовірною.
 *
 * Тека `table/` не потрапляє ні в readdir(UI_DIR) перевірки документації,
 * ні в хук prerender:routes — обидва нерекурсивні. Тож власної сторінки
 * цей файл не потребує, як і RteToolbar.
 */
import UiMenu from '../UiMenu.vue'
import { clampWidth } from '~/utils/tableColumns'

/*
 * Структурний тип замість імпорту TableHeader/TreeTableHeader: обидві
 * таблиці імпортують цей файл, і типовий імпорт назад замкнув би коло.
 * Структурна типізація робить обидва масиви сумісними і без нього.
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

const props = withDefaults(
  defineProps<{
    /** Робоча копія колонок — та сама, що йде в `<colgroup>`. */
    headers: SettingsColumn[]
    /** Поточна щільність. У дереві вона ж обирає висоту рядка. */
    density: 'sm' | 'md'
    /** Показати перемикач щільності. */
    densityToggle: boolean
    /**
     * Колонка, закріплена першою: її не можна ні сховати, ні зрушити з
     * місця. У дереві це колонка ієрархії; у плоскій таблиці закріпленої
     * колонки немає, і проп не передають.
     */
    pinned?: string
  }>(),
  { pinned: undefined },
)

const emit = defineEmits<{
  'update:headers': [value: SettingsColumn[]]
  'update:density': [value: 'sm' | 'md']
  reset: []
}>()

defineSlots<{
  /** Додаткова секція над кнопками скидання: у дерева — керування гілками. */
  extra?: () => unknown
}>()

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

/** Перший індекс, який взагалі можна рухати. Закріплена колонка — нульовий. */
const firstMovable = () => (props.pinned ? 1 : 0)

function label(header: SettingsColumn) {
  return header.title || header.text || header.value
}

function visibleCount() {
  return props.headers.filter((header) => header.visible !== false).length
}

/**
 * Останню видиму колонку сховати не можна: це давало б `colspan="0"` і
 * таблицю без жодного шляху назад. Закріплену — теж ніколи: у дереві
 * саме вона несе відступ, шеврон і напрямні, без неї вкладеність існує,
 * але не видима.
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
  const min = firstMovable()
  const target = index + delta
  if (index < min || target < min || target >= props.headers.length) return
  const next = [...props.headers]
  const [column] = next.splice(index, 1)
  next.splice(target, 0, column!)
  emit('update:headers', next)
}

/*
 * Індекс перетягування — звичайний об'єкт, а не ref: він не бере участі в
 * рендері, і реактивність тут коштувала б перерахунку на кожен dragover.
 */
const dragIndex = { value: -1 }

function onDragStart(index: number, event: DragEvent) {
  if (index < firstMovable()) {
    event.preventDefault()
    return
  }
  dragIndex.value = index
  // Firefox не почне перетягування без setData.
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = -1
  const min = firstMovable()
  if (from < min) return
  const to = Math.max(min, index)
  if (from === to) return
  const next = [...props.headers]
  const [column] = next.splice(from, 1)
  next.splice(to, 0, column!)
  emit('update:headers', next)
}

function setWidth(header: SettingsColumn, raw: string) {
  const parsed = Number(raw)
  // Порожнє поле дає NaN — лишаємо ширину як є, а не скидаємо в мінімум.
  if (!Number.isFinite(parsed)) return
  const width = clampWidth(parsed)
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
            class="h-12 flex-1 rounded-control border px-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-auto md:py-1.5 md:text-xs"
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
          У дереві щільність міняє ВИСОТУ рядка, а не паддінг: висота
          входить в арифметику вікна множенням, тож мусить бути числом ще
          до рендеру. У плоскій таблиці рядок росте за вмістом, і там це
          саме паддінг. Панель однакова, наслідок різний — і це єдина
          різниця, яку варто тримати в голові.
        -->
      </div>

      <div class="scrollbar-thin max-h-72 overflow-y-auto py-1">
        <div
          v-for="(header, index) in headers"
          :key="header.value"
          class="flex items-center gap-2 px-2 transition-colors hover:bg-hover md:py-1.5"
          :draggable="index >= (pinned ? 1 : 0)"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent
          @drop.prevent="onDrop(index)"
        >
          <span
            class="text-muted"
            :class="index >= (pinned ? 1 : 0) ? 'cursor-grab active:cursor-grabbing' : 'opacity-30'"
            aria-hidden="true"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </span>

          <!-- На дотику ціль — увесь рядок мітки (min-h-12), а не 13px
               нативного квадратика. -->
          <label class="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[15px] text-ink md:min-h-0 md:gap-2 md:text-sm">
            <input
              type="checkbox"
              class="h-4 w-4 shrink-0 accent-[var(--accent-solid)] md:h-auto md:w-auto"
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
              :disabled="index <= (pinned ? 1 : 0)"
              :aria-label="`Перемістити «${label(header)}» вище`"
              @click="move(index, -1)"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              :class="[iconButtonClass, touchTargetClass]"
              :disabled="index < (pinned ? 1 : 0) || index === headers.length - 1"
              :aria-label="`Перемістити «${label(header)}» нижче`"
              @click="move(index, 1)"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <input
            v-if="!header.flex"
            type="number"
            class="h-11 w-16 shrink-0 rounded-control border border-line bg-input px-1.5 text-right text-[16px] tabular-nums text-ink md:h-auto md:py-1 md:text-xs transition-[border-color,box-shadow] hover:border-line-strong focus:outline-none focus-visible:border-accent-solid focus-visible:ring-[3px] focus-visible:ring-ring/30"
            :value="header.width"
            :min="40"
            :max="800"
            aria-label="Ширина колонки, px"
            @change="setWidth(header, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <slot name="extra" />

      <div class="flex gap-1 border-t border-line px-2 py-2">
        <button
          type="button"
          class="h-12 flex-1 rounded-control px-2 text-sm text-muted transition-colors hover:bg-hover hover:text-ink active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-auto md:py-1.5 md:text-xs"
          @click="showAll"
        >
          Показати всі
        </button>
        <button
          type="button"
          class="h-12 flex-1 rounded-control px-2 text-sm text-muted transition-colors hover:bg-hover hover:text-ink active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-auto md:py-1.5 md:text-xs"
          @click="emit('reset')"
        >
          Скинути
        </button>
      </div>
    </template>
  </UiMenu>
</template>
