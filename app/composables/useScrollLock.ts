import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * Блокування прокрутки сторінки під оверлеєм — зі счітчиком і робоче на iOS.
 *
 * Дві проблеми, які це лікує:
 *
 * 1. Вкладеність. У вихідних проєктах кожен оверлей безумовно писав і
 *    скидав `document.body.style.overflow`. У типовому потоці (confirm
 *    поверх drawer'а, modal усередині drawer'а) закриття внутрішнього
 *    оверлея розблоковувало скрол, поки зовнішній ще відкритий. Тут лок
 *    рахується: фон розблоковується лише коли закрився ОСТАННІЙ оверлей.
 *
 * 2. iOS Safari. `overflow: hidden` на body там не зупиняє прокрутку — фон
 *    продовжує «гумитися» під drawer'ом. Робочий спосіб — `position: fixed`
 *    зі збереженням і подальшим відновленням scrollY.
 *
 * Плюс компенсація ширини скролбара, щоб контент не стрибав на десктопі,
 * і `data-overlay-scroll-locked` на body як хук для CSS.
 */

const isClient = typeof document !== 'undefined'

let lockCount = 0
let releaseDom: (() => void) | null = null

function applyDomLock(): void {
  const body = document.body
  const html = document.documentElement

  const scrollY = window.scrollY
  // innerWidth - clientWidth = ширина класичного скролбара (на мобільних 0).
  const scrollbarWidth = window.innerWidth - html.clientWidth

  const previous = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    scrollBehavior: html.style.scrollBehavior,
  }

  // scroll-behavior: smooth анімував би повернення на місце після закриття.
  html.style.scrollBehavior = 'auto'
  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
  }
  body.dataset.overlayScrollLocked = 'true'

  releaseDom = () => {
    body.style.position = previous.position
    body.style.top = previous.top
    body.style.left = previous.left
    body.style.right = previous.right
    body.style.width = previous.width
    body.style.overflow = previous.overflow
    body.style.paddingRight = previous.paddingRight
    delete body.dataset.overlayScrollLocked
    window.scrollTo(0, scrollY)
    html.style.scrollBehavior = previous.scrollBehavior
  }
}

function acquire(): void {
  if (!isClient) return
  lockCount += 1
  if (lockCount === 1) applyDomLock()
}

function release(): void {
  if (!isClient || lockCount === 0) return
  lockCount -= 1
  if (lockCount === 0 && releaseDom) {
    releaseDom()
    releaseDom = null
  }
}

/**
 * Один виклик = один потенційний тримач лока. lock()/unlock() ідемпотентні
 * для конкретного споживача, тож подвійний lock() не «залипає» лічильником.
 */
export function useScrollLock() {
  let holding = false

  const lock = (): void => {
    if (holding) return
    holding = true
    acquire()
  }

  const unlock = (): void => {
    if (!holding) return
    holding = false
    release()
  }

  if (getCurrentScope()) onScopeDispose(unlock)

  return { lock, unlock }
}
