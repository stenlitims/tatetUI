import { ref } from 'vue'

/** `loading` — стан без автозакриття, з якого `toast.promise` переходить у результат. */
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

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
  /**
   * Скільки тримати на екрані, мс. `0` — не ховати автоматично. Без
   * значення — за типом (3 с, попередження 5 с, помилка 6 с), а з
   * `actions` — щонайменше 10 с.
   */
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

/** Тексти для `toast.promise`: стан очікування і два результати. */
export interface ToastPromiseMessages<T> {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((reason: unknown) => string)
}

/*
 * Помилку тримаємо довше: користувач має встигнути її прочитати, а не
 * побачити спалах на місці, де щойно щось пішло не так.
 */
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 6000,
  loading: 0,
}

/*
 * Тост із кнопкою мусить жити довше за 3 с: за цей час треба прочитати
 * текст, вирішити і дотягтися до «Скасувати» — з клавіатури ще й дістатися
 * до області сповіщень через F8. Інакше дія зникає саме тоді, коли по неї
 * тягнуться.
 */
const ACTION_DURATION = 10_000

function defaultDuration(type: ToastType, actions?: ToastAction[]): number {
  const base = DEFAULT_DURATION[type]
  return actions?.length && base > 0 ? Math.max(base, ACTION_DURATION) : base
}

/**
 * Черга тостів.
 *
 * Стан оголошено НА РІВНІ МОДУЛЯ, а не всередині функції — тому це
 * singleton: усі виклики useToast() у застосунку працюють з однією чергою.
 * Так глобальне повідомлення можна показати з будь-якого місця, не
 * прокидаючи нічого через дерево компонентів і не заводячи Pinia-стор.
 *
 * Зворотний бік singleton'а — сервер: там модуль один на ВСІ запити. Тому
 * на сервері show() нічого не додає (див. нижче).
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
    // На сервері черга спільна для всіх запитів: тост, піднятий під час
    // рендеру одного користувача, потрапляв у HTML наступного, а таймер
    // крутився в Node. Показувати тост на сервері все одно нікому.
    if (typeof document === 'undefined') return -1

    const id = toastId++
    const type = options.type ?? 'info'
    const duration = options.duration ?? defaultDuration(type, options.actions)
    toasts.value.push({
      id,
      title: options.title,
      message: options.message,
      type,
      actions: options.actions,
      duration,
    })

    if (duration > 0) startTimer(id, duration, () => dismiss(id))
    return id
  }

  /**
   * Змінити тост на місці: «Завантаження…» → «Готово» без зникнення і
   * повторної появи картки.
   *
   * Відлік автозакриття починається заново — новий текст теж треба встигнути
   * прочитати. Зміна типу без явного `duration` бере тривалість нового типу.
   * Закритий тост не воскресає.
   */
  function update(id: number, patch: Partial<ToastOptions>): void {
    const current = toasts.value.find((item) => item.id === id)
    if (!current) return

    const type = patch.type ?? current.type
    const actions = 'actions' in patch ? patch.actions : current.actions
    const duration =
      patch.duration ??
      (type !== current.type || 'actions' in patch ? defaultDuration(type, actions) : current.duration)
    const next: Toast = {
      ...current,
      title: 'title' in patch ? patch.title : current.title,
      message: patch.message ?? current.message,
      type,
      actions,
      duration,
    }
    toasts.value = toasts.value.map((item) => (item.id === id ? next : item))

    // Тост на паузі (курсор чи фокус на ньому) лишається на паузі, але з
    // повним новим часом — інакше він зник би з-під курсора.
    const paused = timers.get(id)?.handle === null
    clearTimer(id)
    if (duration <= 0) return
    if (paused) timers.set(id, { handle: null, remaining: duration, startedAt: Date.now() })
    else startTimer(id, duration, () => dismiss(id))
  }

  /**
   * Тост на час проміса: `loading` без автозакриття, потім success або
   * error у тій самій картці. Повертає той самий проміс — його можна
   * await'ити далі, помилка дійде до викликача.
   */
  function promise<T>(
    task: Promise<T>,
    messages: ToastPromiseMessages<T>,
    options: Omit<ToastOptions, 'message' | 'type' | 'duration'> = {},
  ): Promise<T> {
    const id = show({ ...options, message: messages.loading, type: 'loading', duration: 0 })
    task.then(
      (value) =>
        update(id, {
          type: 'success',
          message: typeof messages.success === 'function' ? messages.success(value) : messages.success,
        }),
      (reason: unknown) =>
        update(id, {
          type: 'error',
          message: typeof messages.error === 'function' ? messages.error(reason) : messages.error,
        }),
    )
    return task
  }

  const success = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ ...options, message, type: 'success' })

  const error = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ ...options, message, type: 'error' })

  const warning = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ ...options, message, type: 'warning' })

  const info = (message: string, options?: Omit<ToastOptions, 'type' | 'message'>) =>
    show({ ...options, message, type: 'info' })

  /** Стан очікування без автозакриття; завершіть через `update` або `dismiss`. */
  const loading = (message: string, options?: Omit<ToastOptions, 'type' | 'message' | 'duration'>) =>
    show({ ...options, message, type: 'loading', duration: 0 })

  return {
    toasts,
    show,
    update,
    promise,
    dismiss,
    dismissAll,
    pause,
    resume,
    success,
    error,
    warning,
    info,
    loading,
  }
}
