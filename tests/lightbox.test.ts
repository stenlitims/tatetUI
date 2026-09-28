// happy-dom інакше справді вантажить iframe (YouTube, мапу) і після тесту
// друкує стек мережевої помилки. disableIframePageLoading теж не годиться:
// друкує власну помилку на кожен iframe. Vitest сам загортає опції в happyDOM.
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import UiLightbox from '~/components/ui/UiLightbox.vue'
import {
  DOUBLE_TAP_MS,
  LIGHTBOX_LABELS_UK,
  closeProgress,
  closeThreshold,
  decay,
  embedSrc,
  fitScale,
  isDoubleTap,
  isTap,
  lightboxKind,
  nextSlideshowIndex,
  originTransform,
  panBounds,
  releaseVelocity,
  rubberband,
  rubberbandScale,
  shouldCloseOnDrag,
  slideKindOf,
  slideStep,
  stepZoom,
  toggleZoomTarget,
  vimeoVideo,
  visibleFraction,
  wheelZoomFactor,
  youtubeThumbnail,
  youtubeVideo,
  zoomAround,
  zoomLimits,
} from '~/utils/lightbox'
import { mountComponent } from './helpers/mountComponent'

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
  HTMLElement.prototype.scrollBy ??= () => undefined
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  delete document.body.dataset.overlayScrollLocked
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ */
/*  Чиста логіка                                                       */
/* ------------------------------------------------------------------ */

describe('utils/lightbox — навігація', () => {
  it('slideStep: сусід через край з loop — один крок уперед, а не проліт назад', () => {
    expect(slideStep(4, 0, 5, true)).toBe(1)
    expect(slideStep(0, 4, 5, true)).toBe(-1)
    // Без loop і для дальнього переходу — за знаком різниці.
    expect(slideStep(4, 0, 5)).toBe(-1)
    expect(slideStep(1, 3, 5, true)).toBe(1)
    expect(slideStep(3, 1, 5, true)).toBe(-1)
  })

  it('nextSlideshowIndex: без loop зупиняється на останньому кадрі', () => {
    expect(nextSlideshowIndex(0, 3)).toBe(1)
    expect(nextSlideshowIndex(2, 3)).toBeNull()
    expect(nextSlideshowIndex(2, 3, true)).toBe(0)
    expect(nextSlideshowIndex(0, 1, true)).toBeNull()
  })
})

describe('utils/lightbox — вид вмісту', () => {
  it('youtubeVideo розбирає всі форми посилань і стартову секунду', () => {
    expect(youtubeVideo('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toEqual({ id: 'aqz-KE-bpKQ', start: 0 })
    expect(youtubeVideo('https://youtu.be/aqz-KE-bpKQ?t=1m30s')).toEqual({ id: 'aqz-KE-bpKQ', start: 90 })
    expect(youtubeVideo('https://m.youtube.com/watch?v=aqz-KE-bpKQ&t=45')).toEqual({ id: 'aqz-KE-bpKQ', start: 45 })
    expect(youtubeVideo('https://www.youtube.com/shorts/aqz-KE-bpKQ')?.id).toBe('aqz-KE-bpKQ')
    expect(youtubeVideo('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?start=12')).toEqual({ id: 'aqz-KE-bpKQ', start: 12 })
    // Не YouTube чи битий ідентифікатор — не відео.
    expect(youtubeVideo('https://notyoutube.com/watch?v=aqz-KE-bpKQ')).toBeNull()
    expect(youtubeVideo('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(youtubeVideo('/demo/vase.svg')).toBeNull()
  })

  it('vimeoVideo: ідентифікатор, хеш приватного відео, мітка часу', () => {
    expect(vimeoVideo('https://vimeo.com/76979871')).toEqual({ id: '76979871', hash: undefined, time: undefined })
    expect(vimeoVideo('https://vimeo.com/76979871/8272103f6e')?.hash).toBe('8272103f6e')
    expect(vimeoVideo('https://player.vimeo.com/video/76979871?h=abc123def')?.hash).toBe('abc123def')
    expect(vimeoVideo('https://vimeo.com/channels/staffpicks/76979871#t=30s')).toMatchObject({ id: '76979871', time: 't=30s' })
    expect(vimeoVideo('https://vimeo.com/about')).toBeNull()
  })

  it('lightboxKind: явний type виграє, інакше — за адресою', () => {
    expect(lightboxKind({ src: '/a.jpg' })).toBe('image')
    expect(lightboxKind({ src: '/clip.mp4' })).toBe('video')
    expect(lightboxKind({ src: '/clip.webm?v=2' })).toBe('video')
    expect(lightboxKind({ src: 'https://youtu.be/aqz-KE-bpKQ' })).toBe('youtube')
    expect(lightboxKind({ src: 'https://vimeo.com/76979871' })).toBe('vimeo')
    expect(lightboxKind({ type: 'iframe', src: 'https://example.com/map' })).toBe('iframe')
    expect(lightboxKind({ type: 'custom', src: 'card' })).toBe('custom')
    expect(lightboxKind({ type: 'video', src: '/stream' })).toBe('video')
    // Зображення з «.mp4» у назві каталогу — все одно зображення, якщо так сказано.
    expect(lightboxKind({ type: 'image', src: '/clip.mp4/poster.jpg' })).toBe('image')
  })

  it('embedSrc: YouTube без cookies з autoplay, Vimeo з dnt і хешем', () => {
    expect(embedSrc('youtube', 'https://youtu.be/aqz-KE-bpKQ?t=30')).toBe(
      'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&rel=0&playsinline=1&start=30',
    )
    expect(embedSrc('vimeo', 'https://vimeo.com/76979871/8272103f6e')).toBe(
      'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1&h=8272103f6e',
    )
    expect(embedSrc('iframe', 'https://example.com/map')).toBe('https://example.com/map')
    expect(youtubeThumbnail('https://youtu.be/aqz-KE-bpKQ')).toBe('https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg')
    expect(youtubeThumbnail('/a.jpg')).toBeNull()
  })
})

describe('utils/lightbox — геометрія збільшення', () => {
  it('fitScale: без повороту — 1, на чверть оберту вписує заново і не збільшує понад натуральний', () => {
    const layout = { width: 933, height: 700 }
    const box = { width: 1000, height: 700 }
    const natural = { width: 1200, height: 900 }
    expect(fitScale({ layout, box, natural, rotation: 0 })).toBe(1)
    expect(fitScale({ layout, box, natural, rotation: 180 })).toBe(1)
    const turned = fitScale({ layout, box, natural, rotation: 90 })
    // Повернуте фото — 525 завширшки і рівно 700 заввишки: впирається в
    // висоту коробки.
    expect(layout.width * turned).toBeCloseTo(700, 0)
    expect(fitScale({ layout, box, natural, rotation: -90 })).toBeCloseTo(turned)
    // Дрібне фото, повернуте в просторій коробці, лишається натуральним.
    const small = { width: 300, height: 200 }
    expect(fitScale({ layout: small, box: { width: 1000, height: 800 }, natural: small, rotation: 90 })).toBe(1)
  })

  it('zoomLimits і toggleZoomTarget: до натурального розміру завжди можна дійти', () => {
    expect(zoomLimits({ base: 1, naturalRatio: 6, maxZoom: 4 })).toEqual({ min: 1, max: 6 })
    expect(zoomLimits({ base: 1, naturalRatio: 1, maxZoom: 4 })).toEqual({ min: 1, max: 4 })
    // Велике фото — клік веде до 1:1; дрібне — щонайменше вдвічі.
    expect(toggleZoomTarget({ base: 1, naturalRatio: 3.2, max: 4 })).toBe(3.2)
    expect(toggleZoomTarget({ base: 1, naturalRatio: 1.1, max: 4 })).toBe(2)
    expect(toggleZoomTarget({ base: 1, naturalRatio: 9, max: 6 })).toBe(6)
  })

  it('stepZoom: крок у 1.5 раза, майже вписане доклацується до вписаного', () => {
    const limits = { min: 1, max: 4 }
    expect(stepZoom(1, 1, limits)).toBe(1.5)
    expect(stepZoom(3, 1, limits)).toBe(4)
    expect(stepZoom(1.5, -1, limits)).toBe(1)
    expect(stepZoom(1.55, -1, limits)).toBe(1)
  })

  it('panBounds: поворот міняє сторони, менше за сцену — без зсуву', () => {
    const stage = { width: 1000, height: 600 }
    expect(panBounds({ layout: { width: 800, height: 600 }, stage, scale: 2, rotation: 0 })).toEqual({ x: 300, y: 300 })
    expect(panBounds({ layout: { width: 800, height: 600 }, stage, scale: 2, rotation: 90 })).toEqual({ x: 100, y: 500 })
    expect(panBounds({ layout: { width: 800, height: 600 }, stage, scale: 1, rotation: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('гумові краї гасять рух за межею, але не всередині', () => {
    expect(rubberband(50, 100)).toBe(50)
    expect(rubberband(200, 100)).toBeCloseTo(130)
    expect(rubberband(-200, 100)).toBeCloseTo(-130)
    expect(rubberbandScale(0.5, 1, 4)).toBeCloseTo(0.85)
    expect(rubberbandScale(6, 1, 4)).toBeCloseTo(4.6)
    expect(rubberbandScale(2, 1, 4)).toBe(2)
  })

  it('zoomAround повертає до центру, коли масштаб не змінився', () => {
    expect(zoomAround({ point: { x: 30, y: 40 }, offset: { x: 5, y: 6 }, scale: 2, nextScale: 2 })).toEqual({ x: 5, y: 6 })
  })

  it('wheelZoomFactor: щипок тачпада чутливіший за колесо миші, крок обмежений', () => {
    const mouse = wheelZoomFactor(-100)
    expect(mouse).toBeGreaterThan(1.2)
    expect(mouse).toBeLessThan(1.25)
    expect(wheelZoomFactor(100)).toBeCloseTo(1 / mouse)
    expect(wheelZoomFactor(-10, 0, true)).toBeGreaterThan(wheelZoomFactor(-10))
    // Рядки (Firefox) перераховуються в пікселі, стрибок обмежено вдвічі.
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(Math.exp(48 * 0.002))
    expect(wheelZoomFactor(-5000)).toBe(2)
    expect(wheelZoomFactor(5000)).toBe(0.5)
  })
})

describe('utils/lightbox — жести', () => {
  it('releaseVelocity бере лише останні ~100 мс руху', () => {
    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 2, y: 0, t: 200 },
      { x: 52, y: 10, t: 250 },
      { x: 102, y: 20, t: 300 },
    ]
    expect(releaseVelocity(samples)).toEqual({ x: 1, y: 0.2 })
    expect(releaseVelocity([{ x: 5, y: 5, t: 10 }])).toEqual({ x: 0, y: 0 })
  })

  it('decay гасить швидкість з часом', () => {
    expect(decay(1, 0)).toBe(1)
    expect(decay(1, 100)).toBeCloseTo(0.995 ** 100)
    expect(decay(-2, 16)).toBeLessThan(0)
  })

  it('isTap і isDoubleTap', () => {
    expect(isTap({ dx: 3, dy: 4, elapsedMs: 120 })).toBe(true)
    expect(isTap({ dx: 30, dy: 0, elapsedMs: 120 })).toBe(false)
    expect(isTap({ dx: 0, dy: 0, elapsedMs: 900 })).toBe(false)
    const first = { x: 100, y: 100, t: 1000 }
    expect(isDoubleTap(first, { x: 110, y: 104, t: 1000 + DOUBLE_TAP_MS - 10 })).toBe(true)
    expect(isDoubleTap(first, { x: 110, y: 104, t: 1000 + DOUBLE_TAP_MS + 10 })).toBe(false)
    expect(isDoubleTap(first, { x: 200, y: 100, t: 1100 })).toBe(false)
    expect(isDoubleTap(null, first)).toBe(false)
  })

  it('закриття змахом: поріг від висоти, але не менше 80px; флік закриває коротшим рухом', () => {
    expect(closeThreshold(300)).toBe(80)
    expect(closeThreshold(1000)).toBe(150)
    expect(closeThreshold(0)).toBe(80)
    expect(shouldCloseOnDrag({ dy: 160, elapsedMs: 600, height: 1000 })).toBe(true)
    expect(shouldCloseOnDrag({ dy: -60, elapsedMs: 600, height: 1000 })).toBe(false)
    expect(shouldCloseOnDrag({ dy: -60, elapsedMs: 150, height: 1000 })).toBe(true)
    expect(shouldCloseOnDrag({ dy: 60, elapsedMs: 600, height: 1000, velocity: 0.9 })).toBe(true)
    expect(shouldCloseOnDrag({ dy: 12, elapsedMs: 50, height: 1000 })).toBe(false)
    expect(closeProgress(0, 800)).toBe(0)
    expect(closeProgress(-10_000, 800)).toBe(1)
  })
})

describe('utils/lightbox — політ із мініатюри', () => {
  it('originTransform: квадратна мініатюра з object-cover обрізає фото 4:3', () => {
    const image = { left: 100, top: 50, width: 800, height: 600 }
    const thumbnail = { left: 20, top: 700, width: 120, height: 120 }
    const cover = originTransform({ image, thumbnail, fit: 'cover', radius: 8 })
    // Масштаб — за меншою стороною фото: висота 600 → 120.
    expect(cover.scale).toBeCloseTo(0.2)
    expect(cover.x).toBe(80 - 500)
    expect(cover.y).toBe(760 - 350)
    // Зайві 200px ширини (по 100 з боків) ховає clip-path у координатах фото.
    expect(cover.clipX).toBeCloseTo(100)
    expect(cover.clipY).toBe(0)
    expect(cover.radius).toBeCloseTo(40)

    const contain = originTransform({ image, thumbnail, fit: 'contain' })
    expect(contain.scale).toBeCloseTo(0.15)
    expect(contain.clipX).toBe(0)
    expect(contain.clipY).toBe(0)
  })

  it('visibleFraction: мініатюра, прокручена за край каруселі, невидима', () => {
    const viewport = { left: 0, top: 0, width: 1000, height: 800 }
    const carousel = { left: 100, top: 100, width: 400, height: 300 }
    expect(visibleFraction({ left: 150, top: 150, width: 100, height: 100 }, [viewport, carousel])).toBe(1)
    expect(visibleFraction({ left: 450, top: 150, width: 100, height: 100 }, [viewport, carousel])).toBe(0.5)
    expect(visibleFraction({ left: 600, top: 150, width: 100, height: 100 }, [viewport, carousel])).toBe(0)
    expect(visibleFraction({ left: 0, top: 0, width: 0, height: 0 }, [viewport])).toBe(0)
  })
})

describe('utils/lightbox — підписи', () => {
  it('оголошення розрізняє фото, відео й решту', () => {
    expect(LIGHTBOX_LABELS_UK.slide(2, 5, 'Хол', 'image')).toBe('Зображення 2 з 5: Хол')
    expect(LIGHTBOX_LABELS_UK.slide(1, 3, 'Огляд', 'video')).toBe('Відео 1 з 3: Огляд')
    expect(LIGHTBOX_LABELS_UK.thumbnail(4, 'Мапа', 'other')).toBe('Слайд 4: Мапа')
    expect(slideKindOf('youtube')).toBe('video')
    expect(slideKindOf('iframe')).toBe('other')
  })
})

/* ------------------------------------------------------------------ */
/*  Компонент                                                          */
/* ------------------------------------------------------------------ */

const images = [
  { src: '/a.jpg', alt: 'Фасад' },
  { src: '/b.jpg', alt: 'Хол', caption: 'Хол на першому поверсі' },
  { src: '/c.jpg', alt: 'Тераса' },
]

const keydown = (target: EventTarget, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')!
const overlayRoot = () => document.body.querySelector<HTMLElement>('[data-ui-overlay]')!
const currentSlide = () => document.body.querySelector<HTMLElement>('[data-lightbox-slide]:not([inert])')!
const currentImage = () => currentSlide().querySelector<HTMLImageElement>('img:not([aria-hidden])')!
const button = (label: string) => document.body.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
const stage = () => currentSlide().parentElement!.parentElement!

/** happy-dom не вантажить зображень — подію load віддаємо самі. */
async function markCurrentLoaded() {
  currentImage().dispatchEvent(new Event('load'))
  await nextTick()
}

function pointer(target: EventTarget, type: string, init: PointerEventInit) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, ...init }))
}

/**
 * happy-dom не рахує верстку: offsetWidth і clientWidth — нулі, і збільшенню
 * нема від чого рахувати межі. Для тестів геометрії даємо зображенню й
 * сцені справжні розміри.
 */
function fakeLayout() {
  const restore: Array<() => void> = []
  const define = (proto: object, key: string, value: number) => {
    const original = Object.getOwnPropertyDescriptor(proto, key)
    Object.defineProperty(proto, key, { configurable: true, get: () => value })
    restore.push(() => (original ? Object.defineProperty(proto, key, original) : delete (proto as Record<string, unknown>)[key]))
  }
  define(HTMLImageElement.prototype, 'offsetWidth', 800)
  define(HTMLImageElement.prototype, 'offsetHeight', 600)
  define(HTMLImageElement.prototype, 'naturalWidth', 2400)
  define(HTMLImageElement.prototype, 'naturalHeight', 1800)
  define(HTMLElement.prototype, 'clientWidth', 1000)
  define(HTMLElement.prototype, 'clientHeight', 700)
  return () => restore.reverse().forEach((undo) => undo())
}

describe('UiLightbox — панель інструментів', () => {
  it('типова панель: збільшення, слайдшоу, мініатюри; повний екран лише там, де він є', async () => {
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    expect(button('Збільшити')).not.toBeNull()
    expect(button('Запустити слайдшоу')).not.toBeNull()
    expect(button('Сховати мініатюри')).not.toBeNull()
    // happy-dom не має Fullscreen API — кнопки, що нічого не зробить, немає.
    expect(button('На весь екран')).toBeNull()
    expect(button('Повернути праворуч')).toBeNull()
    mounted.unmount()
  })

  it('поворот і віддзеркалення працюють, лише коли фото завантажене', async () => {
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images, toolbar: ['rotate', 'flip'] })
    await nextTick()
    const rotate = button('Повернути праворуч')!
    expect(rotate.disabled).toBe(true)

    await markCurrentLoaded()
    expect(rotate.disabled).toBe(false)
    rotate.click()
    await nextTick()
    expect(currentImage().style.transform).toContain('rotate(90deg)')
    button('Повернути ліворуч')!.click()
    button('Повернути ліворуч')!.click()
    expect(currentImage().style.transform).toContain('rotate(-90deg)')
    button('Віддзеркалити по горизонталі')!.click()
    expect(currentImage().style.transform).toContain('scale(-1, 1)')

    // Новий слайд починається без повороту й дзеркала.
    keydown(document, 'ArrowRight')
    await nextTick()
    await markCurrentLoaded()
    expect(currentImage().style.transform).toContain('scale(1, 1) rotate(0deg)')
    mounted.unmount()
  })

  it('мініатюри ховаються й повертаються кнопкою', async () => {
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    expect(document.body.querySelector('[aria-label="Мініатюри"]')).not.toBeNull()
    button('Сховати мініатюри')!.click()
    await nextTick()
    expect(document.body.querySelector('[aria-label="Мініатюри"]')).toBeNull()
    button('Показати мініатюри')!.click()
    await nextTick()
    expect(document.body.querySelector('[aria-label="Мініатюри"]')).not.toBeNull()
    mounted.unmount()
  })

  it('завантаження — посилання на оригінал; для YouTube кнопка неактивна', async () => {
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images: [
        { src: '/a.jpg', alt: 'Фасад', download: '/a-original.tiff' },
        { src: 'https://youtu.be/aqz-KE-bpKQ', alt: 'Огляд' },
      ],
      toolbar: ['download'],
    })
    await nextTick()
    const link = document.body.querySelector<HTMLAnchorElement>('a[aria-label="Завантажити"]')!
    expect(link.getAttribute('href')).toBe('/a-original.tiff')
    expect(link.hasAttribute('download')).toBe(true)
    keydown(document, 'ArrowRight')
    await nextTick()
    expect(document.body.querySelector('a[aria-label="Завантажити"]')).toBeNull()
    expect(button('Завантажити')!.disabled).toBe(true)
    mounted.unmount()
  })

  it('підписи перекриваються частково, решта лишається українською', async () => {
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      labels: { close: 'Close', slide: (position: number, total: number, title: string) => `Photo ${position} of ${total}: ${title}` },
    })
    await nextTick()
    expect(button('Close')).not.toBeNull()
    expect(button('Збільшити')).not.toBeNull()
    expect(dialog().querySelector('[aria-live]')!.textContent).toBe('Photo 1 of 3: Фасад')
    mounted.unmount()
  })
})

describe('UiLightbox — слайдшоу', () => {
  it('гортає після паузи, чекає завантаження фото й зупиняється на останньому кадрі', async () => {
    vi.useFakeTimers()
    const indexes: number[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      interval: 2000,
      'onUpdate:index': (value: number) => indexes.push(value),
    })
    await nextTick()
    button('Запустити слайдшоу')!.click()
    await nextTick()
    // Живий регіон мовчить: кадри змінюються самі.
    expect(dialog().querySelector('[aria-live]')!.getAttribute('aria-live')).toBe('off')

    // Фото ще не завантажене — слайдшоу чекає.
    vi.advanceTimersByTime(5000)
    expect(indexes).toEqual([])

    await markCurrentLoaded()
    expect(document.body.querySelector('.ui-lightbox-progress')).not.toBeNull()
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(indexes).toEqual([1])

    await markCurrentLoaded()
    vi.advanceTimersByTime(2000)
    await nextTick()
    await markCurrentLoaded()
    vi.advanceTimersByTime(2000)
    await nextTick()
    expect(indexes).toEqual([1, 2])
    expect(button('Запустити слайдшоу')).not.toBeNull()
    expect(dialog().querySelector('[aria-live]')!.getAttribute('aria-live')).toBe('polite')
    mounted.unmount()
  })

  it('autoplay не стартує при prefers-reduced-motion, але кнопка паузи на місці', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images, autoplay: true, toolbar: [] })
    await nextTick()
    expect(button('Запустити слайдшоу')).not.toBeNull()
    expect(button('Зупинити слайдшоу')).toBeNull()
    mounted.unmount()
  })

  it('autoplay без reduced motion стартує одразу', async () => {
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images, autoplay: true, toolbar: [] })
    await nextTick()
    expect(button('Зупинити слайдшоу')).not.toBeNull()
    mounted.unmount()
  })
})

describe('UiLightbox — відео, iframe, власний вміст', () => {
  const media = [
    { src: '/clip.mp4', poster: '/clip.jpg', alt: 'Гончарне коло' },
    { src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', alt: 'Огляд' },
    { type: 'iframe' as const, src: 'https://example.com/map', alt: 'Мапа' },
    { type: 'custom' as const, src: 'card', alt: 'Картка' },
  ]

  it('плеєри монтуються лише для поточного слайда, сусіди — обкладинки', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images: media })
    await nextTick()
    const video = currentSlide().querySelector('video')!
    expect(video.getAttribute('src')).toBe('/clip.mp4')
    expect(video.getAttribute('aria-label')).toBe('Гончарне коло')
    expect(play).toHaveBeenCalledTimes(1)
    // Сусід із YouTube ще не вбудований: лише прев'ю.
    expect(document.body.querySelectorAll('iframe')).toHaveLength(0)

    keydown(document, 'ArrowRight')
    await nextTick()
    expect(document.body.querySelectorAll('video')).toHaveLength(0)
    const frame = currentSlide().querySelector('iframe')!
    expect(frame.getAttribute('src')).toContain('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ')
    expect(frame.getAttribute('title')).toBe('Огляд')
    expect(dialog().querySelector('[aria-live]')!.textContent).toBe('Відео 2 з 4: Огляд')

    keydown(document, 'ArrowRight')
    await nextTick()
    expect(currentSlide().querySelector('iframe')!.getAttribute('src')).toBe('https://example.com/map')
    mounted.unmount()
  })

  it('слот custom отримує active, а сусідні слайди — inert і aria-hidden', async () => {
    const mounted = await mountComponent(
      UiLightbox,
      { modelValue: true, images: media, index: 3 },
      {
        custom: ({ active }: { active: boolean }) => h('button', { type: 'button', class: 'probe' }, active ? 'активний' : 'сусід'),
      },
    )
    await nextTick()
    expect(currentSlide().querySelector('.probe')!.textContent).toBe('активний')
    const neighbours = document.body.querySelectorAll('[data-lightbox-slide][inert]')
    expect(neighbours.length).toBe(1)
    expect(neighbours[0]!.getAttribute('aria-hidden')).toBe('true')
    // Кнопка у власному слайді — не старт жесту.
    const probe = currentSlide().querySelector<HTMLButtonElement>('.probe')!
    pointer(probe, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    pointer(probe, 'pointermove', { pointerType: 'mouse', clientX: 100, clientY: 400 })
    pointer(probe, 'pointerup', { pointerType: 'mouse', clientX: 100, clientY: 400 })
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    mounted.unmount()
  })
})

describe('UiLightbox — жести', () => {
  it('свайп мишею гортає, змах униз закриває', async () => {
    const opened: boolean[] = []
    const indexes: number[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      'onUpdate:index': (value: number) => indexes.push(value),
      'onUpdate:modelValue': (value: boolean) => opened.push(value),
    })
    await nextTick()
    const target = currentImage()
    pointer(target, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    pointer(target, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 250, clientY: 202 })
    pointer(target, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 150, clientY: 204 })
    pointer(target, 'pointerup', { pointerType: 'mouse', clientX: 150, clientY: 204 })
    expect(indexes).toEqual([1])

    await nextTick()
    const next = currentImage()
    pointer(next, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    pointer(next, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 302, clientY: 260 })
    // Фон гасне разом із рухом.
    expect(Number(overlayRoot().style.getPropertyValue('--ui-lightbox-fade'))).toBeLessThan(1)
    pointer(next, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 304, clientY: 420 })
    pointer(next, 'pointerup', { pointerType: 'mouse', clientX: 304, clientY: 420 })
    expect(opened).toEqual([false])
    mounted.unmount()
  })

  it('без dragToClose вертикальний змах нічого не робить', async () => {
    const opened: boolean[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      dragToClose: false,
      'onUpdate:modelValue': (value: boolean) => opened.push(value),
    })
    await nextTick()
    const target = currentImage()
    pointer(target, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    pointer(target, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 300, clientY: 500 })
    pointer(target, 'pointerup', { pointerType: 'mouse', clientX: 300, clientY: 500 })
    expect(opened).toEqual([])
    mounted.unmount()
  })

  it('дотик ховає панелі не одразу: чекає, чи не буде подвійного', async () => {
    vi.useFakeTimers()
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    const target = currentImage()
    pointer(target, 'pointerdown', { pointerType: 'touch', clientX: 300, clientY: 200 })
    pointer(target, 'pointerup', { pointerType: 'touch', clientX: 301, clientY: 200 })
    await nextTick()
    expect(overlayRoot().style.getPropertyValue('--ui-lightbox-chrome')).toBe('1')
    vi.advanceTimersByTime(DOUBLE_TAP_MS + 10)
    await nextTick()
    expect(overlayRoot().style.getPropertyValue('--ui-lightbox-chrome')).toBe('0')
    // Tab до схованої кнопки повертає панелі.
    button('Закрити')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await nextTick()
    expect(overlayRoot().style.getPropertyValue('--ui-lightbox-chrome')).toBe('1')
    mounted.unmount()
  })

  it('миша, відпущена поза сценою, не лишає жест «натиснутим»', async () => {
    const indexes: number[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      dragToClose: false,
      'onUpdate:index': (value: number) => indexes.push(value),
    })
    await nextTick()
    // Вертикальний рух без dragToClose — жест «нічий», вказівник не
    // захоплено, і кнопку відпускають над панеллю мініатюр.
    const target = currentImage()
    pointer(target, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    pointer(target, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 300, clientY: 320 })
    pointer(document.body.querySelector('[aria-label="Мініатюри"]')!, 'pointerup', { pointerType: 'mouse', clientX: 300, clientY: 700 })
    // Рух без кнопки не тягне слайд…
    pointer(stage(), 'pointermove', { pointerType: 'mouse', clientX: 100, clientY: 320 })
    expect(stage().firstElementChild!.getAttribute('style')).toContain('calc(0% + 0px)')
    // …а наступний справжній свайп працює.
    pointer(target, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
    pointer(target, 'pointermove', { pointerType: 'mouse', buttons: 1, clientX: 150, clientY: 204 })
    pointer(target, 'pointerup', { pointerType: 'mouse', clientX: 150, clientY: 204 })
    expect(indexes).toEqual([1])
    mounted.unmount()
  })

  it('на дотику з idle дотик повертає панелі, сховані без руху', async () => {
    vi.useFakeTimers()
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images, idle: 1000 })
    await nextTick()
    vi.advanceTimersByTime(1100)
    await nextTick()
    expect(overlayRoot().style.getPropertyValue('--ui-lightbox-chrome')).toBe('0')
    const target = currentImage()
    pointer(target, 'pointerdown', { pointerType: 'touch', clientX: 300, clientY: 200 })
    pointer(target, 'pointerup', { pointerType: 'touch', clientX: 300, clientY: 200 })
    vi.advanceTimersByTime(DOUBLE_TAP_MS + 10)
    await nextTick()
    expect(overlayRoot().style.getPropertyValue('--ui-lightbox-chrome')).toBe('1')
    mounted.unmount()
  })

  it('клік у порожнє поле закриває лише з closeOnBackdrop', async () => {
    const opened: boolean[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      closeOnBackdrop: false,
      'onUpdate:modelValue': (value: boolean) => opened.push(value),
    })
    await nextTick()
    currentSlide().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opened).toEqual([])
    await mounted.update({ closeOnBackdrop: true })
    currentSlide().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opened).toEqual([false])
    mounted.unmount()
  })

  it('wheel="navigate" гортає колесом, один змах — один слайд', async () => {
    const indexes: number[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      wheel: 'navigate',
      'onUpdate:index': (value: number) => indexes.push(value),
    })
    await nextTick()
    const wheel = (deltaY: number, timeStamp: number) => {
      const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
      Object.defineProperty(event, 'timeStamp', { value: timeStamp })
      stage().dispatchEvent(event)
      return event
    }
    const first = wheel(60, 1000)
    expect(first.defaultPrevented).toBe(true)
    expect(indexes).toEqual([1])
    // Хвіст інерції тачпада не гортає далі…
    wheel(60, 1100)
    wheel(60, 1250)
    expect(indexes).toEqual([1])
    // …а новий змах після паузи — гортає.
    wheel(60, 1800)
    expect(indexes).toEqual([1, 2])
    mounted.unmount()
  })
})

describe('UiLightbox — збільшення', () => {
  it('клавіші: + збільшує кроком, Escape спершу зменшує, потім закриває', async () => {
    const restore = fakeLayout()
    const opened: boolean[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      'onUpdate:modelValue': (value: boolean) => opened.push(value),
    })
    await nextTick()
    await markCurrentLoaded()
    keydown(document, '+')
    expect(currentImage().style.transform).toContain('scale(1.5, 1.5)')
    await nextTick()
    expect(button('Зменшити')).not.toBeNull()
    // Стрілки на збільшеному фото рухають його, а не гортають.
    keydown(document, 'ArrowLeft')
    expect(currentImage().style.transform).toContain('translate3d(80px, 0px, 0)')
    keydown(document, 'Escape')
    expect(currentImage().style.transform).toContain('scale(1, 1)')
    expect(opened).toEqual([])
    await nextTick()
    keydown(document, 'Escape')
    expect(opened).toEqual([false])
    mounted.unmount()
    restore()
  })

  it('клік по фото збільшує до натурального розміру в точці кліку', async () => {
    const restore = fakeLayout()
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    await markCurrentLoaded()
    const target = currentImage()
    pointer(target, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 })
    pointer(target, 'pointerup', { pointerType: 'mouse', clientX: 0, clientY: 0 })
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }))
    // naturalWidth / offsetWidth = 3 — клік веде до 1:1. Сцена в happy-dom
    // стоїть у (0, 0), тож точка кліку — центр, і зсуву немає.
    expect(target.style.transform).toBe('translate3d(0px, 0px, 0) scale(3, 3) rotate(0deg)')
    mounted.unmount()
    restore()
  })

  it('подвійний клік збільшує, а не збільшує й одразу зменшує', async () => {
    const restore = fakeLayout()
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    await markCurrentLoaded()
    const target = currentImage()
    for (const detail of [1, 2]) {
      pointer(target, 'pointerdown', { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 })
      pointer(target, 'pointerup', { pointerType: 'mouse', clientX: 0, clientY: 0 })
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
    }
    expect(target.style.transform).toContain('scale(3, 3)')
    mounted.unmount()
    restore()
  })

  it('колесо збільшує, а зменшення колесом не заходить нижче «вписано»', async () => {
    const restore = fakeLayout()
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    await markCurrentLoaded()
    stage().dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))
    expect(currentImage().style.transform).toMatch(/scale\(1\.22/)
    for (let step = 0; step < 5; step += 1) {
      stage().dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
    }
    expect(currentImage().style.transform).toContain('scale(1, 1)')
    mounted.unmount()
    restore()
  })
})

describe('UiLightbox — фокус', () => {
  it('з origin фокус після закриття — на мініатюрі слайда, який переглядали', async () => {
    const buttons: HTMLButtonElement[] = []
    const host = document.createElement('div')
    document.body.append(host)
    for (const [at, image] of images.entries()) {
      const thumb = document.createElement('button')
      thumb.type = 'button'
      thumb.innerHTML = `<img src="${image.src}" alt="">`
      thumb.dataset.at = String(at)
      host.append(thumb)
      buttons.push(thumb)
    }
    buttons[0]!.focus()
    const opened: boolean[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      origin: (index: number) => buttons[index]!.querySelector('img'),
      'onUpdate:modelValue': (value: boolean) => opened.push(value),
    })
    await nextTick()
    keydown(document, 'ArrowRight')
    keydown(document, 'ArrowRight')
    await nextTick()
    await mounted.update({ modelValue: false })
    expect(document.activeElement).toBe(buttons[2])
    mounted.unmount()
    host.remove()
  })

  it('без origin фокус повертається туди, звідки відкрили', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images })
    await nextTick()
    expect(document.activeElement).toBe(dialog())
    keydown(document, 'ArrowRight')
    await mounted.update({ modelValue: false })
    expect(document.activeElement).toBe(opener)
    mounted.unmount()
    opener.remove()
  })
})

describe('UiLightbox — гідрація', () => {
  it('однаковий server/initial-client render з відео, iframe і власним слайдом', async () => {
    const media = [
      { src: '/clip.mp4', poster: '/clip.jpg', alt: 'Коло' },
      { src: 'https://youtu.be/aqz-KE-bpKQ', alt: 'Огляд' },
      { type: 'custom' as const, src: 'card', alt: 'Картка' },
    ]
    const root = {
      render: () =>
        h(
          UiLightbox,
          { modelValue: true, images: media, toolbar: ['zoomIn', 'rotate', 'flip', 'download', 'slideshow', 'fullscreen', 'thumbnails'] },
          { custom: () => h('p', 'Картка') },
        ),
    }
    const html = await renderToString(createSSRApp(root))
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    const client = createSSRApp(root)
    client.mount(host)
    await nextTick()
    await nextTick()
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    client.unmount()
    host.remove()
  })
})
