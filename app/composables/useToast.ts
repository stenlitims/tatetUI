import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  /** Жирний рядок над повідомленням. Необов'язковий. */
  title?: string
  message: string
  type?: ToastType
  /** Скільки тримати на екрані, мс. `0` — не ховати автоматично. */
  duration?: number
}

export interface Toast {
  id: number
  title?: string
  message: string
  type: ToastType
  /** false вмикає leave-анімацію; сам запис видаляється через 300 мс. */
  isVisible: boolean
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
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function clearTimer(id: number) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

export function useToast() {
  /** Прибрати тост негайно, з анімацією виходу. */
  function dismiss(id: number) {
    clearTimer(id)
    const toast = toasts.value.find((item) => item.id === id)
    if (!toast) return
    toast.isVisible = false
    // Двофазне зникнення: спершу гасимо, потім видаляємо — інакше
    // leave-анімація не встигає програтись.
    setTimeout(() => {
      toasts.value = toasts.value.filter((item) => item.id !== id)
    }, 300)
  }

  /** Показати тост. Повертає його id — його можна передати в `dismiss`. */
  function show(options: ToastOptions): number {
    const id = toastId++
    toasts.value.push({
      id,
      title: options.title,
      message: options.message,
      type: options.type ?? 'info',
      isVisible: true,
    })

    const duration = options.duration ?? 3000
    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    }
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

  return { toasts, show, dismiss, success, error, warning, info }
}
