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
import { computed } from 'vue'
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
    /**
     * Вигляд тригера.
     *
     * `corner` — кут шапки таблиці: іконка без рамки на смузі кольору
     * шапки, видна на наведенні на таблицю (`group/table` у хоста), з
     * клавіатури, поки панель відкрита, і завжди — на дотику. Позицію
     * (sticky, висоту шапки) задає ХОСТ: корінь тут свідомо без власного
     * `position`, бо хостовий `sticky` на тому самому вузлі з ним
     * конфліктував би.
     *
     * `toolbar` — повнорозмірна кнопка 45×45 у рядку над мобільними
     * картками, поруч із сортуванням.
     */
    trigger?: 'corner' | 'toolbar'
    /**
     * Скільки колонок, видимих типово, сховав користувач. Більше нуля —
     * крапка на тригері, видима і тоді, коли сам тригер схований.
     */
    hiddenCount?: number
    /**
     * Таблиця прокручується далі праворуч (`corner`). Тоді під правим
     * краєм кута — середина чужого заголовка, і підкладка закриває смугу
     * до самого краю; інакше там край останньої колонки з її хватом
     * ресайзу, і останні 4px лишаються відкритими.
     */
    overflowsRight?: boolean
  }>(),
  { pinned: undefined, trigger: 'corner', hiddenCount: 0, overflowsRight: false },
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

/*
 * Коли кутовий тригер видно. Чотири умови, і кожна закриває окремий шлях:
 * наведення на таблицю — миша; :focus-visible — клавіатура (Tab дістає
 * невидиму кнопку, і вона мусить проявитися); aria-expanded — панель
 * відкрита, а курсор уже на ній, тобто поза таблицею, і без цієї умови
 * якір панелі зникав би з-під неї; pointer-coarse — наведення на дотику не
 * буває взагалі.
 *
 * Ховається opacity, а не v-if чи visibility: кнопка лишається в
 * Tab-обході й у дереві доступності, змінюється лише те, що видно оком.
 */
const CORNER_REVEAL =
  'opacity-0 transition-opacity duration-(--duration-fast) group-hover/table:opacity-100 ' +
  'group-has-[:focus-visible]/corner:opacity-100 group-has-[[aria-expanded=true]]/corner:opacity-100 ' +
  'pointer-coarse:opacity-100'

/*
 * Невидима зона дотику кутового тригера. 45×45, як усюди, але корінь
 * обрізає її (overflow-clip) рівно по висоті шапки: у щільній шапці
 * (27px) повна зона залізла б на 9px у перший рядок, і тап по його
 * правому краю відкривав би налаштування замість рядка.
 */
const cornerButtonClass =
  'pointer-events-auto relative flex items-center justify-center rounded-control text-muted ' +
  'transition-colors hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const toolbarButtonClass =
  'relative flex h-12 w-12 items-center justify-center rounded-control border border-line bg-input ' +
  'text-muted transition-colors hover:text-ink active:bg-hover aria-expanded:text-ink ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Розмір кнопки йде за висотою шапки: h-7 у звичайній (38px), h-6 у
// щільній (27px) — інакше кнопка впиралась би в межі рядка.
const CORNER_SIZE = { sm: 'h-6 w-6', md: 'h-7 w-7' } as const
const CORNER_ICON = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4' } as const

const triggerLabel = computed(() =>
  props.hiddenCount > 0
    ? `Налаштування колонок (приховано: ${props.hiddenCount})`
    : 'Налаштування колонок',
)

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
  <!--
    Кутовий корінь — смуга заввишки з шапку: pointer-events-none, щоб
    крізь поля й підкладку клік доходив до заголовка під ними (сортування,
    хват ресайзу останньої колонки), і overflow-clip, що обрізає зону
    дотику по висоті шапки.
  -->
  <div
    :class="
      trigger === 'corner'
        ? 'group/corner pointer-events-none flex items-center overflow-clip pl-3 pr-1'
        : 'flex shrink-0'
    "
  >
    <!--
      Підкладка кольору шапки з м'яким краєм ліворуч. Без неї іконка
      лягала б просто на текст заголовка: на праворуч вирівняному підписі
      останньої колонки і на будь-якому заголовку, що опинився під кутом
      при горизонтальній прокрутці.

      right-1 лишає відкритими останні 4px — там хват ресайзу останньої
      колонки, і підкладка ховала б його. Але лише коли праворуч справді
      край таблиці: посеред прокрутки в цій смузі визирав би шматок
      літери чужого заголовка, і підкладка доходить до краю.
    -->
    <span
      v-if="trigger === 'corner'"
      class="absolute inset-y-0 left-0 flex"
      :class="[CORNER_REVEAL, overflowsRight ? 'right-0' : 'right-1']"
      aria-hidden="true"
    >
      <span class="w-3 shrink-0 bg-gradient-to-r from-transparent to-subtle" />
      <span class="flex-1 bg-subtle" />
    </span>

    <UiMenu width="20rem" placement="bottom-end" panel-role="dialog" aria-label="Налаштування колонок">
      <template #trigger="{ toggle, triggerAttrs }">
        <button
          v-bind="triggerAttrs"
          type="button"
          :class="
            trigger === 'corner'
              ? [cornerButtonClass, CORNER_SIZE[density], touchTargetClass]
              : toolbarButtonClass
          "
          :aria-label="triggerLabel"
          :title="triggerLabel"
          @click="toggle"
        >
          <svg
            :class="trigger === 'corner' ? [CORNER_REVEAL, CORNER_ICON[density]] : 'h-4 w-4'"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
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
          <!--
            Крапка — поза CORNER_REVEAL і видима навіть у спокої: схована
            колонка — єдиний стан розкладки, якого не видно в самій таблиці,
            і крапка показує, де шукати шлях назад.
          -->
          <span
            v-if="hiddenCount > 0"
            class="absolute rounded-full bg-accent-solid"
            :class="trigger === 'corner' ? 'right-0.5 top-0.5 h-1.5 w-1.5' : 'right-2 top-2 h-2 w-2'"
            aria-hidden="true"
          />
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
  </div>
</template>
