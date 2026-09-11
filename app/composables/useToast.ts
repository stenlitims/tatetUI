import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  /** Напис на кнопці. */
  label: string
  /** Дія кнопки. Тост НЕ закривається сам — закривайте через `dismiss(id)`, коли потрібно. */
  onClick: () => void
}

export interface ToastOptions {
  /** Жирний рядок над повідомленням. Необов'язковий. */
  title?: string
  message: string
  type?: ToastType
  /** Скільки тримати на екрані, мс. `0` — не ховати автоматично. */
  duration?: number
  /**
   * Рядок кнопок під повідомленням (зазвичай «Скасувати», «Повторити»).
   * Слотом не зробити: useToast() викликається з будь-якого місця
   * застосунку, а не з шаблону, тож дії — лише дані. Кнопки малює
   * контейнер.
   */
  actions?: ToastAction[]
}

export interface Toast {
  id: number
  title?: string
  message: string
  type: ToastType
  actions?: ToastAction[]
  /** Повна тривалість показу, мс. `0` — без автозакриття. */
  duration: number
}

/**
 * Черга тостів.
 *
 * Стан оголошено НА РІВНІ МОДУЛЯ, а не всередині функції — тому це
 * singleton: усі виклики useToast() у застосунку працюють з однією чергою.
 * Так глобальне повідомлення можна показати з будь-якого місця, не
 * прокидаючи нічого через дерево компонентів і не заводячи Pinia-стор.
 *
 * Контейнер (UiToaster) монтується РІВНО ОДИН раз — зазвичай у app.vue.
 */
const toasts = ref<Toast[]>([])
let toastId = 0

/*
 * Таймери тримаємо окремо, щоб скасувати їх при ручному закритті.
 * У вихідній версії таймер лишався жити: користувач закривав тост
 * хрестиком, а через секунду спрацьовував відкладений splice і зносив
 * ІНШИЙ тост, який на той час опинився на його місці в масиві.
 */
interface Timer {
  handle: ReturnType<typeof setTimeout> | null
  /** Скільки лишилося, мс — щоб продовжити після паузи з того ж місця. */
  remaining: number
  startedAt: number
}

const timers = new Map<number, Timer>()

function clearTimer(id: number) {
  const timer = timers.get(id)
  if (!timer) return
  if (timer.handle) clearTimeout(timer.handle)
  timers.delete(id)
}

function startTimer(id: number, remaining: number, onDone: () => void) {
  timers.set(id, {
    handle: setTimeout(onDone, remaining),
    remaining,
    startedAt: Date.now(),
  })
}

export function useToast() {
  /** Прибрати тост негайно, з анімацією виходу. */
  function dismiss(id: number) {
    clearTimer(id)
    // TransitionGroup тримає вилучений vnode до завершення leave-анімації.
    // Окремий 300ms setTimeout лише затримував старт анімації і залишав
    // другий таймер, який уже не належав черзі.
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  /** Прибрати всю чергу, включно з постійними тостами, і скасувати таймери. */
  function dismissAll(): void {
    for (const id of timers.keys()) clearTimer(id)
    toasts.value = []
  }

  /**
   * Зупинити відлік автозакриття — поки курсор чи фокус на тості.
   *
   * Без паузи тост з кнопкою «Скасувати» зникає саме тоді, коли користувач
   * веде до неї курсор: середній час прочитати повідомлення і навести —
   * близько трьох секунд, тобто рівно типова тривалість.
   */
  function pause(id: number) {
    const timer = timers.get(id)
    if (!timer?.handle) return
    clearTimeout(timer.handle)
    timer.handle = null
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
  }

  /** Продовжити відлік із того місця, де його зупинив `pause`. */
  function resume(id: number) {
    const timer = timers.get(id)
    if (!timer || timer.handle) return
    // Мінімум секунда після того, як курсор пішов: якщо лишалося 50 мс,
    // тост зник би з-під курсора, ніби його змахнули.
    startTimer(id, Math.max(timer.remaining, 1000), () => dismiss(id))
  }

  /** Показати тост. Повертає його id — його можна передати в `dismiss`. */
  function show(options: ToastOptions): number {
    const id = toastId++
    const duration = options.duration ?? 3000
    toasts.value.push({
      id,
      title: options.title,
      message: options.message,
      type: options.type ?? 'info',
      actions: options.actions,
      duration,
    })

    if (duration > 0) startTimer(id, duration, () => dismiss(id))
    return id
  }

  const success = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ ...options, message, type: 'success' })

  const error = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    // Помилку тримаємо довше: користувач має встигнути її прочитати, а не
    // побачити спалах на місці, де щойно щось пішло не так.
    show({ duration: 6000, ...options, message, type: 'error' })

  const warning = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ duration: 5000, ...options, message, type: 'warning' })

  const info = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ ...options, message, type: 'info' })

  return { toasts, show, dismiss, dismissAll, pause, resume, success, error, warning, info }
}
