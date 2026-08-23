import { computed, getCurrentScope, onScopeDispose, readonly, ref } from 'vue'
import type { ComputedRef } from 'vue'

/**
 * Єдиний стек шарів для всіх оверлеїв: UiModal, UiDrawer, UiConfirmDialog.
 *
 * Навіщо один стек на три компоненти. У вихідних проєктах кожен оверлей
 * рахував z-index сам: Modal мав власний стек із 1001+, Drawer —
 * захардкоджений z-[1000], ConfirmDialog — z-index: 99999. Через це drawer,
 * відкритий із модалки, опинявся ПІД нею, а два drawer'и один над одним
 * розрулювалися лише порядком у DOM. Спільний стек прибирає весь цей клас
 * багів і додає `isTopmost` — щоб Escape закривав тільки верхній оверлей,
 * а не всі відкриті одразу.
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
 * Nuxt, а бібліотеку копіюють і у Vite-проєкти без нього (ClayArenaChat,
 * DashClayarena). Перевірка на document працює скрізь.
 */
const isClient = typeof document !== 'undefined'

export const OVERLAY_BASE_Z_INDEX = 1000
export const OVERLAY_Z_STEP = 10

const overlayStack = ref<string[]>([])
let overlayIdCounter = 0

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

  const isTopmost = (id: string): boolean =>
    overlayStack.value.length > 0 && overlayStack.value[overlayStack.value.length - 1] === id

  const zIndexFor = (id: string): number => {
    const index = overlayStack.value.indexOf(id)
    return index > -1 ? OVERLAY_BASE_Z_INDEX + index * OVERLAY_Z_STEP : OVERLAY_BASE_Z_INDEX
  }

  return { stack: readonly(overlayStack), push, remove, indexOf, isTopmost, zIndexFor }
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
export function useOverlayLayer(id?: string): OverlayLayer {
  const stack = useOverlayStack()
  const layerId = id ?? `overlay-${++overlayIdCounter}`
  const frozenZIndex = ref<number | null>(null)

  const activate = () => {
    frozenZIndex.value = null
    stack.push(layerId)
  }

  const deactivate = () => {
    if (stack.indexOf(layerId) > -1) frozenZIndex.value = stack.zIndexFor(layerId)
    stack.remove(layerId)
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
