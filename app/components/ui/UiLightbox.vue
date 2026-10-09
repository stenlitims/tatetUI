<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, reactive, ref, shallowRef, useId, watch } from 'vue'
import UiSpinner from './UiSpinner.vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useFullscreen } from '~/composables/useFullscreen'
import { useOverlayLayer } from '~/composables/useOverlayStack'
import { readDurationToken, useReducedMotion } from '~/composables/useReducedMotion'
import { useScrollLock } from '~/composables/useScrollLock'
import { dragAxis, rubberBandDelta, shouldAdvance, swipeDirection } from '~/utils/carousel'
import {
  DOUBLE_TAP_MS,
  LIGHTBOX_LABELS_UK,
  TAP_SLOP_PX,
  clamp,
  closeProgress,
  decay,
  embedSrc,
  fitScale,
  isDoubleTap,
  isTap,
  lightboxIndex,
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
  visibleFraction,
  wheelZoomFactor,
  youtubeThumbnail,
  zoomAround,
  zoomLimits,
  type LightboxKind,
  type LightboxLabels,
  type Point,
  type PointerSample,
  type Rect,
  type Size,
} from '~/utils/lightbox'

export interface LightboxItem {
  /**
   * Вид вмісту. Типово — за `src`: посилання YouTube чи Vimeo і файли
   * .mp4/.webm/.ogv/.mov — відео, решта — зображення. `iframe` — будь-яка
   * сторінка (мапа, PDF), `custom` — власний вміст через слот `custom`.
   */
  type?: 'image' | 'video' | 'iframe' | 'custom'
  /** Адреса зображення, відеофайлу, відео на YouTube/Vimeo чи сторінки. Для `custom` — будь-який унікальний ключ. */
  src: string
  /** Текстова альтернатива зображення або назва відео чи сторінки. Для скрінрідера це і є слайд. */
  alt: string
  /** Підпис під слайдом. */
  caption?: string
  /** Мініатюра для стрічки й заглушка, поки вантажиться повне зображення. Типово — `src`. */
  thumbnail?: string
  /** Набір розмірів зображення. Під час збільшення галерея просить у браузера більший. */
  srcset?: string
  /** `sizes` для `srcset`. Типово — `100vw`. */
  sizes?: string
  /** Натуральна ширина, px: розмір заглушки до завантаження, пропорції iframe. */
  width?: number
  /** Натуральна висота, px. */
  height?: number
  /** Кадр-обкладинка відео. */
  poster?: string
  /** Адреса для кнопки «Завантажити», коли вона інша, ніж `src`. `false` — не пропонувати. */
  download?: string | false
}

/** Попередня назва типу. Лишається, щоб наявні імпорти не зламались. */
export type LightboxImage = LightboxItem

const props = withDefaults(
  defineProps<{
    /** Відкрито. Використовуйте через `v-model`. */
    modelValue?: boolean
    /**
     * Поточний слайд. Через `v-model:index`, але працює й без
     * прив'язки: гортання тоді живе всередині компонента.
     */
    index?: number
    /**
     * Слайди галереї: зображення, відео (файл, YouTube, Vimeo), сторінки в
     * iframe або власний вміст (`type: 'custom'` + слот `custom`).
     */
    images: LightboxItem[]
    /** З останнього слайда переходити на перший. */
    loop?: boolean
    /** Показувати стрічку мініатюр при відкритті. Сама ховається, коли слайд один. */
    thumbnails?: boolean
    /**
     * Список слайдів ще дотягується — наприклад, чат відкрив одне фото і
     * підвантажує сусідні. Поки так, стрічка мініатюр і кнопки слайдшоу та
     * мініатюр займають місце навіть для одного слайда: інакше, коли решта
     * з'явиться, стрічка відніме висоту в сцени, і фото стрибне. Вимкніть
     * прапорець, щойно список дотягнувся (або не дотягнувся): одиночний
     * слайд знову ховає стрічку.
     */
    loadingMore?: boolean
    /**
     * Збільшення зображень: клік, подвійний дотик, щипок, колесо, `+`/`−`.
     * Збільшене фото рухається перетягуванням — з інерцією, як на телефоні.
     */
    zoomable?: boolean
    /**
     * Найбільше збільшення відносно вписаного у вікно розміру. До
     * натурального розміру великого фото можна дійти завжди.
     */
    maxZoom?: number
    /**
     * Кнопки верхньої панелі — у цьому порядку. Лічильник і хрестик є
     * завжди; кнопки, яким нема чого робити, не показуються: повний екран на
     * iPhone, слайдшоу й мініатюри для одного слайда.
     */
    toolbar?: Array<'zoom' | 'zoomIn' | 'zoomOut' | 'rotate' | 'flip' | 'slideshow' | 'fullscreen' | 'thumbnails' | 'download'>
    /** Перехід між слайдами. `prefers-reduced-motion` вимикає будь-який. */
    transition?: 'slide' | 'fade' | 'none'
    /**
     * Що робить колесо миші. Щипок на тачпаді (Ctrl + колесо) збільшує
     * завжди — це жест масштабу, а не прокрутки.
     */
    wheel?: 'zoom' | 'navigate' | 'none'
    /** Змах угору чи вниз закриває галерею — як у галереї телефона. */
    dragToClose?: boolean
    /** Клік мишею в порожнє поле навколо слайда закриває галерею. */
    closeOnBackdrop?: boolean
    /**
     * Запустити слайдшоу одразу при відкритті. Кнопка паузи тоді є завжди,
     * а при `prefers-reduced-motion` слайдшоу саме не стартує.
     */
    autoplay?: boolean
    /** Пауза між кадрами слайдшоу, мс. */
    interval?: number
    /**
     * Через скільки мілісекунд без руху миші ховати панелі й стрілки.
     * `false` — не ховати. На дотику панелі ховає й повертає дотик до фото.
     */
    idle?: number | false
    /**
     * Мініатюра на сторінці, з якої слайд «виростає» при відкритті й куди
     * повертається при закритті. Функція від індексу: `(i) => thumbs[i]`.
     */
    origin?: (index: number) => Element | null | undefined
    /**
     * Перекриття підписів. Задавайте лише ключі, що змінюються; у проєкті з
     * i18n — об'єкт із `t()`, і зміна мови оновить підписи на льоту.
     */
    labels?: Partial<LightboxLabels>
    /** Доступна назва діалогу. */
    ariaLabel?: string
  }>(),
  {
    modelValue: false,
    index: 0,
    loop: false,
    thumbnails: true,
    loadingMore: false,
    zoomable: true,
    maxZoom: 4,
    toolbar: () => ['zoom', 'slideshow', 'fullscreen', 'thumbnails'],
    transition: 'slide',
    wheel: 'zoom',
    dragToClose: true,
    closeOnBackdrop: true,
    autoplay: false,
    interval: 3000,
    idle: false,
    origin: undefined,
    labels: undefined,
    ariaLabel: 'Перегляд зображень',
  },
)

type Tool = NonNullable<typeof props.toolbar>[number]

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:index': [value: number]
  close: []
}>()

defineSlots<{
  /** Додаткові дії у верхній панелі: «Поділитися», «До товару». */
  actions?: (props: { image: LightboxItem; index: number }) => unknown
  /** Власний підпис замість `caption` слайда. */
  caption?: (props: { image: LightboxItem; index: number }) => unknown
  /** Вміст слайдів із `type: 'custom'`. `active` — чи слайд зараз поточний. */
  custom?: (props: { image: LightboxItem; index: number; active: boolean }) => unknown
}>()

const text = computed<LightboxLabels>(() => ({ ...LIGHTBOX_LABELS_UK, ...(props.labels ?? {}) }))
const count = computed(() => props.images.length)
const kinds = computed(() => props.images.map((item) => lightboxKind(item)))
const kindAt = (index: number): LightboxKind => kinds.value[index] ?? 'image'

/* ------------------------------------------------------------------ */
/*  Індекс, трек і слайди                                              */
/* ------------------------------------------------------------------ */

/*
 * Індекс — локальний стан, синхронізований із props, а не чисте
 * відображення props.index. Інакше галерея без `v-model:index` не гортала
 * б узагалі: подія йшла б у нікуди, а props лишався б нулем.
 */
const current = ref(lightboxIndex(props.index, count.value))
/*
 * Віртуальна позиція треку. Слайди стоять на `позиція × 100%`, а трек
 * зсунутий на мінус позицію, тож перехід — це зміна одного числа, яку
 * анімує CSS. Позиція росте без меж і з `loop`: з останнього на перший
 * трек їде вперед, а не пролітає назад через усю галерею.
 */
const position = ref(0)
/*
 * Слайд, що саме виїжджає, тримає свій вміст до кінця анімації. Без цього
 * на дальньому переході (клік по мініатюрі) сусід, що виїжджає, миттєво
 * підміняв би фото на інше.
 */
const outgoing = shallowRef<{ vpos: number; index: number } | null>(null)
let outgoingTimer: ReturnType<typeof setTimeout> | undefined

const image = computed<LightboxItem | undefined>(() => props.images[current.value])
const currentKind = computed(() => kindAt(current.value))
const atStart = computed(() => !props.loop && current.value === 0)
const atEnd = computed(() => !props.loop && current.value === count.value - 1)

interface Panel {
  vpos: number
  index: number
  /** −1 — попередній, 0 — поточний, 1 — наступний. */
  offset: number
  item: LightboxItem
  kind: LightboxKind
}

/*
 * У DOM — лише три слайди: поточний і два сусіди. Сусіди видно під час
 * свайпу, і їхні зображення вантажаться наперед — гортання галереї
 * послідовне, наступне фото має бути готовим до того, як його попросили.
 * Ключ — віртуальна позиція: після переходу сусід стає поточним тим самим
 * вузлом, без перезавантаження фото.
 */
const panels = computed<Panel[]>(() => {
  const total = count.value
  const list: Panel[] = []
  for (const offset of [-1, 0, 1]) {
    if (!total || (offset !== 0 && total < 2)) continue
    const vpos = position.value + offset
    const kept = outgoing.value?.vpos === vpos ? outgoing.value.index : null
    const raw = current.value + offset
    const index = kept ?? (props.loop ? lightboxIndex(raw, total, true) : raw)
    const item = props.images[index]
    if (!item) continue
    list.push({ vpos, index, offset, item, kind: kindAt(index) })
  }
  return list
})

const reducedMotion = useReducedMotion()
const trackEl = ref<HTMLElement | null>(null)
let trackDrag = 0

function slideMs(): number {
  if (reducedMotion.value || props.transition === 'none') return 0
  return readDurationToken('--duration-slow', 260)
}

/*
 * Трек рухається імперативно, а не через :style. Під пальцем зсув
 * змінюється щокадру, і реактивний стиль перемальовував би весь компонент
 * разом зі стрічкою мініатюр на кожен pointermove.
 */
function applyTrack(animate: boolean) {
  const track = trackEl.value
  if (!track) return
  const shift = props.transition === 'fade' ? 0 : -position.value * 100
  track.style.transition =
    animate && slideMs() > 0 ? 'transform var(--duration-slow) var(--ease-emphasized)' : 'none'
  track.style.transform = `translate3d(calc(${shift}% + ${trackDrag}px), 0, 0)`
}

function moveTo(target: number, step: 1 | -1) {
  if (target === current.value || !count.value) return
  rescueFocus()
  stopInertia()
  const from = { vpos: position.value, index: current.value }
  current.value = target
  position.value += step
  outgoing.value = from
  trackDrag = 0
  resetView()
  emit('update:index', target)
  applyTrack(true)
  clearTimeout(outgoingTimer)
  outgoingTimer = setTimeout(settleOutgoing, slideMs() + 60)
}

/** Слайд виїхав — прибираємо з нього збільшення й зсув закриття: він сусід. */
function settleOutgoing() {
  outgoing.value = null
  for (const [vpos, element] of imgEls) {
    if (vpos === position.value) continue
    element.style.transition = ''
    element.style.transform = ''
  }
  for (const [vpos, element] of boxEls) {
    if (vpos === position.value) continue
    element.style.transition = ''
    element.style.transform = ''
  }
}

function goTo(target: number) {
  if (!count.value) return
  const next = lightboxIndex(target, count.value, props.loop)
  if (next === current.value) return
  if (!props.modelValue || !trackEl.value) {
    current.value = next
    emit('update:index', next)
    return
  }
  moveTo(next, slideStep(current.value, next, count.value, props.loop))
}

function previous() {
  if (count.value > 1 && !atStart.value) moveTo(lightboxIndex(current.value - 1, count.value, props.loop), -1)
}

function next() {
  if (count.value > 1 && !atEnd.value) moveTo(lightboxIndex(current.value + 1, count.value, props.loop), 1)
}

// Стрічку мініатюр після стрибка нумерації не гортаємо плавно: див. watch нижче.
let instantStrip = false

function sameSources(a: LightboxItem[], b: LightboxItem[]): boolean {
  return a.length === b.length && a.every((item, at) => item.src === b[at]?.src)
}

/*
 * Індекс і список змінюються разом, коли батько підмінює набір слайдів під
 * відкритою галереєю: чат відкрив альбом, а потім дотягнув усі фото чату, і
 * відкрите фото стоїть уже під іншим номером. Слайд на екрані той самий, тож
 * стаємо на новий номер на місці. Анімований перехід (moveTo) тут шкодить
 * тричі: виїжджав би слайд зі старого номера — а там у новому списку чужа
 * картинка; нове фото монтувалося б заново, і між заглушкою та фото були б
 * порожні кадри; стрічка мініатюр їхала б через десятки кнопок.
 */
watch(
  [() => props.images, () => props.index],
  ([list, value], [previousList, previousValue]) => {
    const target = lightboxIndex(value, list.length)
    if (props.modelValue && trackEl.value && value !== previousValue && list !== previousList) {
      const shown = previousList[current.value]
      if (shown && target !== current.value && list[target]?.src === shown.src && !sameSources(list, previousList)) {
        instantStrip = true
        outgoing.value = null
        current.value = target
        return
      }
    }
    if (target === current.value) return
    // Галерею щойно відкривають уже з новим індексом (трек ще не
    // відрендерено) — стаємо на місце одразу, без проїзду від старого.
    if (!props.modelValue || !trackEl.value) current.value = target
    else moveTo(target, slideStep(current.value, target, count.value, props.loop))
  },
)

watch(count, (total) => {
  current.value = lightboxIndex(current.value, total)
  outgoing.value = null
})

// Той самий індекс, але інший набір (полива товару змінилась) — інше фото.
watch(
  () => image.value?.src,
  () => {
    if (props.modelValue) resetView()
  },
)

/* ------------------------------------------------------------------ */
/*  Завантаження                                                       */
/* ------------------------------------------------------------------ */

const loadStates = reactive<Record<string, 'loaded' | 'failed'>>({})
const retries = reactive<Record<string, number>>({})
const stateOf = (item?: LightboxItem) => (item ? loadStates[item.src] : undefined)

const currentLoaded = computed(() => currentKind.value === 'custom' || stateOf(image.value) === 'loaded')
const currentFailed = computed(() => stateOf(image.value) === 'failed')

function markLoaded(item: LightboxItem) {
  loadStates[item.src] = 'loaded'
}

function markFailed(item: LightboxItem) {
  loadStates[item.src] = 'failed'
}

function retry() {
  const item = image.value
  if (!item) return
  delete loadStates[item.src]
  retries[item.src] = (retries[item.src] ?? 0) + 1
}

const imgEls = new Map<number, HTMLImageElement>()
const boxEls = new Map<number, HTMLElement>()

/*
 * «Готове» — це розкодоване, а не лише завантажене. Зображення має
 * decoding="async": подія load приходить, коли файл дійшов, а розкодування
 * ще йде поза потоком, і на екрані до першої відмальовки порожньо. Заглушку-
 * мініатюру за load уже прибрали б — і між нею та фото лишалося б кілька
 * порожніх кадрів. Тому слайд вважаємо готовим після decode(). Там, де його
 * немає (тестове середовище), — одразу.
 */
const decodeQueue = new WeakMap<HTMLImageElement, Array<() => void>>()

function whenDecoded(element: HTMLImageElement, done: () => void) {
  if (typeof element.decode !== 'function') {
    done()
    return
  }
  const queue = decodeQueue.get(element)
  if (queue) {
    queue.push(done)
    return
  }
  decodeQueue.set(element, [done])
  // Відмова decode() (пошкоджене зображення, яке все ж завантажилось) — не
  // привід тримати слайд «неготовим»: показуємо, як є.
  const settle = () => {
    const callbacks = decodeQueue.get(element) ?? []
    decodeQueue.delete(element)
    for (const callback of callbacks) callback()
  }
  element.decode().then(settle, settle)
}

// Зображення з кешу вже `complete` на момент монтування — події load для
// нього може не бути, і без цієї перевірки спінер крутився б над готовим фото.
function setImgEl(panel: Panel, element: unknown) {
  if (element instanceof HTMLImageElement) {
    imgEls.set(panel.vpos, element)
    if (element.complete && element.naturalWidth > 0 && !stateOf(panel.item)) {
      whenDecoded(element, () => markLoaded(panel.item))
    }
  } else {
    imgEls.delete(panel.vpos)
  }
}

function setBoxEl(vpos: number, element: unknown) {
  if (element instanceof HTMLElement) boxEls.set(vpos, element)
  else boxEls.delete(vpos)
}

function onImageLoad(panel: Panel) {
  const ready = () => {
    markLoaded(panel.item)
    // Слайд міг стати сусідом, поки розкодовувався: політ — лише для поточного.
    if (panel.vpos === position.value && pendingZoomIn) {
      const inTime = performance.now() < pendingZoomIn
      pendingZoomIn = 0
      awaitingZoom.value = false
      if (inTime) void nextTick(runZoomIn)
    }
  }
  const element = imgEls.get(panel.vpos)
  if (element) whenDecoded(element, ready)
  else ready()
}

/** Мініатюра як заглушка — лише коли вона справді інша, ніж саме фото. */
function placeholderFor(panel: Panel): string | null {
  const thumbnail = panel.item.thumbnail
  if (!thumbnail || thumbnail === panel.item.src || awaitingZoom.value) return null
  return stateOf(panel.item) ? null : thumbnail
}

function naturalBox(item: LightboxItem) {
  return item.width && item.height ? { maxWidth: `${item.width}px`, maxHeight: `${item.height}px` } : undefined
}

function posterFor(item: LightboxItem, kind: LightboxKind): string | null {
  return item.poster ?? item.thumbnail ?? (kind === 'youtube' ? youtubeThumbnail(item.src) : null)
}

/*
 * Ключ мініатюри — адреса (з лічильником для однакових), а не позиція. Коли
 * чат дотягує сусідні фото й нумерація зсувається, наявні кнопки лишаються
 * тими самими вузлами; з позицією в ключі перемонтовувалась би вся стрічка.
 */
const thumbKeys = computed(() => {
  const seen = new Map<string, number>()
  return props.images.map((item) => {
    const times = seen.get(item.src) ?? 0
    seen.set(item.src, times + 1)
    return times ? `${item.src}#${times}` : item.src
  })
})

function thumbnailFor(item: LightboxItem, index: number): string | null {
  const kind = kindAt(index)
  if (kind === 'image') return item.thumbnail ?? item.src
  return posterFor(item, kind)
}

/*
 * Плеєр і iframe — у пропорції 16:9 (або з width/height слайда), вписані в
 * сцену. Одиниці контейнера (cqw/cqh), а не вимірювання в JS: розмір
 * правильний уже в серверному HTML і сам стежить за поворотом телефона.
 */
function frameStyle(panel: Panel) {
  const { width, height } = panel.item
  const ratio = width && height ? width / height : panel.kind === 'iframe' ? null : 16 / 9
  if (!ratio) return { width: '100%', height: '100%' }
  const limit = width ? `, ${width}px` : ''
  return { width: `min(100cqw, ${(ratio * 100).toFixed(3)}cqh${limit})`, aspectRatio: String(ratio) }
}

/*
 * Функціональний ref Vue викликає на кожному оновленні вузла, а не лише при
 * монтуванні: без цього списку будь-який ререндер (сховати панелі, крок
 * слайдшоу) знову запускав би відео, яке людина щойно поставила на паузу.
 */
const autoplayed = new WeakSet<HTMLVideoElement>()
let videoEl: HTMLVideoElement | null = null

// Відео обрали явно — воно грає одразу. Браузер дозволить звук, бо жест
// користувача щойно був; якщо ні — play() відхилиться, і лишаться контроли.
function setVideoEl(element: unknown) {
  videoEl = element instanceof HTMLVideoElement ? element : null
  if (!videoEl || !props.modelValue || autoplayed.has(videoEl)) return
  autoplayed.add(videoEl)
  const playing = videoEl.play?.()
  if (playing && typeof playing.catch === 'function') playing.catch(() => undefined)
}

/* ------------------------------------------------------------------ */
/*  Збільшення, поворот, віддзеркалення                                */
/* ------------------------------------------------------------------ */

const stageEl = ref<HTMLElement | null>(null)
/*
 * Стан перегляду поточного зображення — звичайний об'єкт, а не reactive:
 * під пальцем він змінюється щокадру. Шаблон бачить лише похідні прапорці
 * (`zoomed`, `atMaxZoom`), що змінюються рідко.
 */
const view = { scale: 1, x: 0, y: 0 }
let closeOffset = 0
const rotation = ref(0)
const flipX = ref(1)
const flipY = ref(1)
const zoomed = shallowRef(false)
const atMaxZoom = shallowRef(false)

const canTransform = computed(() => currentKind.value === 'image' && currentLoaded.value && !currentFailed.value)
const canZoom = computed(() => props.zoomable && canTransform.value)

const zoomEl = (): HTMLImageElement | null => (currentKind.value === 'image' ? imgEls.get(position.value) ?? null : null)

interface Geometry {
  layout: Size
  stage: Size
  base: number
  min: number
  max: number
  naturalRatio: number
}

/*
 * `offsetWidth`, а не getBoundingClientRect: це розмір, який дав CSS, без
 * нашого ж transform. Від нього рахуються і межі масштабу, і межі зсуву.
 */
function measure(): Geometry | null {
  const img = zoomEl()
  const stage = stageEl.value
  if (!img || !stage || !img.offsetWidth || !img.offsetHeight) return null
  const layout = { width: img.offsetWidth, height: img.offsetHeight }
  const box = img.parentElement
  const base = fitScale({
    layout,
    box: { width: box?.clientWidth || stage.clientWidth, height: box?.clientHeight || stage.clientHeight },
    natural: { width: img.naturalWidth, height: img.naturalHeight },
    rotation: rotation.value,
  })
  const naturalRatio = img.naturalWidth > 0 ? img.naturalWidth / layout.width : 1
  const { min, max } = zoomLimits({ base, naturalRatio, maxZoom: props.maxZoom })
  return { layout, stage: { width: stage.clientWidth, height: stage.clientHeight }, base, min, max, naturalRatio }
}

function transformString(): string {
  return `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale * flipX.value}, ${view.scale * flipY.value}) rotate(${rotation.value}deg)`
}

type Speed = 'none' | 'fast' | 'base' | 'slow'

function applyView(speed: Speed = 'none', geometry: Geometry | null = measure()) {
  const img = zoomEl()
  if (img) {
    img.style.transition = speed === 'none' || reducedMotion.value ? 'none' : `transform var(--duration-${speed}) var(--ease-out)`
    img.style.transform = transformString()
  }
  const base = geometry?.base ?? 1
  zoomed.value = view.scale > base * 1.01
  atMaxZoom.value = !!geometry && view.scale >= geometry.max * 0.99
}

function resetView() {
  stopInertia()
  view.scale = 1
  view.x = 0
  view.y = 0
  closeOffset = 0
  rotation.value = 0
  flipX.value = 1
  flipY.value = 1
  applyView('none', null)
  restoreSizes()
}

/*
 * Зі `srcset` браузер обирає файл за розміром у верстці, а transform для
 * нього не існує: збільшене вчетверо фото лишалося б тим самим дрібним
 * файлом, тільки розмитим. Підставляємо в `sizes` фактичну ширину — браузер
 * довантажує більший варіант (і ніколи не повертається до меншого).
 */
function upgradeSizes(geometry: Geometry) {
  const img = zoomEl()
  if (!img || !image.value?.srcset || view.scale <= geometry.base * 1.2) return
  const needed = Math.ceil(geometry.layout.width * view.scale)
  const declared = Number.parseInt(img.sizes, 10)
  if (!(declared >= needed)) img.sizes = `${needed}px`
}

function restoreSizes() {
  const img = zoomEl()
  const item = image.value
  if (img && item?.srcset) img.sizes = item.sizes ?? '100vw'
}

function zoomTo(scale: number, point: Point = { x: 0, y: 0 }, speed: Speed = 'slow') {
  const geometry = measure()
  if (!geometry || !canZoom.value) return
  stopInertia()
  const nextScale = clamp(scale, geometry.min, geometry.max)
  const offset =
    nextScale <= geometry.base * 1.001
      ? { x: 0, y: 0 }
      : zoomAround({ point, offset: view, scale: view.scale, nextScale })
  const bounds = panBounds({ layout: geometry.layout, stage: geometry.stage, scale: nextScale, rotation: rotation.value })
  view.scale = nextScale
  view.x = clamp(offset.x, -bounds.x, bounds.x)
  view.y = clamp(offset.y, -bounds.y, bounds.y)
  applyView(speed, geometry)
  // Збільшив — розглядає: слайдшоу, що перегорнуло б кадр з-під пальця,
  // тут лише заважає.
  if (zoomed.value) playing.value = false
  upgradeSizes(geometry)
}

function toggleZoom(point?: Point) {
  const geometry = measure()
  if (!geometry) return
  if (zoomed.value) zoomTo(geometry.base)
  else zoomTo(toggleZoomTarget(geometry), point)
}

function zoomIn(point?: Point) {
  const geometry = measure()
  if (geometry) zoomTo(stepZoom(view.scale, 1, geometry), point, 'base')
}

function zoomOut(point?: Point) {
  const geometry = measure()
  if (geometry) zoomTo(stepZoom(view.scale, -1, geometry), point, 'base')
}

function resetZoom() {
  const geometry = measure()
  if (geometry) zoomTo(geometry.base)
}

function panBy(dx: number, dy: number) {
  const geometry = measure()
  if (!geometry) return
  const bounds = panBounds({ layout: geometry.layout, stage: geometry.stage, scale: view.scale, rotation: rotation.value })
  view.x = clamp(view.x + dx, -bounds.x, bounds.x)
  view.y = clamp(view.y + dy, -bounds.y, bounds.y)
  applyView('fast', geometry)
}

/** Поворот на чверть оберту: `1` — за годинниковою стрілкою, `-1` — проти. */
function rotate(direction: 1 | -1 = 1) {
  if (!canTransform.value) return
  stopInertia()
  playing.value = false
  rotation.value += direction > 0 ? 90 : -90
  // Повернуте фото вписується заново: ширина й висота помінялися місцями.
  const geometry = measure()
  view.scale = geometry?.base ?? 1
  view.x = 0
  view.y = 0
  applyView('slow', geometry)
}

/** Віддзеркалення по горизонталі (`x`) чи вертикалі (`y`) — в осях екрана. */
function flip(axis: 'x' | 'y' = 'x') {
  if (!canTransform.value) return
  playing.value = false
  if (axis === 'x') flipX.value *= -1
  else flipY.value *= -1
  applyView('slow')
}

/* ------------------------------------------------------------------ */
/*  Жести                                                              */
/* ------------------------------------------------------------------ */

type Gesture = 'idle' | 'pending' | 'swipe' | 'close' | 'pan' | 'pinch' | 'done'

let gesture: Gesture = 'idle'
const pointers = new Map<number, Point>()
let gestureStart: PointerSample = { x: 0, y: 0, t: 0 }
let viewStart = { scale: 1, x: 0, y: 0 }
let pinchStart = { distance: 1, point: { x: 0, y: 0 }, scale: 1, x: 0, y: 0 }
let pinchPoint: Point = { x: 0, y: 0 }
let samples: PointerSample[] = []
let gestureGeometry: Geometry | null = null
// Жест, що рушив слайд, не має закінчитись ще й кліком по ньому — інакше
// кожне перетягування вмикало б збільшення.
let swallowClick = false
let lastPointerType = 'mouse'
let lastTap: PointerSample | null = null
let tapTimer: ReturnType<typeof setTimeout> | undefined
const grabbing = shallowRef(false)
const closeDragging = shallowRef(false)

/*
 * Звідки жест не починається: кнопки й поля (у слоті custom теж), iframe
 * (туди події й так не доходять) і нижня смуга відео, де нативні контроли:
 * перемотування не має перетворюватися на свайп.
 */
const NO_GESTURE = 'button, a, input, textarea, select, label, [contenteditable="true"], iframe, audio, [data-lightbox-no-drag]'

function gestureAllowed(event: PointerEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) return true
  if (target.closest(NO_GESTURE)) return false
  if (target instanceof HTMLVideoElement) {
    const rect = target.getBoundingClientRect()
    if (event.clientY > rect.bottom - 56) return false
  }
  return true
}

/** Точка відносно центру сцени — система координат усієї геометрії. */
function stagePoint(clientX: number, clientY: number): Point {
  const rect = stageEl.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) }
}

/*
 * Вказівник іде за пальцем і поза сценою: без capture палець, що з'їхав на
 * панель мініатюр, обривав би жест, і слайд смикався б назад.
 */
function capture(event: PointerEvent) {
  try {
    stageEl.value?.setPointerCapture(event.pointerId)
  } catch {
    // Вказівник уже пішов — жест завершиться на pointerup/cancel.
  }
}

function onPointerDown(event: PointerEvent) {
  lastPointerType = event.pointerType
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (!gestureAllowed(event)) return
  // Основний вказівник — завжди новий жест. Якщо попередній так і не
  // отримав pointerup (вікно втратило фокус посеред жесту), його запис у
  // списку глушив би кожен наступний жест мишею.
  if (event.isPrimary && pointers.size) abandonGesture()
  if (pointers.size === 0) {
    stopInertia()
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gesture = 'pending'
    gestureStart = { x: event.clientX, y: event.clientY, t: event.timeStamp }
    viewStart = { ...view }
    samples = [gestureStart]
    swallowClick = false
    return
  }
  // Другий палець — щипок. Свайп чи закриття, що почалися першим пальцем,
  // скасовуються: одночасно гортати й збільшувати не можна.
  if (pointers.size === 1 && event.pointerType === 'touch' && canZoom.value) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    beginPinch(event)
  }
}

function beginPinch(event: PointerEvent) {
  if (trackDrag) {
    trackDrag = 0
    applyTrack(true)
  }
  if (gesture === 'close') cancelCloseDrag()
  const [a, b] = [...pointers.values()]
  if (!a || !b) return
  gestureGeometry = measure()
  pinchPoint = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2)
  pinchStart = {
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    point: pinchPoint,
    scale: view.scale,
    x: view.x,
    y: view.y,
  }
  gesture = 'pinch'
  swallowClick = true
  clearTapTimer()
  lastTap = null
  grabbing.value = true
  capture(event)
}

function onPointerMove(event: PointerEvent) {
  const pointer = pointers.get(event.pointerId)
  if (!pointer) return
  pointer.x = event.clientX
  pointer.y = event.clientY
  if (gesture === 'pinch') {
    updatePinch()
    return
  }
  if (gesture !== 'pending' && gesture !== 'swipe' && gesture !== 'close' && gesture !== 'pan') return

  const dx = event.clientX - gestureStart.x
  const dy = event.clientY - gestureStart.y
  if (Math.hypot(dx, dy) > TAP_SLOP_PX) swallowClick = true
  samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })
  if (samples.length > 24) samples.shift()

  if (gesture === 'pending') {
    if (!decideGesture(dx, dy)) return
    capture(event)
  }

  if (gesture === 'swipe') {
    const single = count.value < 2
    trackDrag = rubberBandDelta(dx, { atStart: atStart.value || single, atEnd: atEnd.value || single })
    applyTrack(false)
  } else if (gesture === 'close') {
    closeOffset = dy
    applyCloseOffset(false)
  } else if (gesture === 'pan') {
    updatePan(dx, dy)
  }
}

/*
 * Незбільшене фото: жест класифікується за домінантною віссю ДО того, як
 * щось рухати (як у UiCarousel) — горизонталь гортає, вертикаль закриває.
 * Збільшене: будь-який рух — це зсув.
 */
function decideGesture(dx: number, dy: number): boolean {
  if (zoomed.value && zoomEl()) {
    if (Math.hypot(dx, dy) < 3) return false
    gesture = 'pan'
    gestureGeometry = measure()
  } else {
    const axis = dragAxis(dx, dy)
    if (axis === null) return false
    if (axis === 'x') {
      gesture = 'swipe'
    } else if (props.dragToClose) {
      gesture = 'close'
      closeDragging.value = true
    } else {
      gesture = 'done'
      return false
    }
  }
  grabbing.value = true
  clearTapTimer()
  return true
}

function updatePan(dx: number, dy: number) {
  const geometry = gestureGeometry
  if (!geometry) return
  const bounds = panBounds({ layout: geometry.layout, stage: geometry.stage, scale: view.scale, rotation: rotation.value })
  let x = viewStart.x + dx
  // Дотягнули збільшене фото до краю — решту руху забирає трек: наступний
  // слайд виїжджає, як у галереї телефона, без зменшення назад.
  if (count.value > 1 && Math.abs(x) > bounds.x) {
    const edge = Math.sign(x) * bounds.x
    trackDrag = rubberBandDelta(x - edge, { atStart: atStart.value, atEnd: atEnd.value })
    x = edge
  } else {
    trackDrag = 0
    x = rubberband(x, bounds.x)
  }
  applyTrack(false)
  view.x = x
  view.y = rubberband(viewStart.y + dy, bounds.y)
  applyView('none', geometry)
}

function updatePinch() {
  const geometry = gestureGeometry
  const [a, b] = [...pointers.values()]
  if (!geometry || !a || !b) return
  const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
  pinchPoint = stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2)
  const scale = rubberbandScale(pinchStart.scale * (distance / pinchStart.distance), geometry.min, geometry.max)
  // Деталь під пальцями на початку щипка лишається під ними: спершу
  // масштаб навколо початкової точки, потім — зсув за рухом пальців.
  const anchored = zoomAround({ point: pinchStart.point, offset: pinchStart, scale: pinchStart.scale, nextScale: scale })
  view.scale = scale
  view.x = anchored.x + pinchPoint.x - pinchStart.point.x
  view.y = anchored.y + pinchPoint.y - pinchStart.point.y
  applyView('none', geometry)
}

/*
 * pointerup і pointercancel слухаємо на window, а не на сцені. Мишу, яку
 * відпустили над панеллю мініатюр до того, як жест визначився (захоплення
 * вказівника ще немає), сцена не почула б — і жест лишився б «натиснутим»:
 * слайд їхав би за курсором без жодної кнопки.
 */
function onWindowPointerEnd(event: PointerEvent) {
  if (event.type === 'pointercancel') onPointerCancel(event)
  else onPointerUp(event)
}

function onPointerUp(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.delete(event.pointerId)
  if (gesture === 'pinch') {
    settleZoom()
    // Один палець лишився — чекаємо, поки підніметься і він: продовжувати
    // ним зсув означало б стрибок під пальцем, що вже не там, де був.
    if (pointers.size === 0) endGesture()
    else gesture = 'done'
    return
  }
  if (pointers.size > 0) return

  const dx = event.clientX - gestureStart.x
  const dy = event.clientY - gestureStart.y
  const elapsed = event.timeStamp - gestureStart.t
  samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp })

  if (gesture === 'swipe') finishSwipe(dx, elapsed)
  else if (gesture === 'close') finishClose(dy, elapsed)
  else if (gesture === 'pan') finishPan(elapsed)
  else if (gesture === 'pending' && event.pointerType === 'touch' && isTap({ dx, dy, elapsedMs: elapsed })) onTap(event)
  endGesture()
}

function onPointerCancel(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.delete(event.pointerId)
  if (pointers.size === 0) abandonGesture()
}

/** Жест обірвано: усе, що встигло зрушити, плавно повертається на місце. */
function abandonGesture() {
  if (gesture === 'pinch' || gesture === 'pan') settleZoom()
  if (trackDrag) {
    trackDrag = 0
    applyTrack(true)
  }
  if (gesture === 'close') cancelCloseDrag()
  pointers.clear()
  endGesture()
}

function endGesture() {
  if (pointers.size === 0) gesture = 'idle'
  samples = []
  gestureGeometry = null
  grabbing.value = false
  closeDragging.value = false
}

function finishSwipe(distance: number, elapsed: number) {
  const width = stageEl.value?.clientWidth ?? 0
  const advance = count.value > 1 && shouldAdvance({ dx: distance, elapsedMs: elapsed, width })
  const direction = swipeDirection(distance)
  trackDrag = 0
  if (advance && direction === 'next' && !atEnd.value) next()
  else if (advance && direction === 'previous' && !atStart.value) previous()
  else applyTrack(true)
}

function finishClose(dy: number, elapsed: number) {
  const height = stageEl.value?.clientHeight ?? 0
  const velocity = releaseVelocity(samples).y
  if (shouldCloseOnDrag({ dy, elapsedMs: elapsed, height, velocity })) close()
  else cancelCloseDrag()
}

function finishPan(elapsed: number) {
  if (trackDrag) {
    // Відпустили за краєм фото — вирішує трек: перегорнути чи повернутись.
    const before = current.value
    finishSwipe(trackDrag, elapsed)
    if (current.value === before) settleZoom()
    return
  }
  const geometry = gestureGeometry
  if (!geometry) return
  const bounds = panBounds({ layout: geometry.layout, stage: geometry.stage, scale: view.scale, rotation: rotation.value })
  const outside = Math.abs(view.x) > bounds.x || Math.abs(view.y) > bounds.y
  if (outside || reducedMotion.value) {
    view.x = clamp(view.x, -bounds.x, bounds.x)
    view.y = clamp(view.y, -bounds.y, bounds.y)
    applyView(outside ? 'base' : 'none', geometry)
    return
  }
  const velocity = releaseVelocity(samples)
  if (Math.hypot(velocity.x, velocity.y) > 0.1) startInertia(velocity, geometry)
}

/** Після щипка: масштаб і зсув повертаються в межі — плавно, з точки пальців. */
function settleZoom() {
  const geometry = gestureGeometry ?? measure()
  if (!geometry) return
  const scale = clamp(view.scale, geometry.min, geometry.max)
  if (scale !== view.scale) {
    const anchored = zoomAround({ point: pinchPoint, offset: view, scale: view.scale, nextScale: scale })
    view.scale = scale
    view.x = anchored.x
    view.y = anchored.y
  }
  if (view.scale <= geometry.base * 1.001) {
    view.scale = geometry.base
    view.x = 0
    view.y = 0
  }
  const bounds = panBounds({ layout: geometry.layout, stage: geometry.stage, scale: view.scale, rotation: rotation.value })
  view.x = clamp(view.x, -bounds.x, bounds.x)
  view.y = clamp(view.y, -bounds.y, bounds.y)
  applyView('base', geometry)
  if (zoomed.value) playing.value = false
  upgradeSizes(geometry)
}

let inertiaFrame = 0

/*
 * Інерція після змаху збільшеного фото. Раніше зсув робила нативна
 * прокрутка, і інерцію давав браузер; з transform вона наша. Кадри —
 * requestAnimationFrame, тож у фоновій вкладці вона просто стоїть.
 */
function startInertia(velocity: Point, geometry: Geometry) {
  stopInertia()
  if (typeof requestAnimationFrame === 'undefined') return
  const bounds = panBounds({ layout: geometry.layout, stage: geometry.stage, scale: view.scale, rotation: rotation.value })
  let vx = velocity.x
  let vy = velocity.y
  let last = performance.now()
  const step = (now: number) => {
    const elapsed = Math.min(Math.max(now - last, 0), 32)
    last = now
    view.x += vx * elapsed
    view.y += vy * elapsed
    if (Math.abs(view.x) >= bounds.x) {
      view.x = clamp(view.x, -bounds.x, bounds.x)
      vx = 0
    }
    if (Math.abs(view.y) >= bounds.y) {
      view.y = clamp(view.y, -bounds.y, bounds.y)
      vy = 0
    }
    vx = decay(vx, elapsed)
    vy = decay(vy, elapsed)
    applyView('none', geometry)
    inertiaFrame = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : 0
  }
  inertiaFrame = requestAnimationFrame(step)
}

function stopInertia() {
  if (inertiaFrame && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(inertiaFrame)
  inertiaFrame = 0
}

function clearTapTimer() {
  clearTimeout(tapTimer)
  tapTimer = undefined
}

/*
 * Дотик на телефоні: один — сховати чи показати панелі (фото на весь
 * екран), подвійний — збільшити в точці дотику. Одиночний чекає паузу
 * подвійного дотику, інакше подвійний спершу ховав би панелі.
 */
function onTap(event: PointerEvent) {
  const sample = { x: event.clientX, y: event.clientY, t: event.timeStamp }
  const onImage = !!zoomEl() && event.target === zoomEl()
  if (isDoubleTap(lastTap, sample)) {
    clearTapTimer()
    lastTap = null
    if (onImage && canZoom.value) toggleZoom(stagePoint(sample.x, sample.y))
    return
  }
  lastTap = sample
  clearTapTimer()
  const target = event.target
  if (!onImage && !(target instanceof Element && target.hasAttribute('data-lightbox-backdrop'))) return
  tapTimer = setTimeout(() => {
    tapTimer = undefined
    // Сховані з будь-якої причини (дотиком чи без руху) — дотик повертає.
    if (chromeHidden.value) {
      tapHidden.value = false
      wake()
    } else {
      tapHidden.value = true
    }
  }, DOUBLE_TAP_MS)
}

function onStageClick(event: MouseEvent) {
  // Дотик обробляє onTap; синтезований після нього click — не дія.
  if (lastPointerType === 'touch') return
  if (swallowClick) {
    swallowClick = false
    return
  }
  // Другий клік подвійного: перший уже збільшив, і цей мав би одразу
  // зменшити назад — звичка «двічі клацнути, щоб збільшити» давала б нуль.
  if (event.detail > 1) return
  const target = event.target
  const img = zoomEl()
  if (img && target === img) {
    if (canZoom.value) toggleZoom(stagePoint(event.clientX, event.clientY))
    return
  }
  // Клік у порожнє поле навколо слайда — як клік по фону модалки.
  if (target instanceof Element && target.hasAttribute('data-lightbox-backdrop') && !zoomed.value && props.closeOnBackdrop) {
    close()
  }
}

let wheelLockUntil = 0
let wheelSum = 0
let wheelAt = 0

function onWheel(event: WheelEvent) {
  const pinch = event.ctrlKey || event.metaKey
  if (canZoom.value && (pinch || props.wheel === 'zoom')) {
    event.preventDefault()
    const geometry = measure()
    if (!geometry) return
    const factor = wheelZoomFactor(event.deltaY, event.deltaMode, pinch, geometry.stage.height)
    zoomTo(view.scale * factor, stagePoint(event.clientX, event.clientY), pinch ? 'none' : 'fast')
    return
  }
  if (props.wheel !== 'navigate' || zoomed.value || count.value < 2) return
  // Прокрутка всередині власного вмісту слайда належить йому.
  if (event.target instanceof Element && event.target.closest('[data-lightbox-custom]')) return
  event.preventDefault()
  // Тачпад шле хвіст інерції ще пів секунди після жесту: один змах — один
  // слайд, а не п'ять. Поки події йдуть без паузи, замок подовжується.
  if (event.timeStamp < wheelLockUntil) {
    wheelLockUntil = event.timeStamp + 200
    return
  }
  // Залишок попереднього змаху не додається до нового: інакше легкий
  // дотик до колеса через хвилину гортав би слайд.
  if (event.timeStamp - wheelAt > 200) wheelSum = 0
  wheelAt = event.timeStamp
  wheelSum += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (Math.abs(wheelSum) < 40) return
  if (wheelSum > 0) next()
  else previous()
  wheelSum = 0
  wheelLockUntil = event.timeStamp + 300
}

/* ------------------------------------------------------------------ */
/*  Закриття змахом                                                    */
/* ------------------------------------------------------------------ */

const rootEl = ref<HTMLElement | null>(null)

/*
 * Зсув — на коробці слайда, а не на зображенні: закривати змахом можна й
 * відео, і власний вміст. Фон і панелі гаснуть через CSS-змінну: інлайнова
 * opacity перебила б класи виходу, і фон не згасав би при закритті.
 */
function applyCloseOffset(animate: boolean) {
  const box = boxEls.get(position.value)
  if (box) {
    box.style.transition = animate && !reducedMotion.value ? 'transform var(--duration-base) var(--ease-out)' : 'none'
    box.style.transform = closeOffset ? `translate3d(0, ${closeOffset}px, 0)` : ''
  }
  const progress = closeProgress(closeOffset, stageEl.value?.clientHeight ?? 0)
  rootEl.value?.style.setProperty('--ui-lightbox-fade', String(1 - progress))
}

function cancelCloseDrag() {
  closeOffset = 0
  applyCloseOffset(true)
}

/* ------------------------------------------------------------------ */
/*  Панелі: сховати без руху миші чи дотиком                           */
/* ------------------------------------------------------------------ */

const tapHidden = shallowRef(false)
const idleHidden = shallowRef(false)
const chromeHidden = computed(() => tapHidden.value || idleHidden.value)
let idleTimer: ReturnType<typeof setTimeout> | undefined
let pointerOverChrome = false

function focusInChrome(): boolean {
  const active = typeof document === 'undefined' ? null : document.activeElement
  if (!(active instanceof Element) || !active.closest('[data-lightbox-chrome]')) return false
  try {
    return active.matches(':focus-visible')
  } catch {
    return true
  }
}

function scheduleIdle() {
  clearTimeout(idleTimer)
  if (props.idle === false || props.idle <= 0 || !props.modelValue) return
  idleTimer = setTimeout(() => {
    // Курсор над панеллю чи фокус із клавіатури на кнопці — людина саме
    // користується панеллю, ховати її з-під рук не можна.
    if (pointerOverChrome || focusInChrome()) return
    idleHidden.value = true
  }, props.idle)
}

function wake() {
  idleHidden.value = false
  scheduleIdle()
}

function onPanelPointerMove(event: PointerEvent) {
  if (event.pointerType === 'mouse') wake()
}

function onChromePointer(inside: boolean) {
  pointerOverChrome = inside
  if (!inside) scheduleIdle()
}

// Tab дійшов до схованої кнопки — панелі повертаються: фокус на невидимому
// елементі — це сліпе керування з клавіатури.
function onPanelFocusIn(event: FocusEvent) {
  if (event.target instanceof Element && event.target.closest('[data-lightbox-chrome]')) {
    tapHidden.value = false
    wake()
  }
}

/*
 * Панель інструментів і стрічка мініатюр гортаються вбік. Chromium на Tab
 * докручує смугу лише до кнопки, схованої повністю, і то по центру;
 * частково видиму лишає обрізаною разом із фокус-кільцем. `nearest` разом
 * зі scroll-padding смуги показує кнопку цілою. Лише для фокуса з
 * клавіатури: прокрутка посеред кліку чи тапу зсунула б кнопку з-під пальця.
 */
function onStripFocusIn(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (target.matches(':focus-visible')) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/* ------------------------------------------------------------------ */
/*  Слайдшоу, повний екран, мініатюри, завантаження                    */
/* ------------------------------------------------------------------ */

const fullscreen = useFullscreen()
const thumbnailsVisible = shallowRef(props.thumbnails)
// Один слайд, але решта ще їде (loadingMore): стрічка вже на місці.
const growing = computed(() => props.loadingMore && count.value > 0)
const showThumbnails = computed(() => thumbnailsVisible.value && (count.value > 1 || growing.value))

const toolbarItems = computed<Tool[]>(() => {
  const list = [...new Set(props.toolbar)]
  // Слайдшоу, що стартує саме, мусить мати паузу (WCAG 2.2.2).
  if (props.autoplay && !list.includes('slideshow')) list.push('slideshow')
  return list.filter((tool) => {
    if (tool === 'zoom' || tool === 'zoomIn' || tool === 'zoomOut') return props.zoomable
    if (tool === 'slideshow' || tool === 'thumbnails') return count.value > 1 || growing.value
    if (tool === 'fullscreen') return fullscreen.supported.value
    return true
  })
})

const playing = shallowRef(false)
const slideshowTicking = shallowRef(false)
const slideshowCycle = shallowRef(0)
const documentHidden = shallowRef(false)
let slideshowTimer: ReturnType<typeof setTimeout> | undefined
const slideshowAvailable = computed(() => toolbarItems.value.includes('slideshow'))

/*
 * Слайдшоу чекає: поки фото вантажиться (кадр, показаний на пів секунди,
 * ніхто не встиг би роздивитись), поки вкладка у фоні і поки поточний
 * слайд — відео чи сторінка: обрізати відео на третій секунді гірше, ніж
 * зачекати. Файлове відео саме перегортає слайд, коли закінчиться.
 */
function syncSlideshow() {
  clearTimeout(slideshowTimer)
  slideshowTimer = undefined
  const kind = currentKind.value
  const ready =
    playing.value
    && props.modelValue
    && !documentHidden.value
    && !zoomed.value
    && (kind === 'image' || kind === 'custom')
    && (currentLoaded.value || currentFailed.value)
  slideshowTicking.value = ready
  if (!ready) return
  slideshowCycle.value += 1
  slideshowTimer = setTimeout(advanceSlideshow, Math.max(1000, props.interval))
}

function advanceSlideshow() {
  const target = nextSlideshowIndex(current.value, count.value, props.loop)
  if (target === null) playing.value = false
  else moveTo(target, 1)
}

watch(
  [playing, current, currentLoaded, currentFailed, zoomed, documentHidden, () => props.interval, () => props.modelValue],
  syncSlideshow,
)

function toggleSlideshow() {
  if (!slideshowAvailable.value) return
  // Запуск на останньому кадрі без loop одразу б і зупинився.
  if (!playing.value && atEnd.value) goTo(0)
  playing.value = !playing.value
}

function onVideoEnded() {
  if (playing.value) advanceSlideshow()
}

function onVisibilityChange() {
  documentHidden.value = document.hidden
}

function toggleFullscreen() {
  void fullscreen.toggle()
}

function toggleThumbnails() {
  thumbnailsVisible.value = !thumbnailsVisible.value
  if (thumbnailsVisible.value) scrollThumbIntoView(false)
}

const downloadHref = computed(() => {
  const item = image.value
  const kind = currentKind.value
  if (!item || item.download === false || (kind !== 'image' && kind !== 'video')) return null
  return typeof item.download === 'string' ? item.download : item.src
})

/* ------------------------------------------------------------------ */
/*  Анімація з мініатюри                                               */
/* ------------------------------------------------------------------ */

/** Клас на корені: фото летить саме, панель не згасає разом із ним. */
const zoomEffect = shallowRef(false)
/** Фото ще вантажиться, а політ уже заплановано — заглушку не показуємо. */
const awaitingZoom = shallowRef(false)
let pendingZoomIn = 0

function easingToken(name: `--${string}`, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function originFor(index: number): Element | null {
  if (!props.origin) return null
  let found: Element | null | undefined
  try {
    found = props.origin(index)
  } catch {
    found = null
  }
  if (!(found instanceof Element)) return null
  return found instanceof HTMLImageElement ? found : found.querySelector('img') ?? found
}

/** Прямокутники, що обрізають елемент: вікно і предки з overflow. */
function clipRects(element: Element): Rect[] {
  const rects: Rect[] = [{ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }]
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') rects.push(node.getBoundingClientRect())
  }
  return rects
}

function originInfo(index: number): { rect: Rect; fit: 'cover' | 'contain'; radius: number } | null {
  const element = originFor(index)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height || visibleFraction(rect, clipRects(element)) < 0.6) return null
  const style = getComputedStyle(element)
  const fit = element instanceof HTMLImageElement && style.objectFit !== 'cover' ? 'contain' : 'cover'
  let radius = Number.parseFloat(style.borderTopLeftRadius) || 0
  // Кути часто малює обгортка-кнопка з overflow-clip, а не саме зображення.
  const parent = element.parentElement
  if (parent) {
    const outer = parent.getBoundingClientRect()
    if (Math.abs(outer.width - rect.width) < 3 && Math.abs(outer.height - rect.height) < 3) {
      radius = Math.max(radius, Number.parseFloat(getComputedStyle(parent).borderTopLeftRadius) || 0)
    }
  }
  return { rect, fit, radius }
}

/** Де стоїть зображення без нашого transform: по центру своєї коробки. */
function layoutRect(img: HTMLElement): Rect | null {
  const box = img.parentElement
  if (!box || !img.offsetWidth || !img.offsetHeight) return null
  const outer = box.getBoundingClientRect()
  return {
    left: outer.left + (outer.width - img.offsetWidth) / 2,
    top: outer.top + (outer.height - img.offsetHeight) / 2,
    width: img.offsetWidth,
    height: img.offsetHeight,
  }
}

function canFlyFromOrigin(): boolean {
  if (reducedMotion.value || !props.origin || currentKind.value !== 'image') return false
  if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.animate !== 'function') return false
  return !!originInfo(current.value)
}

function runZoomIn(): boolean {
  const img = zoomEl()
  const info = originInfo(current.value)
  const layout = img && layoutRect(img)
  if (!img || !info || !layout || typeof img.animate !== 'function') return false
  const from = originTransform({ image: layout, thumbnail: info.rect, fit: info.fit, radius: info.radius })
  img.animate(
    [
      {
        transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(${from.scale})`,
        clipPath: `inset(${from.clipY}px ${from.clipX}px ${from.clipY}px ${from.clipX}px round ${from.radius}px)`,
        opacity: 1,
      },
      { transform: transformString(), clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 },
    ],
    { duration: readDurationToken('--duration-slow', 260), easing: easingToken('--ease-emphasized', 'cubic-bezier(0.32, 0.72, 0, 1)') },
  )
  return true
}

/*
 * Закриття: фото летить назад у мініатюру з того місця, де воно зараз, —
 * збільшене чи недотягнуте змахом. Повернуте чи віддзеркалене фото в
 * мініатюру не вляже, тож тоді галерея просто згасає.
 */
function runZoomOut(): boolean {
  if (reducedMotion.value || !props.origin || !canTransform.value) return false
  if (rotation.value % 360 !== 0 || flipX.value < 0 || flipY.value < 0) return false
  const img = zoomEl()
  if (!img || typeof img.animate !== 'function') return false
  const info = originInfo(current.value)
  const layout = layoutRect(img)
  if (!info || !layout) return false
  stopInertia()
  const to = originTransform({ image: layout, thumbnail: info.rect, fit: info.fit, radius: info.radius })
  img.animate(
    [
      { transform: transformString(), clipPath: 'inset(0px 0px 0px 0px round 0px)' },
      {
        transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(${to.scale})`,
        clipPath: `inset(${to.clipY}px ${to.clipX}px ${to.clipY}px ${to.clipX}px round ${to.radius}px)`,
      },
    ],
    { duration: readDurationToken('--duration-slow', 260), easing: easingToken('--ease-emphasized', 'cubic-bezier(0.32, 0.72, 0, 1)'), fill: 'forwards' },
  )
  return true
}

/* ------------------------------------------------------------------ */
/*  Відкриття, фокус, клавіатура                                       */
/* ------------------------------------------------------------------ */

const panelEl = ref<HTMLElement | null>(null)
const thumbEls = shallowRef<(HTMLElement | null)[]>([])
const teleportReady = shallowRef(false)
/*
 * Escape — через спільний реєстр шарів, як у Modal і Drawer: він віддає
 * натиск рівно верхньому шару, тож підказка чи меню, відкриті поверх
 * галереї, закриються першими, а галерея — лише наступним Escape.
 */
const layer = useOverlayLayer(undefined, {
  // Перший Escape лише зменшує: «вийти зі збільшення» і «закрити галерею» —
  // різні наміри, і другий не має ховатися за першим.
  onEscape: () => (zoomed.value ? resetZoom() : close()),
})
const scrollLock = useScrollLock()
const focusTrap = useFocusTrap(() => panelEl.value)
const titleId = `${useId()}-lightbox`

// Тривалості — з токенів руху, а не літерали: проєкт, що перевизначив
// --duration-slow, інакше отримав би обрізану анімацію.
const transitionDuration = computed(() =>
  reducedMotion.value
    ? 0
    : {
        enter: readDurationToken('--duration-slow', 260),
        leave: zoomEffect.value ? readDurationToken('--duration-slow', 260) : readDurationToken('--duration-base', 180),
      },
)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

/*
 * Фокус із слайда, що виїжджає, — на панель: слайд стане inert, і фокус
 * інакше впав би в <body>, де стрілки вже нічого не гортають.
 */
function rescueFocus() {
  const panel = panelEl.value
  const active = typeof document === 'undefined' ? null : document.activeElement
  if (panel && active instanceof HTMLElement && active.closest('[data-lightbox-slide]')) {
    panel.focus({ preventScroll: true })
  }
}

function clearTimers() {
  clearTimeout(idleTimer)
  clearTimeout(slideshowTimer)
  clearTapTimer()
  slideshowTimer = undefined
}

function resetForOpen() {
  position.value = 0
  outgoing.value = null
  trackDrag = 0
  view.scale = 1
  view.x = 0
  view.y = 0
  closeOffset = 0
  rotation.value = 0
  flipX.value = 1
  flipY.value = 1
  zoomed.value = false
  atMaxZoom.value = false
  tapHidden.value = false
  idleHidden.value = false
  thumbnailsVisible.value = props.thumbnails
  zoomEffect.value = false
  awaitingZoom.value = false
  pendingZoomIn = 0
  playing.value = props.autoplay && !reducedMotion.value && count.value > 1
}

let resizeObserver: ResizeObserver | null = null
let stageSize: Size = { width: 0, height: 0 }

/*
 * Нова геометрія (поворот телефона, повний екран) — старі масштаб і зсув
 * можуть вивести фото за край. Вписуємо заново; поворот фото лишається.
 */
function onStageResize() {
  const stage = stageEl.value
  if (!stage) return
  const size = { width: stage.clientWidth, height: stage.clientHeight }
  if (size.width === stageSize.width && size.height === stageSize.height) return
  stageSize = size
  stopInertia()
  const geometry = measure()
  view.scale = geometry?.base ?? 1
  view.x = 0
  view.y = 0
  applyView('none', geometry)
}

function observeStage() {
  disconnectStage()
  const stage = stageEl.value
  if (!stage) return
  stageSize = { width: stage.clientWidth, height: stage.clientHeight }
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(onStageResize)
    resizeObserver.observe(stage)
  } else {
    window.addEventListener('resize', onStageResize)
  }
}

function disconnectStage() {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof window !== 'undefined') window.removeEventListener('resize', onStageResize)
}

// handleClose кличе й onBeforeUnmount — у тому числі для галереї, яку не
// відкривали: красти фокус на мініатюру тоді не можна.
let active = false

async function handleOpen() {
  active = true
  layer.activate()
  scrollLock.lock()
  resetForOpen()
  await nextTick()
  if (!props.modelValue) return
  // Фокус на саму панель, а не на хрестик: стрілки мають гортати одразу,
  // а перший Tab — дійти до першої кнопки, не пропустивши її.
  focusTrap.activate({ initialFocus: null })
  window.addEventListener('pointerup', onWindowPointerEnd, true)
  window.addEventListener('pointercancel', onWindowPointerEnd, true)
  observeStage()
  applyTrack(false)
  applyView('none')
  scrollThumbIntoView(false)
  scheduleIdle()

  if (!zoomEffect.value) return
  if (currentLoaded.value) {
    runZoomIn()
  } else {
    // Фото ще в дорозі. Чекаємо його недовго: політ, що стартує через
    // секунду після кліку, виглядає як збій, а не як анімація.
    pendingZoomIn = performance.now() + 600
    awaitingZoom.value = true
  }
}

/*
 * З `origin` фокус повертається на мініатюру слайда, який переглядали, —
 * туди ж, куди летить фото. Кнопка, з якої галерею відкрили, часто вже
 * недосяжна: у каруселі, що йде за індексом галереї, її слайд став inert,
 * і фокус падав у <body>. Шукаємо фокусованого предка: мініатюра — це
 * зазвичай <img> усередині кнопки.
 */
function returnFocusToOrigin() {
  const origin = originFor(current.value)
  const target = origin?.closest<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  if (!target || target.closest('[inert]') || !target.isConnected) return
  target.focus({ preventScroll: true })
}

function handleClose() {
  focusTrap.deactivate()
  if (active) returnFocusToOrigin()
  active = false
  scrollLock.unlock()
  layer.deactivate()
  stopInertia()
  clearTimers()
  playing.value = false
  pointers.clear()
  endGesture()
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointerup', onWindowPointerEnd, true)
    window.removeEventListener('pointercancel', onWindowPointerEnd, true)
  }
  disconnectStage()
  videoEl?.pause?.()
  pendingZoomIn = 0
  awaitingZoom.value = false
  void fullscreen.exitIfEntered()
}

function onAfterLeave() {
  layer.settle()
  zoomEffect.value = false
}

let planZoomIn = false

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      planZoomIn = true
      void handleOpen()
    } else {
      // Спершу політ, поки фото ще на своєму місці, і лише потім розбір
      // стану: після нього зникло б і те, звідки летіти.
      zoomEffect.value = runZoomOut()
      handleClose()
    }
  },
)

/*
 * Летіти чи ні — вирішуємо ДО того, як оверлей потрапить у DOM: тут усі
 * pre-watcher'и вже відпрацювали (індекс остаточний), а рендер ще попереду.
 * Пізніше не можна: вимірювання мініатюри примушує браузер перерахувати
 * стилі, і панель, вставлена без класу польоту, встигала почати звичайне
 * згасання — фото летіло напівпрозорим.
 */
onBeforeUpdate(() => {
  if (!planZoomIn) return
  planZoomIn = false
  zoomEffect.value = props.modelValue && canFlyFromOrigin()
})

function scrollThumbIntoView(smooth = true) {
  void nextTick(() => {
    thumbEls.value[current.value]?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: smooth && !reducedMotion.value ? 'smooth' : 'auto',
    })
  })
}

watch(current, () => {
  if (!props.modelValue) return
  const smooth = !instantStrip
  instantStrip = false
  scrollThumbIntoView(smooth)
})

const PAN_STEP = 80

function onKeydown(event: KeyboardEvent) {
  // defaultPrevented — натиск уже обробив шар вище (меню, поле в панелі дій).
  if (event.defaultPrevented || !props.modelValue || !layer.isTopmost.value) return
  // Ціль — не обов'язково Element (подію можна диспатчити і на document).
  const target = event.target
  if (target instanceof Element && target.closest('input, textarea, select, video, audio, [contenteditable="true"]')) return
  wake()

  const pan = zoomed.value
  switch (event.key) {
    case 'ArrowLeft':
      if (pan) panBy(PAN_STEP, 0)
      else previous()
      break
    case 'ArrowRight':
      if (pan) panBy(-PAN_STEP, 0)
      else next()
      break
    case 'ArrowUp':
    case 'ArrowDown':
      if (!pan) return
      panBy(0, event.key === 'ArrowUp' ? PAN_STEP : -PAN_STEP)
      break
    case 'PageUp':
      previous()
      break
    case 'PageDown':
      next()
      break
    case 'Home':
      if (pan) return
      goTo(0)
      break
    case 'End':
      if (pan) return
      goTo(count.value - 1)
      break
    case '+':
    case '=':
      if (!canZoom.value) return
      zoomIn()
      break
    case '-':
    case '_':
      if (!pan) return
      zoomOut()
      break
    case '0':
      if (!pan) return
      resetZoom()
      break
    case ' ':
      // Пробіл на кнопці — це натискання кнопки, а не слайдшоу.
      if (!slideshowAvailable.value || (target instanceof Element && target.closest('button, a'))) return
      toggleSlideshow()
      break
    default:
      return
  }
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  teleportReady.value = true
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (props.modelValue) void handleOpen()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  handleClose()
  clearTimeout(outgoingTimer)
})

const announcement = computed(() => {
  const item = image.value
  return item ? text.value.slide(current.value + 1, count.value, item.alt, slideKindOf(currentKind.value)) : ''
})

/* ------------------------------------------------------------------ */
/*  Класи шаблону                                                      */
/* ------------------------------------------------------------------ */

function panelStyle(panel: Panel) {
  return props.transition === 'fade' ? undefined : { transform: `translate3d(${panel.vpos * 100}%, 0, 0)` }
}

// Схрещення: слайди один на одному, видно лише поточний.
function panelClass(panel: Panel): string {
  if (props.transition !== 'fade') return ''
  return panel.offset === 0
    ? 'opacity-100 transition-opacity duration-(--duration-slow)'
    : 'opacity-0 transition-opacity duration-(--duration-slow)'
}

function imageClass(panel: Panel): string {
  if (stateOf(panel.item) !== 'loaded') return 'opacity-0'
  // Заглушка вже стоїть на тому самому місці — фото підміняє її миттєво,
  // згасання показало б між ними порожній фон. Під час польоту з мініатюри
  // фото теж не згасає: воно вже непрозоре там, звідки летить.
  const instant = (panel.item.thumbnail && panel.item.thumbnail !== panel.item.src) || (zoomEffect.value && panel.offset === 0)
  const appear = instant ? '' : 'ui-lightbox-appear'
  if (panel.offset !== 0) return appear
  const cursor = zoomed.value ? (grabbing.value ? 'cursor-grabbing' : 'cursor-grab') : canZoom.value ? 'cursor-zoom-in' : ''
  return `${appear} ${cursor}`
}

const chromeClass = computed(() => (chromeHidden.value ? 'ui-lightbox-chrome pointer-events-none' : 'ui-lightbox-chrome'))

/*
 * Кнопки поверх фото — кола з поверхнею картки й blur, як стрілки
 * UiCarousel: читаються на будь-якому зображенні й у будь-якій темі.
 * Позиція й display — окремо на кожному місці: `relative`/`absolute` чи
 * `flex`/`hidden` в одному рядку класів вирішував би порядок CSS, а не
 * шаблон.
 */
const chromeButton =
  'h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card/85 text-ink shadow-card backdrop-blur-sm transition-colors hover:bg-card active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ' +
  "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"

defineExpose({
  previous,
  next,
  goTo,
  zoomIn: () => zoomIn(),
  zoomOut: () => zoomOut(),
  resetZoom,
  toggleZoom: () => toggleZoom(),
  rotate,
  flip,
  toggleSlideshow,
  toggleFullscreen,
})
</script>

<template>
  <Teleport to="body" :disabled="!teleportReady">
    <Transition name="ui-lightbox" :duration="transitionDuration" @after-leave="onAfterLeave">
      <div
        v-if="modelValue"
        ref="rootEl"
        data-ui-overlay
        class="fixed inset-0"
        :class="[zoomEffect ? 'ui-lightbox-zoom' : '', closeDragging ? 'ui-lightbox-dragging' : '']"
        :style="{ zIndex: layer.zIndex.value, '--ui-lightbox-chrome': chromeHidden ? 0 : 1 }"
      >
        <!-- Фон — майже чорний в обох темах: фото читається на темному, а
             кнопки й підписи несуть власну поверхню картки. 95%, а не 90:
             при 90 текст сторінки проступав крізь фон і сперечався з фото.
             Сторінку видно, коли фон гасне під змахом для закриття. -->
        <div class="ui-lightbox-backdrop absolute inset-0 bg-backdrop/95" aria-hidden="true" />

        <div
          ref="panelEl"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          :aria-describedby="image ? titleId : undefined"
          tabindex="-1"
          class="ui-lightbox-panel relative flex h-full flex-col outline-none"
          @pointermove="onPanelPointerMove"
          @focusin="onPanelFocusIn"
        >
          <!-- Під час слайдшоу кадри змінюються самі — оголошувати кожен
               означало б говорити без упину (як autoplay у UiCarousel). -->
          <span :id="titleId" class="sr-only" :aria-live="playing ? 'off' : 'polite'">{{ announcement }}</span>

          <div
            v-if="playing && slideshowTicking"
            :key="slideshowCycle"
            class="ui-lightbox-progress pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 h-0.5 bg-accent-solid motion-reduce:hidden"
            :style="{ animationDuration: `${Math.max(1000, interval)}ms` }"
            aria-hidden="true"
          />

          <!-- Верхня панель: лічильник, дії, інструменти, хрестик. Відступи
               з безпечними зонами окремо з кожного боку: у ландшафті
               iPhone виріз камери стоїть збоку, а не згори. -->
          <div
            class="flex shrink-0 items-center gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))]"
            :class="chromeClass"
            data-lightbox-chrome
            @pointerenter="onChromePointer(true)"
            @pointerleave="onChromePointer(false)"
          >
            <span
              v-if="count > 1"
              class="shrink-0 rounded-full border border-line bg-card/85 px-3 py-1.5 text-sm font-medium tabular-nums text-ink shadow-card backdrop-blur-sm"
              aria-hidden="true"
            >
              {{ current + 1 }} / {{ count }}
            </span>

            <div class="ms-auto flex min-w-0 items-center gap-2">
              <!-- Прокрутка, а не перенос: на вузькому телефоні з повним
                   набором інструментів кнопки не мають наповзати на
                   лічильник чи ламати висоту панелі. p-1 — місце для
                   фокус-кільця, яке overflow інакше обрізав би, а
                   scroll-px-1 — той самий відступ, коли фокус докручує
                   кнопку (onStripFocusIn). -->
              <div
                class="scrollbar-none -m-1 flex min-w-0 items-center gap-2 overflow-x-auto p-1 scroll-px-1"
                @focusin="onStripFocusIn"
              >
                <slot v-if="image" name="actions" :image="image" :index="current" />

                <template v-for="tool in toolbarItems" :key="tool">
                  <button
                    v-if="tool === 'zoom'"
                    type="button"
                    class="relative flex"
                    :class="chromeButton"
                    :disabled="!canZoom"
                    :aria-label="zoomed ? text.zoomOut : text.zoomIn"
                    @click="toggleZoom()"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="m20 20-4.2-4.2M8.5 11h5" />
                      <path v-if="!zoomed" d="M11 8.5v5" />
                    </svg>
                  </button>

                  <button
                    v-else-if="tool === 'zoomIn'"
                    type="button"
                    class="relative flex"
                    :class="chromeButton"
                    :disabled="!canZoom || atMaxZoom"
                    :aria-label="text.zoomIn"
                    @click="zoomIn()"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="m20 20-4.2-4.2M8.5 11h5M11 8.5v5" />
                    </svg>
                  </button>

                  <button
                    v-else-if="tool === 'zoomOut'"
                    type="button"
                    class="relative flex"
                    :class="chromeButton"
                    :disabled="!canZoom || !zoomed"
                    :aria-label="text.zoomOut"
                    @click="zoomOut()"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="m20 20-4.2-4.2M8.5 11h5" />
                    </svg>
                  </button>

                  <template v-else-if="tool === 'rotate'">
                    <button type="button" class="relative flex" :class="chromeButton" :disabled="!canTransform" :aria-label="text.rotateLeft" @click="rotate(-1)">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7" />
                        <path d="M4 4.2v4.5h4.5" />
                      </svg>
                    </button>
                    <button type="button" class="relative flex" :class="chromeButton" :disabled="!canTransform" :aria-label="text.rotateRight" @click="rotate(1)">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20 12a8 8 0 1 1-2.35-5.65L20 8.7" />
                        <path d="M20 4.2v4.5h-4.5" />
                      </svg>
                    </button>
                  </template>

                  <template v-else-if="tool === 'flip'">
                    <button type="button" class="relative flex" :class="chromeButton" :disabled="!canTransform" :aria-label="text.flipHorizontal" @click="flip('x')">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 3.5v17" stroke-dasharray="2 2.5" />
                        <path d="M8.5 7 3.5 17h5z" />
                        <path d="M15.5 7l5 10h-5z" />
                      </svg>
                    </button>
                    <button type="button" class="relative flex" :class="chromeButton" :disabled="!canTransform" :aria-label="text.flipVertical" @click="flip('y')">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3.5 12h17" stroke-dasharray="2 2.5" />
                        <path d="M7 8.5 17 3.5v5z" />
                        <path d="M7 15.5l10 5v-5z" />
                      </svg>
                    </button>
                  </template>

                  <button
                    v-else-if="tool === 'slideshow'"
                    type="button"
                    class="relative flex"
                    :class="chromeButton"
                    :disabled="count < 2"
                    :aria-label="playing ? text.slideshowPause : text.slideshowPlay"
                    @click="toggleSlideshow"
                  >
                    <svg v-if="playing" class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 6v12M15 6v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                    </svg>
                    <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z" />
                    </svg>
                  </button>

                  <button
                    v-else-if="tool === 'fullscreen'"
                    type="button"
                    class="relative flex"
                    :class="chromeButton"
                    :aria-label="fullscreen.active.value ? text.fullscreenExit : text.fullscreenEnter"
                    @click="toggleFullscreen"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path v-if="fullscreen.active.value" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                      <path v-else d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                    </svg>
                  </button>

                  <button
                    v-else-if="tool === 'thumbnails'"
                    type="button"
                    class="relative flex"
                    :class="chromeButton"
                    :aria-label="thumbnailsVisible ? text.thumbnailsHide : text.thumbnailsShow"
                    @click="toggleThumbnails"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
                      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
                      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
                      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
                      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
                    </svg>
                  </button>

                  <template v-else-if="tool === 'download'">
                    <!-- target="_blank": атрибут download працює лише для
                         свого домену, і чуже фото інакше відкрилося б
                         замість галереї в тій самій вкладці. -->
                    <a
                      v-if="downloadHref"
                      :href="downloadHref"
                      download
                      target="_blank"
                      rel="noopener"
                      class="relative flex"
                      :class="chromeButton"
                      :aria-label="text.download"
                    >
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
                      </svg>
                    </a>
                    <button v-else type="button" class="relative flex" :class="chromeButton" disabled :aria-label="text.download">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
                      </svg>
                    </button>
                  </template>
                </template>
              </div>

              <button type="button" class="relative flex" :class="chromeButton" :aria-label="text.close" @click="close">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <!--
            Сцена. touch-none: усі жести тут наші — свайп, змах для
            закриття, щипок, зсув збільшеного фото. overflow-clip, а не
            hidden: у hidden-контейнері фокус на елементі сусіднього слайда
            міг би прокрутити сцену й зсунути трек.
          -->
          <div
            ref="stageEl"
            class="relative min-h-0 flex-1 touch-none overflow-clip"
            :class="grabbing ? 'select-none' : ''"
            data-lightbox-backdrop
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @click="onStageClick"
            @wheel="onWheel"
          >
            <div ref="trackEl" class="absolute inset-0" data-lightbox-backdrop>
              <div
                v-for="panel in panels"
                :key="panel.vpos"
                class="absolute inset-0 flex px-2 sm:px-16"
                :class="panelClass(panel)"
                :style="panelStyle(panel)"
                :inert="panel.offset !== 0"
                :aria-hidden="panel.offset !== 0 ? 'true' : undefined"
                data-lightbox-slide
                data-lightbox-backdrop
              >
                <div
                  :ref="(element) => setBoxEl(panel.vpos, element)"
                  class="relative flex h-full w-full min-w-0"
                  :class="panel.kind === 'iframe' || panel.kind === 'youtube' || panel.kind === 'vimeo' ? '[container-type:size]' : ''"
                  data-lightbox-backdrop
                >
                  <template v-if="panel.kind === 'image'">
                    <!-- Заглушка — мініатюра, розтягнута рівно туди, де стане
                         фото: max-розміри з width/height не дають їй вийти
                         за натуральний розмір, як не виходить і саме фото. -->
                    <img
                      v-if="placeholderFor(panel)"
                      :src="placeholderFor(panel) ?? undefined"
                      alt=""
                      aria-hidden="true"
                      draggable="false"
                      class="absolute inset-0 m-auto h-full w-full object-contain"
                      :style="naturalBox(panel.item)"
                    />
                    <img
                      :key="`${panel.item.src}#${retries[panel.item.src] ?? 0}`"
                      :ref="(element) => setImgEl(panel, element)"
                      :src="panel.item.src"
                      :srcset="panel.item.srcset"
                      :sizes="panel.item.srcset ? panel.item.sizes ?? '100vw' : undefined"
                      :alt="panel.item.alt"
                      draggable="false"
                      decoding="async"
                      :fetchpriority="panel.offset === 0 ? 'high' : 'low'"
                      class="relative m-auto block max-h-full max-w-full object-contain"
                      :class="imageClass(panel)"
                      @load="onImageLoad(panel)"
                      @error="markFailed(panel.item)"
                    />
                  </template>

                  <template v-else-if="panel.kind === 'video'">
                    <video
                      v-if="panel.offset === 0"
                      :ref="setVideoEl"
                      :src="panel.item.src"
                      :poster="panel.item.poster"
                      :aria-label="panel.item.alt"
                      controls
                      playsinline
                      preload="metadata"
                      class="relative m-auto block max-h-full max-w-full"
                      @loadeddata="markLoaded(panel.item)"
                      @error="markFailed(panel.item)"
                      @ended="onVideoEnded"
                    />
                    <img
                      v-else-if="posterFor(panel.item, panel.kind)"
                      :src="posterFor(panel.item, panel.kind) ?? undefined"
                      alt=""
                      draggable="false"
                      class="m-auto block max-h-full max-w-full object-contain"
                    />
                  </template>

                  <div v-else-if="panel.kind === 'custom'" class="m-auto max-h-full max-w-full overflow-auto overscroll-contain" data-lightbox-custom>
                    <slot name="custom" :image="panel.item" :index="panel.index" :active="panel.offset === 0" />
                  </div>

                  <template v-else>
                    <!-- Плеєр вбудовується лише для поточного слайда: сусід
                         із YouTube, змонтований заздалегідь, почав би грати
                         за кадром, а зайвий iframe — це ще й чужі cookies. -->
                    <iframe
                      v-if="panel.offset === 0"
                      :src="embedSrc(panel.kind, panel.item.src)"
                      :title="panel.item.alt"
                      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                      referrerpolicy="strict-origin-when-cross-origin"
                      class="relative m-auto block rounded-card border-0 bg-backdrop"
                      :style="frameStyle(panel)"
                      @load="markLoaded(panel.item)"
                    />
                    <img
                      v-else-if="posterFor(panel.item, panel.kind)"
                      :src="posterFor(panel.item, panel.kind) ?? undefined"
                      alt=""
                      draggable="false"
                      class="m-auto block max-h-full max-w-full object-contain"
                    />
                  </template>
                </div>
              </div>
            </div>

            <div
              v-if="image && !currentLoaded && !currentFailed"
              class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <span class="rounded-full border border-line bg-card/85 p-3 shadow-card backdrop-blur-sm">
                <UiSpinner size="lg" tone="accent" :label="text.loading" />
              </span>
            </div>

            <div
              v-if="!image || currentFailed"
              class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
            >
              <div class="pointer-events-auto flex flex-col items-center gap-3 rounded-card border border-line bg-card/90 px-4 py-3 text-sm text-ink shadow-card">
                <p role="alert">{{ image ? text.error : text.empty }}</p>
                <button
                  v-if="image"
                  type="button"
                  class="h-10 rounded-control border border-line bg-card px-3 font-medium text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
                  @click="retry"
                >
                  {{ text.retry }}
                </button>
              </div>
            </div>

            <!-- Стрілки лише від sm: на телефоні основний жест — свайп, а
                 кнопки поверх фото закривали б його край, як у UiCarousel. -->
            <template v-if="count > 1 && !zoomed">
              <button
                type="button"
                :class="[chromeButton, chromeClass]"
                class="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-1/2 z-10 hidden -translate-y-1/2 sm:flex"
                :disabled="atStart"
                :aria-label="text.previous"
                data-lightbox-chrome
                @click="previous"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                :class="[chromeButton, chromeClass]"
                class="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-1/2 z-10 hidden -translate-y-1/2 sm:flex"
                :disabled="atEnd"
                :aria-label="text.next"
                data-lightbox-chrome
                @click="next"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </template>
          </div>

          <div
            v-if="image && ($slots.caption || image.caption)"
            class="flex shrink-0 justify-center px-4 pt-3"
            :class="chromeClass"
            data-lightbox-chrome
          >
            <div class="max-h-[25vh] max-w-2xl overflow-y-auto overscroll-contain rounded-card border border-line bg-card/85 px-3 py-2 text-center text-sm text-ink shadow-card backdrop-blur-sm">
              <slot name="caption" :image="image" :index="current">{{ image.caption }}</slot>
            </div>
          </div>

          <!--
            Стрічка мініатюр: w-fit + mx-auto, а не justify-center на
            контейнері з прокруткою — інакше при переповненні ліві мініатюри
            опиняються за лівим краєм, куди прокрутка вже не дістає.
            scroll-px-4 — той самий відступ від краю, коли Tab докручує
            мініатюру (onStripFocusIn).
          -->
          <div
            v-if="showThumbnails"
            class="shrink-0 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            :class="chromeClass"
            data-lightbox-chrome
            @pointerenter="onChromePointer(true)"
            @pointerleave="onChromePointer(false)"
          >
            <div
              class="scrollbar-none mx-auto flex w-fit max-w-full gap-2 overflow-x-auto px-4 py-1 scroll-px-4"
              role="group"
              :aria-label="text.thumbnails"
              @focusin="onStripFocusIn"
            >
              <button
                v-for="(item, index) in images"
                :key="thumbKeys[index]"
                :ref="(element) => (thumbEls[index] = element as HTMLElement | null)"
                type="button"
                class="relative h-14 w-14 shrink-0 overflow-clip rounded-control border-2 bg-card transition-[border-color,opacity] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-backdrop"
                :class="index === current ? 'border-accent-solid opacity-100' : 'border-transparent opacity-60 hover:opacity-100'"
                :aria-label="text.thumbnail(index + 1, item.alt, slideKindOf(kindAt(index)))"
                :aria-current="index === current ? 'true' : undefined"
                @click="goTo(index)"
              >
                <img
                  v-if="thumbnailFor(item, index)"
                  :src="thumbnailFor(item, index) ?? undefined"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  class="h-full w-full object-cover"
                />
                <span v-else class="flex h-full w-full items-center justify-center text-muted" aria-hidden="true">
                  <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
                    <rect x="3.5" y="5" width="17" height="14" rx="2" />
                    <path d="M3.5 9h17" />
                  </svg>
                </span>
                <!-- Відео в стрічці впізнається за значком «відтворити». -->
                <span
                  v-if="slideKindOf(kindAt(index)) === 'video'"
                  class="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-card/85 text-ink shadow-card">
                    <svg class="ms-0.5 h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 4.5v15l13-7.5z" />
                    </svg>
                  </span>
                </span>
              </button>
            </div>
          </div>
          <div v-else class="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
 * Фон і панелі гаснуть під час змаху для закриття через --ui-lightbox-fade
 * (JS пише її на корінь), а ховаються без руху миші чи дотиком — через
 * --ui-lightbox-chrome (реактивний стиль). Змінні, а не інлайнова opacity:
 * класи входу й виходу нижче мають її перебивати.
 */
.ui-lightbox-backdrop {
  opacity: var(--ui-lightbox-fade, 1);
  transition: opacity var(--duration-base) var(--ease-out);
}

.ui-lightbox-chrome {
  opacity: calc(var(--ui-lightbox-chrome, 1) * var(--ui-lightbox-fade, 1));
  transition: opacity var(--duration-base) var(--ease-out);
}

/* Під пальцем фон гасне синхронно з рухом, без запізнення переходу. */
.ui-lightbox-dragging .ui-lightbox-backdrop,
.ui-lightbox-dragging .ui-lightbox-chrome {
  transition: none;
}

.ui-lightbox-appear {
  animation: ui-lightbox-appear var(--duration-base) var(--ease-out);
}

@keyframes ui-lightbox-appear {
  from {
    opacity: 0;
  }
}

.ui-lightbox-progress {
  transform-origin: left center;
  animation: ui-lightbox-progress linear forwards;
}

@keyframes ui-lightbox-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.ui-lightbox-enter-active .ui-lightbox-backdrop,
.ui-lightbox-leave-active .ui-lightbox-backdrop {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.ui-lightbox-enter-from .ui-lightbox-backdrop,
.ui-lightbox-leave-to .ui-lightbox-backdrop {
  opacity: 0;
}

.ui-lightbox-enter-active .ui-lightbox-panel {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-emphasized);
}

.ui-lightbox-leave-active .ui-lightbox-panel {
  transition:
    opacity var(--duration-base) var(--ease-in),
    transform var(--duration-base) var(--ease-in);
}

.ui-lightbox-enter-from .ui-lightbox-panel,
.ui-lightbox-leave-to .ui-lightbox-panel {
  opacity: 0;
  transform: scale(0.97);
}

/*
 * Політ із мініатюри: фото анімується саме (Web Animations), тож панель
 * не згасає й не стискається разом із ним — гаснуть лише панелі
 * інструментів і фон.
 */
.ui-lightbox-zoom.ui-lightbox-enter-from .ui-lightbox-panel,
.ui-lightbox-zoom.ui-lightbox-leave-to .ui-lightbox-panel {
  opacity: 1;
  transform: none;
}

.ui-lightbox-zoom.ui-lightbox-enter-active .ui-lightbox-chrome,
.ui-lightbox-zoom.ui-lightbox-leave-active .ui-lightbox-chrome {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.ui-lightbox-zoom.ui-lightbox-enter-from .ui-lightbox-chrome,
.ui-lightbox-zoom.ui-lightbox-leave-to .ui-lightbox-chrome {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ui-lightbox-enter-from .ui-lightbox-panel,
  .ui-lightbox-leave-to .ui-lightbox-panel {
    transform: none;
  }
}
</style>
