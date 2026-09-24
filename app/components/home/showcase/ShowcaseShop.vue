<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import UiAccordion from '~/components/ui/UiAccordion.vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiBreadcrumb from '~/components/ui/UiBreadcrumb.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCarousel from '~/components/ui/UiCarousel.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiFormField from '~/components/ui/UiFormField.vue'
import UiIndicator from '~/components/ui/UiIndicator.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiLightbox, { type LightboxImage } from '~/components/ui/UiLightbox.vue'
import UiNumberInput from '~/components/ui/UiNumberInput.vue'
import UiRating from '~/components/ui/UiRating.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import { useToast } from '~/composables/useToast'

defineSlots<Record<string, never>>()

const toast = useToast()

/* ------------------------------------------------------------------ */
/*  Товар і галерея                                                    */
/* ------------------------------------------------------------------ */

type Glaze = 'terracotta' | 'cobalt'

const GALLERY: Record<Glaze, LightboxImage[]> = {
  terracotta: [
    { src: '/demo/vase-terracotta.svg', alt: 'Ваза з червоної глини, вигляд спереду', caption: 'Ваза «Теракота» — червона глина, 32 см' },
    { src: '/demo/vase-terracotta-detail.svg', alt: 'Крупний план поливи й пояска вази', caption: 'Прозора полива лише на пояску — решта матова' },
    { src: '/demo/plate-speckled.svg', alt: 'Тарілка з рябою поливою з тієї ж колекції', caption: 'Пасує до тарілок колекції «Ряба»' },
  ],
  cobalt: [
    { src: '/demo/vase-cobalt.svg', alt: 'Висока ваза під кобальтовою поливою', caption: 'Ваза «Кобальт» — кам’яна маса, 34 см' },
    { src: '/demo/vase-cobalt-detail.svg', alt: 'Крупний план кобальтової поливи з білим крапом', caption: 'Білий крап — окиси в поливі, кожна ваза унікальна' },
    { src: '/demo/plate-speckled.svg', alt: 'Тарілка з рябою поливою з тієї ж колекції', caption: 'Пасує до тарілок колекції «Ряба»' },
  ],
}

const glaze = shallowRef<string | number>('terracotta')
const images = computed(() => GALLERY[glaze.value as Glaze])
const slide = shallowRef(0)
const lightboxOpen = shallowRef(false)

// Нова полива — нова галерея: лишатися на третьому кадрі чужої вази дивно.
watch(glaze, () => {
  slide.value = 0
})

function zoom(index: number) {
  slide.value = index
  lightboxOpen.value = true
}

const PRICES: Record<Glaze, { price: number; old: number; stock: number }> = {
  terracotta: { price: 1450, old: 1700, stock: 12 },
  cobalt: { price: 1890, old: 1890, stock: 3 },
}
/*
 * Колір зразка — дані товару (як і фото), а не колір інтерфейсу, тож тут
 * справжній hex поливи, а не токен теми: теракота не мусить бути «warning».
 */
const SWATCH: Record<Glaze, string> = { terracotta: '#c8643c', cobalt: '#2a5582' }

const offer = computed(() => PRICES[glaze.value as Glaze])
const discount = computed(() => Math.round((1 - offer.value.price / offer.value.old) * 100))
const money = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

/* ------------------------------------------------------------------ */
/*  Кошик                                                              */
/* ------------------------------------------------------------------ */

const quantity = shallowRef<number | null>(1)
const cartCount = shallowRef(0)
const adding = shallowRef(false)
const favorite = shallowRef(false)

watch(offer, (next) => {
  if ((quantity.value ?? 1) > next.stock) quantity.value = next.stock
})

let cartTimer: ReturnType<typeof setTimeout> | undefined

function addToCart() {
  const count = quantity.value ?? 1
  adding.value = true
  cartTimer = setTimeout(() => {
    adding.value = false
    cartCount.value += count
    toast.success(`${count} × «${glaze.value === 'cobalt' ? 'Кобальт' : 'Теракота'}» у кошику`, {
      title: 'Додано в кошик',
      actions: [{ label: 'Оформити', onClick: () => toast.info('Демо: тут було б оформлення замовлення') }],
      duration: 5000,
    })
  }, 700)
}

onBeforeUnmount(() => clearTimeout(cartTimer))

function toggleFavorite() {
  favorite.value = !favorite.value
  toast.info(favorite.value ? 'Додано в обране' : 'Прибрано з обраного')
}

/* ------------------------------------------------------------------ */
/*  Відгуки                                                            */
/* ------------------------------------------------------------------ */

interface Review {
  id: number
  author: string
  rating: number
  text: string
  date: string
}

const reviews = ref<Review[]>([
  { id: 1, author: 'Марія Шевчук', rating: 5, text: 'Жива фактура, у руках ще краща, ніж на фото. Запакували дуже ретельно.', date: '18 вересня' },
  { id: 2, author: 'Андрій Лисенко', rating: 4, text: 'Гарна ваза, але трохи нижча, ніж я уявляв. Колір — точно як на фото.', date: '2 вересня' },
])

const distribution = [
  { stars: 5, share: 84 },
  { stars: 4, share: 11 },
  { stars: 3, share: 3 },
  { stars: 2, share: 1 },
  { stars: 1, share: 1 },
]

const myRating = shallowRef<number | null>(null)
const myText = shallowRef('')
const submitted = shallowRef(false)
const ratingError = computed(() => (submitted.value && !myRating.value ? 'Поставте оцінку від 1 до 5' : undefined))
const posted = shallowRef(false)

function postReview() {
  submitted.value = true
  if (!myRating.value) return
  reviews.value.unshift({
    id: Date.now(),
    author: 'Ви',
    rating: myRating.value,
    text: myText.value.trim() || 'Без коментаря',
    date: 'щойно',
  })
  myRating.value = null
  myText.value = ''
  submitted.value = false
  posted.value = true
}

const accordionItems = [
  { id: 'about', label: 'Опис' },
  { id: 'care', label: 'Розміри й догляд' },
  { id: 'delivery', label: 'Доставка й повернення' },
]
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6">
    <!-- Шапка магазину всередині вікна: пошук і кошик з лічильником. -->
    <div class="flex items-center gap-3 border-b border-line pb-4">
      <span class="hidden text-lg font-semibold tracking-tight text-ink sm:block">Глина</span>
      <UiInput class="min-w-0 flex-1 sm:max-w-sm" placeholder="Пошук у каталозі…" aria-label="Пошук у каталозі" size="sm" type="search">
        <template #leading>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </template>
      </UiInput>
      <div class="ml-auto flex items-center gap-1.5">
        <UiButton variant="ghost" size="icon" :label="favorite ? 'Обране: 1 товар' : 'Обране'" @click="toggleFavorite">
          <svg class="h-5 w-5" viewBox="0 0 24 24" :fill="favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20s-7-4.35-9.33-8.5C1.1 8.73 2.9 5 6.5 5c2 0 3.5 1.2 4.5 2.6C12 6.2 13.5 5 15.5 5c3.6 0 5.4 3.73 3.83 6.5C19 15.65 12 20 12 20z" />
          </svg>
        </UiButton>
        <UiIndicator :count="cartCount" tone="accent">
          <UiButton variant="outline" size="icon" :label="cartCount ? `Кошик: ${cartCount} шт.` : 'Кошик порожній'" @click="toast.info(cartCount ? `У кошику ${cartCount} шт.` : 'Кошик порожній')">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 7h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.6L5 4H2" />
              <circle cx="9.5" cy="20.5" r="1" />
              <circle cx="17.5" cy="20.5" r="1" />
            </svg>
          </UiButton>
        </UiIndicator>
      </div>
    </div>

    <UiBreadcrumb :items="[{ label: 'Кераміка' }, { label: 'Вази' }, { label: 'Ваза ручної роботи' }]" aria-label="Шлях до товару" />

    <div class="grid gap-8 lg:grid-cols-2">
      <!-- Галерея -->
      <!-- Галерея липне, поки прокручується довша колонка покупки: фото
           лишається перед очима, коли людина читає опис і відгуки. -->
      <div class="min-w-0 space-y-3 lg:sticky lg:top-20 lg:self-start">
        <UiCarousel v-model="slide" :items="images" aria-label="Фото товару">
          <template #slide="{ item, index }">
            <button
              type="button"
              class="block w-full cursor-zoom-in overflow-hidden rounded-overlay bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              :aria-label="`Збільшити фото ${index + 1}: ${item.alt}`"
              @click="zoom(index)"
            >
              <img :src="item.src" :alt="item.alt" class="aspect-[4/3] w-full object-cover" draggable="false" />
            </button>
          </template>
        </UiCarousel>
        <div class="grid grid-cols-3 gap-2" role="group" aria-label="Мініатюри фото">
          <button
            v-for="(image, index) in images"
            :key="image.src"
            type="button"
            class="overflow-hidden rounded-card border-2 transition-[border-color,opacity] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
            :class="index === slide ? 'border-accent-solid' : 'border-transparent opacity-70 hover:opacity-100'"
            :aria-label="`Фото ${index + 1}: ${image.alt}`"
            :aria-current="index === slide ? 'true' : undefined"
            @click="slide = index"
          >
            <img :src="image.src" alt="" class="aspect-[4/3] w-full object-cover" />
          </button>
        </div>
      </div>

      <!-- Покупка -->
      <div class="min-w-0 space-y-5">
        <div class="flex flex-wrap gap-2">
          <UiChip tone="accent" size="sm">Ручна робота</UiChip>
          <UiChip :tone="offer.stock > 5 ? 'success' : 'warning'" dot size="sm">
            {{ offer.stock > 5 ? `В наявності · ${offer.stock} шт.` : `Залишилось ${offer.stock} шт.` }}
          </UiChip>
        </div>

        <div class="space-y-2">
          <h3 class="text-2xl font-semibold tracking-tight text-ink">
            Ваза «{{ glaze === 'cobalt' ? 'Кобальт' : 'Теракота' }}»
          </h3>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <UiRating :model-value="4.8" readonly show-value :count="128" />
            <a href="#shop-reviews" class="rounded-control text-sm text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">Читати відгуки</a>
          </div>
        </div>

        <div class="flex flex-wrap items-baseline gap-3">
          <span class="text-3xl font-semibold tabular-nums tracking-tight text-ink">₴{{ money.format(offer.price) }}</span>
          <template v-if="discount > 0">
            <span class="text-base tabular-nums text-muted line-through">₴{{ money.format(offer.old) }}</span>
            <UiChip tone="danger" size="sm">−{{ discount }}%</UiChip>
          </template>
        </div>

        <UiFormField :label="`Полива: ${glaze === 'cobalt' ? 'кобальт' : 'теракота'}`" as="fieldset">
          <template #default="{ labelId }">
            <UiToggleGroup
              v-model="glaze"
              :aria-labelledby="labelId"
              :options="[
                { value: 'terracotta', label: 'Теракота' },
                { value: 'cobalt', label: 'Кобальт' },
              ]"
            >
              <template #option="{ option }">
                <span
                  class="h-3 w-3 rounded-full ring-1 ring-line-strong"
                  :style="{ backgroundColor: SWATCH[option.value as Glaze] }"
                  aria-hidden="true"
                />
                {{ option.label }}
              </template>
            </UiToggleGroup>
          </template>
        </UiFormField>

        <div class="flex flex-wrap items-end gap-3">
          <UiNumberInput v-model="quantity" label="Кількість" :min="1" :max="offer.stock" class="w-36" />
          <UiButton size="lg" class="min-w-44 flex-1 sm:flex-none" :loading="adding" @click="addToCart">
            Додати в кошик
          </UiButton>
          <UiButton
            size="lg"
            variant="outline"
            :label="favorite ? 'Прибрати з обраного' : 'Додати в обране'"
            :aria-pressed="favorite"
            @click="toggleFavorite"
          >
            <svg class="h-5 w-5" :class="favorite ? 'text-danger' : ''" viewBox="0 0 24 24" :fill="favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20s-7-4.35-9.33-8.5C1.1 8.73 2.9 5 6.5 5c2 0 3.5 1.2 4.5 2.6C12 6.2 13.5 5 15.5 5c3.6 0 5.4 3.73 3.83 6.5C19 15.65 12 20 12 20z" />
            </svg>
          </UiButton>
        </div>

        <ul class="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li class="flex items-center gap-2">
            <svg class="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
              <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
            </svg>
            Нова пошта — 1–2 дні
          </li>
          <li class="flex items-center gap-2">
            <svg class="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Повернення 14 днів
          </li>
        </ul>

        <UiAccordion :items="accordionItems" :default-open="['about']" single>
          <template #content-about>
            <p class="text-sm leading-relaxed text-muted">
              Формується вручну на гончарному колі й випалюється двічі. Полива —
              лише на пояску, решта поверхні матова: так видно фактуру глини.
            </p>
          </template>
          <template #content-care>
            <p class="text-sm leading-relaxed text-muted">
              Висота 32 см, діаметр горла 8 см. Тримає воду. Мити вручну, без
              абразивів; не для посудомийки.
            </p>
          </template>
          <template #content-delivery>
            <p class="text-sm leading-relaxed text-muted">
              Пакуємо в гофрокартон і повітряно-бульбашкову плівку. Якщо ваза
              прийшла пошкодженою — замінимо за наш рахунок.
            </p>
          </template>
        </UiAccordion>
      </div>
    </div>

    <!-- Відгуки -->
    <section id="shop-reviews" class="scroll-mt-24 border-t border-line pt-6" aria-labelledby="shop-reviews-title">
      <h4 id="shop-reviews-title" class="text-lg font-semibold tracking-tight text-ink">Відгуки</h4>
      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <span class="text-4xl font-semibold tabular-nums tracking-tight text-ink">4,8</span>
            <div>
              <UiRating :model-value="4.8" readonly />
              <p class="text-xs text-muted">128 відгуків</p>
            </div>
          </div>
          <!-- Розподіл — дані, а не прогрес: смуги декоративні, числа — текстом. -->
          <ul class="space-y-1.5">
            <li v-for="row in distribution" :key="row.stars" class="flex items-center gap-2 text-xs text-muted">
              <span class="w-3 tabular-nums">{{ row.stars }}</span>
              <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span class="block h-full rounded-full bg-rating" :style="{ width: `${row.share}%` }" />
              </span>
              <span class="w-8 text-right tabular-nums">{{ row.share }}%</span>
            </li>
          </ul>
        </div>

        <div class="min-w-0 space-y-4">
          <form class="space-y-3 rounded-card border border-line bg-subtle p-4" novalidate @submit.prevent="postReview">
            <UiRating
              v-model="myRating"
              label="Ваша оцінка"
              required
              :labels="['Жахливо', 'Погано', 'Нормально', 'Добре', 'Чудово']"
              :error="ratingError"
            />
            <UiTextarea v-model="myText" label="Коментар" placeholder="Що сподобалось, що ні?" :rows="2" autoresize :max-length="400" show-count />
            <div class="flex justify-end">
              <UiButton type="submit">Надіслати відгук</UiButton>
            </div>
          </form>

          <UiAlert v-if="posted" tone="success" title="Дякуємо за відгук" dismissible @dismiss="posted = false">
            Він з'явиться для інших покупців після модерації — зазвичай за годину.
          </UiAlert>

          <ul class="divide-y divide-line">
            <li v-for="review in reviews" :key="review.id" class="flex gap-3 py-4 first:pt-0">
              <UiAvatar :name="review.author" :size="36" :tone="review.author === 'Ви' ? 'neutral' : 'primary'" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-sm font-medium text-ink">{{ review.author }}</span>
                  <UiRating :model-value="review.rating" readonly size="sm" />
                  <span class="text-xs text-muted">{{ review.date }}</span>
                </div>
                <p class="mt-1 text-sm leading-relaxed text-ink">{{ review.text }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <UiLightbox v-model="lightboxOpen" v-model:index="slide" :images="images" />
  </div>
</template>
