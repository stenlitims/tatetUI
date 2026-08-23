<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import UiModal from '~/components/ui/UiModal.vue'
import { useDocsSearch, type SearchHit } from '~/composables/useDocsSearch'

const router = useRouter()
const { isOpen, isReady, open, close, search } = useDocsSearch()

const query = ref('')
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const hits = computed<SearchHit[]>(() => (isReady.value ? search(query.value) : []))

watch(hits, () => (activeIndex.value = 0))

watch(isOpen, async (value) => {
  if (!value) {
    query.value = ''
    return
  }
  await nextTick()
  inputEl.value?.focus()
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
 */
function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void open()
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <div>
    <button
      type="button"
      class="flex h-9 items-center gap-2 rounded-control border border-line px-2.5 text-sm text-muted transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

    <UiModal
      :model-value="isOpen"
      size="md"
      no-padding
      :closable="false"
      initial-focus="input"
      @update:model-value="!$event && close()"
    >
      <template #header>
        <input
          ref="inputEl"
          v-model="query"
          type="search"
          placeholder="Пошук по документації…"
          class="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
          aria-label="Пошук по документації"
          @keydown="onKeydown"
        />
      </template>

      <div class="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
        <p v-if="query.length < 2" class="px-3 py-6 text-center text-sm text-muted">
          Введіть щонайменше дві літери.
        </p>
        <p v-else-if="!hits.length" class="px-3 py-6 text-center text-sm text-muted">
          Нічого не знайдено.
        </p>
        <ul v-else class="space-y-0.5">
          <li v-for="(hit, index) in hits" :key="hit.route">
            <button
              type="button"
              class="w-full rounded-control px-3 py-2 text-left transition-colors focus:outline-none"
              :class="index === activeIndex ? 'bg-primary-50 text-accent' : 'hover:bg-hover'"
              @click="go(hit)"
              @mouseenter="activeIndex = index"
            >
              <span class="block text-sm font-medium">{{ hit.title }}</span>
              <span v-if="hit.breadcrumb" class="block text-xs text-muted">{{ hit.breadcrumb }}</span>
              <span v-if="hit.snippet" class="mt-0.5 block truncate text-xs text-muted">
                {{ hit.snippet }}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </UiModal>
  </div>
</template>
