import { ref, shallowRef } from 'vue'

export interface ConfirmInputOptions {
  label?: string
  placeholder?: string
  initialValue?: string
  /** Порожнє значення блокує підтвердження замість того, щоб віддати ''. */
  required?: boolean
}

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** Забарвлює кнопку підтвердження в небезпечний тон. */
  danger?: boolean
  /** Прибирає кнопку скасування — режим «повідомити». */
  hideCancel?: boolean
  /** Наявність робить діалог полем введення (`prompt`). */
  input?: ConfirmInputOptions | null
}

const DEFAULTS: Required<Omit<ConfirmOptions, 'input'>> & { input: ConfirmInputOptions | null } = {
  title: 'Підтвердіть дію',
  message: '',
  confirmText: 'Підтвердити',
  cancelText: 'Скасувати',
  danger: false,
  hideCancel: false,
  input: null,
}

/**
 * Імперативні діалоги: `await confirm(...)` замість window.confirm.
 *
 * Стан оголошено на рівні модуля — singleton, як і в useToast. Компонент
 * UiConfirmDialog монтується РІВНО ОДИН раз (зазвичай у app.vue) і є суто
 * рендерером: усе рішення приймає ця функція.
 *
 * Навіщо взагалі замінювати window.confirm: він блокує потік, не
 * стилізується, у деяких браузерах його можна назавжди вимкнути галочкою
 * «більше не показувати», і він не працює в iframe із sandbox.
 */
const isOpen = ref(false)
const options = ref({ ...DEFAULTS })
const inputValue = ref('')

// shallowRef: тут лежить функція, і робити її реактивною глибоко немає сенсу.
const resolvePromise = shallowRef<((value: never) => void) | null>(null)

function settle(value: boolean | string | null) {
  const resolve = resolvePromise.value
  resolvePromise.value = null
  isOpen.value = false
  resolve?.(value as never)
}

export function useConfirm() {
  /**
   * Показує діалог і бере на себе проміс виклику.
   *
   * Резолвер приходить АРГУМЕНТОМ і лягає в `resolvePromise` лише після
   * перевірки нижче. Якщо записати його до неї — а саме так тут колись і
   * було, — перевірка «чи відкритий попередній діалог» бачила щойно
   * записаний власний резолвер і гасила його: кожен confirm() віддавав
   * false ще до появи діалога на екрані, кнопки лишалися без ефекту.
   */
  function open(next: ConfirmOptions, resolve: (value: never) => void): void {
    // Другий виклик, поки перший ще відкритий: закриваємо перший як
    // «скасовано». Інакше його проміс не зарезолвиться ніколи, і await на
    // ньому зависне назавжди. Значення — те саме, що дала б кнопка
    // скасування ТОГО діалога: витіснений prompt чекає на string | null.
    if (resolvePromise.value) settle(options.value.input ? null : false)

    resolvePromise.value = resolve

    options.value = {
      ...DEFAULTS,
      // input скидається ЯВНО через DEFAULTS: без цього поле введення від
      // попереднього prompt() протекло б у наступний звичайний confirm().
      ...next,
    }
    inputValue.value = next.input?.initialValue ?? ''
    isOpen.value = true
  }

  /** Питання «так/ні». Повертає `true`, якщо підтверджено. */
  function confirm(messageOrOptions: string | ConfirmOptions): Promise<boolean> {
    const next =
      typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions
    return new Promise<boolean>((resolve) => {
      open({ ...next, input: null }, resolve as (value: never) => void)
    })
  }

  /** Повідомлення з однією кнопкою. */
  function alert(messageOrOptions: string | ConfirmOptions): Promise<boolean> {
    const next =
      typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions
    return new Promise<boolean>((resolve) => {
      open(
        { confirmText: 'Зрозуміло', ...next, hideCancel: true, input: null },
        resolve as (value: never) => void,
      )
    })
  }

  /** Запит рядка. Повертає введене або `null`, якщо скасовано. */
  function promptText(next: ConfirmOptions & { input?: ConfirmInputOptions }): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      open({ ...next, input: next.input ?? {} }, resolve as (value: never) => void)
    })
  }

  return {
    confirm,
    alert,
    prompt: promptText,
    // Нижче — для UiConfirmDialog; у прикладному коді не потрібне.
    _state: { isOpen, options, inputValue },
    _accept: () => {
      const input = options.value.input
      if (input) {
        if (input.required && !inputValue.value.trim()) return
        settle(inputValue.value)
        return
      }
      settle(true)
    },
    _cancel: () => settle(options.value.input ? null : false),
  }
}
