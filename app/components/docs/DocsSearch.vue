<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import UiModal from '~/components/ui/UiModal.vue'
import { useDocsSearch, type SearchHit } from '~/composables/useDocsSearch'

const router = useRouter()
const { isOpen, isReady, error, open, retry, close, search } = useDocsSearch()

const query = ref('')
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const listboxId = useId()
const optionId = (index: number) => `${listboxId}-option-${index}`

const hits = computed<SearchHit[]>(() => (isReady.value ? search(query.value) : []))

/*
 * Оголошення кількості знайденого. Візуально список видно, але для
 * скрінрідера натискання ↓ не змінює нічого: фокус лишається в полі, а
 * «активність» рядка — це лише клас. aria-live закриває саме цю прогалину.
 */
const resultsAnnouncement = computed(() => {
  if (error.value) return error.value
  if (query.value.length < 2) return ''
  if (!hits.value.length) return 'Нічого не знайдено'
  return `Знайдено результатів: ${hits.value.length}`
})

watch(hits, () => (activeIndex.value = 0))

watch(isOpen, async (value) => {
  if (!value) {
    query.value = ''
    return
  }
  await nextTick()
  inputEl.value?.focus()
})

/*
 * Активний рядок мусить лишатися видимим.
 *
 * Список обмежений max-h-[60vh] і прокручується, а стрілки рухають лише
 * індекс. На низькому екрані підсвічений результат їхав за межі списку, і
 * далі користувач гортав наосліп.
 */
watch(activeIndex, async () => {
  await nextTick()
  listEl.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
    block: 'nearest',
  })
})

function go(hit: SearchHit) {
  close()
  void router.push(hit.route)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % Math.max(hits.value.length, 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + hits.value.length) % Math.max(hits.value.length, 1)
  } else if (event.key === 'Enter') {
    const hit = hits.value[activeIndex.value]
    if (hit) go(hit)
  }
}

/*
 * Ctrl/Cmd+K. Перевіряємо ОБИДВІ клавіші: metaKey на macOS, ctrlKey скрізь
 * інде. preventDefault обов'язковий — у Firefox Ctrl+K фокусує рядок
 * пошуку браузера, і без перехоплення модалка відкривалася б поверх уже
 * відфокусованого адресного рядка.
 *
 * Коли фокус у полі вводу — хоткей НЕ перехоплюємо. Та сама умова стоїть
 * в UiCommandPalette, і без неї сайт відбирав Ctrl+K у кожного демо з
 * полем: на сторінках Input, Combobox, MultiSelect і RichTextEditor
 * замість роботи з текстом відкривався пошук по документації.
 */
function onGlobalKeydown(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey)) return
  /*
   * key, а для нелатинських розкладок — code. На українській розкладці та
   * сама клавіша дає key 'л', і хоткей просто не працював для основної
   * аудиторії сайту. Лише code теж не можна: у Dvorak клавіша з літерою K
   * стоїть деінде. Та сама умова, що в UiCommandPalette.
   */
  const key = event.key.toLowerCase()
  if (key !== 'k' && !(event.code === 'KeyK' && !/^[a-z]$/.test(key))) return

  const active = document.activeElement
  if (
    active instanceof HTMLElement &&
    (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
  ) {
    return
  }

  event.preventDefault()
  void open()
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <div>
    <button
      type="button"
      class="relative flex h-9 items-center gap-2 rounded-control border border-line px-2.5 text-sm text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:h-12 pointer-coarse:after:w-12 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"
      @click="open()"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span class="hidden sm:inline">Пошук</span>
      <kbd
        class="hidden rounded border border-line px-1 font-mono text-[10px] text-muted sm:inline"
      >
        Ctrl K
      </kbd>
    </button>

    <!--
      closable лишається типовим (true), і це не косметика.

      З :closable="false" UiModal вимикав УСІ шляхи виходу одразу:
      requestClose() виходив на першому ж рядку для будь-якої причини,
      Escape не спрацьовував, хрестик не рендерився. А useFocusTrap робив
      решту сторінки inert. Відкривши пошук, користувач міг вийти з нього
      лише переходом на знайдену сторінку або перезавантаженням вкладки.
    -->
    <UiModal
      :model-value="isOpen"
      size="md"
      no-padding
      close-on-backdrop
      initial-focus="input"
      aria-label="Пошук по документації"
      @update:model-value="!$event && close()"
    >
      <template #header>
        <input
          ref="inputEl"
          v-model="query"
          type="search"
          role="combobox"
          :aria-expanded="hits.length > 0"
          :aria-controls="listboxId"
          aria-autocomplete="list"
          :aria-activedescendant="hits.length ? optionId(activeIndex) : undefined"
          placeholder="Пошук по документації…"
          class="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-label="Пошук по документації"
          @keydown="onKeydown"
        />
      </template>

      <div ref="listEl" class="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
        <div v-if="error" class="px-3 py-6 text-center">
          <p class="text-sm text-danger">{{ error }}</p>
          <button
            type="button"
            class="mt-3 rounded-control border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="retry()"
          >
            Спробувати ще раз
          </button>
        </div>
        <p v-else-if="query.length < 2" class="px-3 py-6 text-center text-sm text-muted">
          Введіть щонайменше дві літери.
        </p>
        <p v-else-if="!hits.length" class="px-3 py-6 text-center text-sm text-muted">
          Нічого не знайдено.
        </p>
        <ul v-else :id="listboxId" role="listbox" aria-label="Результати пошуку" class="space-y-0.5">
          <li
            v-for="(hit, index) in hits"
            :id="optionId(index)"
            :key="hit.route"
            role="option"
            :aria-selected="index === activeIndex"
            :data-active="index === activeIndex"
            class="cursor-pointer rounded-control px-3 py-2.5 transition-colors md:py-2"
            :class="index === activeIndex ? 'bg-primary-50 text-accent' : 'hover:bg-hover'"
            @click="go(hit)"
            @mouseenter="activeIndex = index"
          >
            <span class="block text-sm font-medium">{{ hit.title }}</span>
            <span v-if="hit.breadcrumb" class="block text-xs text-muted">{{ hit.breadcrumb }}</span>
            <span v-if="hit.snippet" class="mt-0.5 block truncate text-xs text-muted">
              {{ hit.snippet }}
            </span>
          </li>
        </ul>
      </div>

      <div class="sr-only" role="status" aria-live="polite">{{ resultsAnnouncement }}</div>
    </UiModal>
  </div>
</template>
