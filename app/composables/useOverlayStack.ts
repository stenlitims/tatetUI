import { computed, getCurrentScope, onScopeDispose, readonly, ref } from 'vue'
import type { ComputedRef } from 'vue'

/**
 * Єдиний стек шарів для всіх оверлеїв: UiModal, UiDrawer, UiConfirmDialog —
 * і плаваючих панелей: UiPopover, UiMenu, UiContextMenu, UiTooltip, UiHoverCard.
 *
 * Навіщо один стек на всіх. У вихідних проєктах кожен оверлей
 * рахував z-index сам: Modal мав власний стек із 1001+, Drawer —
 * захардкоджений z-[1000], ConfirmDialog — z-index: 99999. Через це drawer,
 * відкритий із модалки, опинявся ПІД нею, а два drawer'и один над одним
 * розрулювалися лише порядком у DOM. Спільний стек прибирає весь цей клас
 * багів і додає `isTopmost` — щоб Escape закривав тільки верхній оверлей,
 * а не всі відкриті одразу.
 *
 * Плаваючі панелі теж у стеку, бо інакше кожна вирішувала Escape і клік
 * «повз» сама: поповер перехоплював Escape у випадайки UiSelect усередині
 * себе, меню під діалогом закривалося замість діалогу, а Escape для
 * підказки в модалці закривав і модалку.
 *
 * Чому база 1000 і крок 10:
 *   - 1000 збігається з тим, що вже було в Drawer/Modal, тож нічого не
 *     «пірнає» під елементи сторінки;
 *   - крок 10 лишає місце для внутрішніх шарів панелі (sticky-хедер, футер);
 *   - UiSelect телепортує випадайку з z-[1100], тож перші ~10 шарів
 *     гарантовано лишаються нижче за неї — селект усередині оверлея видно.
 *
 * Стан модульний, а не через useState: він суто клієнтський, у payload SSR
 * йому робити нічого.
 */

/**
 * `import.meta.client` тут не використовується навмисно — це специфіка
 * Nuxt, а бібліотеку копіюють і у Vite-проєкти без нього. Перевірка на
 * document працює скрізь.
 */
const isClient = typeof document !== 'undefined'

export const OVERLAY_BASE_Z_INDEX = 1000
export const OVERLAY_Z_STEP = 10

const overlayStack = ref<string[]>([])
let overlayIdCounter = 0

/**
 * Поведінка шару понад саме місце в стеку. Модальні шари реєструють тут
 * лише onEscape; плаваючі — ще й межі для кліку «повз».
 */
interface LayerEntry {
  floating: boolean
  /**
   * Пасивний шар (підказка, hover-картка) отримує Escape, але не забирає
   * `isTopmost` у шару під собою: стрілки в галереї мають гортати, навіть
   * поки над кнопкою висить підказка.
   */
  passive: boolean
  onEscape?: (event: KeyboardEvent) => void
  elements?: () => Array<Element | null | undefined>
  onPointerDownOutside?: (event: PointerEvent) => void
  /** Прямі діти <body> на момент відкриття — усе пізніше є шаром над нами. */
  bodyChildren?: Set<Element>
}

const layerEntries = new Map<string, LayerEntry>()

export function useOverlayStack() {
  const push = (id: string): void => {
    if (!isClient || overlayStack.value.includes(id)) return
    overlayStack.value.push(id)
  }

  const remove = (id: string): void => {
    if (!isClient) return
    const index = overlayStack.value.indexOf(id)
    if (index > -1) overlayStack.value.splice(index, 1)
  }

  const indexOf = (id: string): number => overlayStack.value.indexOf(id)

  /** Пасивні шари над `id` не рахуються — див. LayerEntry.passive. */
  const isTopmost = (id: string): boolean => {
    for (let index = overlayStack.value.length - 1; index >= 0; index -= 1) {
      const current = overlayStack.value[index]!
      if (current === id) return true
      if (!layerEntries.get(current)?.passive) return false
    }
    return false
  }

  const zIndexFor = (id: string): number => {
    const index = overlayStack.value.indexOf(id)
    if (index === -1) return OVERLAY_BASE_Z_INDEX
    // Плаваючі панелі мають власну шкалу від 1100 (getOverlayChildZIndex) і
    // в крок модальних не входять: інакше відкрита підказка зсувала б
    // z-index модалки, що відкривається після неї.
    let modalIndex = 0
    for (let position = 0; position < index; position += 1) {
      if (!layerEntries.get(overlayStack.value[position]!)?.floating) modalIndex += 1
    }
    return OVERLAY_BASE_Z_INDEX + modalIndex * OVERLAY_Z_STEP
  }

  return { stack: readonly(overlayStack), push, remove, indexOf, isTopmost, zIndexFor }
}

/* ------------------------------------------------------------------ */
/*  Спільні слухачі: Escape і клік «повз»                             */
/* ------------------------------------------------------------------ */

/**
 * Escape дістається рівно ОДНОМУ шару — останньому в стеку.
 *
 * Фаза спливання, а не захоплення: UiSelect, UiCombobox і решта обробляють
 * Escape на своєму елементі й зупиняють його там. Слухач у фазі захоплення
 * випереджав їх — так поповер закривався цілком, коли людина лише хотіла
 * згорнути список селекта всередині нього.
 *
 * Якщо останній шар не передав onEscape (UiSidebar, UiLightbox мають власні
 * слухачі), нічого не робимо: вони розберуться самі через isTopmost.
 */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
  const topId = overlayStack.value[overlayStack.value.length - 1]
  const entry = topId ? layerEntries.get(topId) : undefined
  if (!entry?.onEscape) return
  // stopImmediatePropagation: інші оверлеї слухають той самий document, і
  // шар під нами, побачивши себе верхнім після нашого закриття, закрився б
  // тим самим натиском.
  event.preventDefault()
  event.stopImmediatePropagation()
  entry.onEscape(event)
}

/** Прямий нащадок <body>, у якому лежить вузол. */
function bodyChildOf(node: Node): Element | null {
  let current: Node | null = node
  while (current && current.parentNode !== document.body) current = current.parentNode
  return current instanceof Element ? current : null
}

/**
 * Клік «усередині» шару — це його власні елементи АБО будь-що, що з'явилося
 * в <body> після його відкриття: випадайка UiSelect, відкрита з поповера,
 * вкладене меню, діалог поверх. Список ролей-винятків ([role="dialog"])
 * тут не працює: меню в модалці переставало закриватися від кліку деінде в
 * тій самій модалці, бо вона теж dialog.
 */
function isInsideLayer(entry: LayerEntry, target: Node): boolean {
  if (entry.elements?.().some((element) => element?.contains(target))) return true
  const root = bodyChildOf(target)
  return !!root && !!entry.bodyChildren && !entry.bodyChildren.has(root)
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Node)) return
  // Копія і від верхнього до нижнього: обробники закривають шари прямо тут.
  const ids = [...overlayStack.value].reverse()
  for (const id of ids) {
    const entry = layerEntries.get(id)
    if (!entry?.onPointerDownOutside || isInsideLayer(entry, target)) continue
    entry.onPointerDownOutside(event)
  }
}

/*
 * Слухачі ставляться ОДИН раз, під час завантаження модуля — тобто раніше
 * за будь-який слухач компонента на тому ж document. Порядок тут і є
 * гарантія: Escape для підказки в UiLightbox встигає зупинитися до того, як
 * його побачить власний обробник галереї.
 *
 * Прапорець на window прибирає слухачі попередньої копії модуля після
 * гарячого перезавантаження, інакше в dev їх ставало б два.
 */
if (isClient) {
  const registry = window as Window & {
    __uiOverlayListeners?: { keydown: typeof onDocumentKeydown; pointerdown: typeof onDocumentPointerDown }
  }
  const previous = registry.__uiOverlayListeners
  if (previous) {
    document.removeEventListener('keydown', previous.keydown)
    document.removeEventListener('pointerdown', previous.pointerdown, true)
  }
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  registry.__uiOverlayListeners = { keydown: onDocumentKeydown, pointerdown: onDocumentPointerDown }
}

/* ------------------------------------------------------------------ */
/*  Модальний шар                                                      */
/* ------------------------------------------------------------------ */

export interface OverlayLayerOptions {
  /**
   * Escape, коли цей шар верхній. Спільний слухач гарантує, що спрацює
   * рівно один шар — і що підказка чи меню над ним отримають Escape першими.
   */
  onEscape?: (event: KeyboardEvent) => void
}

export interface OverlayLayer {
  id: string
  zIndex: ComputedRef<number>
  isTopmost: ComputedRef<boolean>
  activate: () => void
  /** Прибрати шар зі стеку, лишивши z-index на час анімації виходу. */
  deactivate: () => void
  /** Відпустити заморожений z-index. Викликати з `@after-leave`. */
  settle: () => void
}

/**
 * Обгортка «один компонент — один шар». Компонент лише кличе
 * activate()/deactivate() і читає zIndex/isTopmost.
 *
 * Шар виходить зі стеку ОДРАЗУ на закритті, а не по завершенні анімації.
 * Інакше будь-який незавершений leave (перервана анімація, фонова вкладка,
 * де не тікає requestAnimationFrame) лишав би мертвий запис у стеку — і
 * тоді isTopmost брехав би, а Escape перестав би закривати видимий оверлей.
 * Щоб панель, яка закривається, не пірнула під сусідній оверлей, її z-index
 * на цей час фіксується і відпускається у settle().
 */
export function useOverlayLayer(id?: string, options: OverlayLayerOptions = {}): OverlayLayer {
  const stack = useOverlayStack()
  const layerId = id ?? `overlay-${++overlayIdCounter}`
  const frozenZIndex = ref<number | null>(null)

  const activate = () => {
    frozenZIndex.value = null
    if (isClient && options.onEscape) {
      layerEntries.set(layerId, { floating: false, passive: false, onEscape: options.onEscape })
    }
    stack.push(layerId)
  }

  const deactivate = () => {
    if (stack.indexOf(layerId) > -1) frozenZIndex.value = stack.zIndexFor(layerId)
    stack.remove(layerId)
    layerEntries.delete(layerId)
  }

  const settle = () => {
    frozenZIndex.value = null
  }

  // Компонент може бути знищений у відкритому стані (навігація під час
  // відкритого drawer'а) — шар не має лишатися у стеку назавжди.
  if (getCurrentScope()) onScopeDispose(deactivate)

  return {
    id: layerId,
    zIndex: computed(() => frozenZIndex.value ?? stack.zIndexFor(layerId)),
    isTopmost: computed(() => stack.isTopmost(layerId)),
    activate,
    deactivate,
    settle,
  }
}

/* ------------------------------------------------------------------ */
/*  Плаваючий шар                                                      */
/* ------------------------------------------------------------------ */

export interface FloatingLayerOptions {
  /** Панель і її власник (тригер, корінь): натискання в них — не «повз». */
  elements: () => Array<Element | null | undefined>
  /** Escape, коли цей шар останній у стеку. */
  onEscape?: (event: KeyboardEvent) => void
  /** Натискання поза шаром і поза всім, що відкрилося пізніше за нього. */
  onPointerDownOutside?: (event: PointerEvent) => void
  /**
   * Підказка чи hover-картка: отримує Escape, але не забирає `isTopmost` у
   * шару під собою — див. LayerEntry.passive.
   */
  passive?: boolean
}

export interface FloatingLayer {
  id: string
  /** Чи цей шар зараз верхній (пасивні шари над ним не рахуються). */
  isTopmost: ComputedRef<boolean>
  /** Зареєструвати панель, що відкрилася. Повторний виклик нічого не робить. */
  activate: () => void
  /** Зняти панель зі стеку. Повторний виклик нічого не робить. */
  deactivate: () => void
}

/**
 * Шар для немодальних панелей: UiPopover, UiMenu, UiContextMenu, UiTooltip,
 * UiHoverCard. Компонент кличе activate() на відкритті й deactivate() на
 * закритті, а Escape і клік «повз» приходять у передані обробники.
 */
export function useFloatingLayer(options: FloatingLayerOptions): FloatingLayer {
  const stack = useOverlayStack()
  const layerId = `floating-${++overlayIdCounter}`

  const activate = () => {
    if (!isClient || layerEntries.has(layerId)) return
    layerEntries.set(layerId, {
      floating: true,
      passive: !!options.passive,
      onEscape: options.onEscape,
      elements: options.elements,
      onPointerDownOutside: options.onPointerDownOutside,
      bodyChildren: new Set(Array.from(document.body.children)),
    })
    stack.push(layerId)
  }

  const deactivate = () => {
    if (!layerEntries.has(layerId)) return
    stack.remove(layerId)
    layerEntries.delete(layerId)
  }

  if (getCurrentScope()) onScopeDispose(deactivate)

  return {
    id: layerId,
    isTopmost: computed(() => stack.isTopmost(layerId)),
    activate,
    deactivate,
  }
}
