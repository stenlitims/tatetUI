<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** kebab-basename демо-файла: app/demos/button/ButtonBasic.vue → "button-basic" */
    name: string
    /** Мінімальна висота сцени. Задається для демо, що ростуть — дропдаунів, меню. */
    stage?: string
    /** Прибирає рамку сцени — для демо, які самі малюють картку. */
    bare?: boolean
  }>(),
  { stage: 'min-h-40' },
)

const { components, sources, highlights } = useDemoRegistry()

const loader = components[props.name]

// Падаємо на збірці, а не мовчки малюємо порожню сцену: перейменований
// демо-файл інакше дав би порожню коробку в проді, і ніхто б не помітив.
if (!loader) {
  throw createError({
    statusCode: 500,
    fatal: true,
    statusMessage: `Демо "${props.name}" не знайдено в app/demos/**`,
  })
}

// defineAsyncComponent усередині Suspense-межі, яку дає NuxtPage,
// резолвиться і на сервері — тож у прередереному HTML демо вже присутнє.
const Demo = computed(() => defineAsyncComponent(loader))

const tab = ref<'preview' | 'code'>('preview')
const raw = shallowRef('')
const html = shallowRef('')
const state = ref<'idle' | 'copied' | 'failed'>('idle')

// Виконуємо чанки ?raw і ?raw&shiki лише коли відкрито вкладку «Код».
// Мережею вони можуть приїхати раніше — Nuxt додає на них rel="prefetch" —
// але це idle-пріоритет, а не блокуючий modulepreload.
watch(tab, async (value) => {
  if (value !== 'code' || html.value) return
  const [source, highlighted] = await Promise.all([
    sources[props.name]!(),
    highlights[props.name]!(),
  ])
  raw.value = source
  html.value = highlighted
})

/**
 * Резервний шлях копіювання через прихований <textarea>.
 *
 * navigator.clipboard існує не завжди: його немає на http (не secure
 * context), і він кидає NotAllowedError, коли документ не у фокусі.
 * Без запасного варіанта кнопка в таких умовах просто мовчить, і
 * користувач не розуміє, спрацювало чи ні.
 */
function copyLegacy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  // Поза екраном, але НЕ display:none і не visibility:hidden —
  // прихований елемент не можна виділити, і execCommand поверне false.
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

async function copy() {
  if (!raw.value) raw.value = await sources[props.name]!()

  let ok = false
  try {
    await navigator.clipboard.writeText(raw.value)
    ok = true
  } catch {
    ok = copyLegacy(raw.value)
  }

  state.value = ok ? 'copied' : 'failed'
  setTimeout(() => (state.value = 'idle'), ok ? 1600 : 2600)
}

const copyLabel = computed(() =>
  state.value === 'copied'
    ? 'Скопійовано'
    : state.value === 'failed'
      ? 'Не вдалося — скопіюйте вручну'
      : 'Копіювати',
)

function tabClass(value: 'preview' | 'code') {
  return [
    'relative h-9 px-3 text-sm font-medium transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    tab.value === value
      ? 'text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-accent'
      : 'text-muted hover:text-ink',
  ]
}
</script>

<template>
  <div class="my-6 overflow-hidden rounded-card border border-line bg-card">
    <div class="flex items-center gap-1 border-b border-line px-2">
      <button type="button" :class="tabClass('preview')" @click="tab = 'preview'">Приклад</button>
      <button type="button" :class="tabClass('code')" @click="tab = 'code'">Код</button>

      <button
        v-if="tab === 'code'"
        type="button"
        class="ml-auto h-7 rounded-control border px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="
          state === 'failed'
            ? 'border-danger-line bg-danger-bg text-danger'
            : 'border-line text-muted hover:bg-hover hover:text-ink'
        "
        @click="copy"
      >
        {{ copyLabel }}
      </button>
    </div>

    <div
      v-show="tab === 'preview'"
      class="flex flex-wrap items-center justify-center gap-4 px-4 py-8 sm:p-8"
      :class="[stage, bare ? '' : 'preview-stage bg-main']"
    >
      <component :is="Demo" />
    </div>

    <div v-show="tab === 'code'" class="preview-code max-h-[28rem] overflow-auto scrollbar-thin">
      <!-- HTML згенеровано Shiki в Node на етапі збірки; джерело — той самий
           .vue-файл, який рендериться у вкладці «Приклад». -->
      <div v-if="html" v-html="html" />
      <div v-else class="p-4 text-sm text-muted">Завантаження…</div>
    </div>
  </div>
</template>

<!--
  Блок НЕ scoped навмисно.

  v-html вставляє вузли без data-v-атрибута, тож у scoped-стилях до них
  можна дістатись лише через :deep(). Але `:global(.dark) … :deep(…)` —
  тобто :global як ПРЕФІКС селектора, який далі містить :deep — компілятор
  Vue мовчки викидає: у зібраному CSS лишається саме світле правило, і
  підсвітка в темній темі назавжди застигає світлою. Перевірено на зібраній
  сторінці: у styleSheets був лише варіант з --shiki-light.

  Область дії тримає сам клас .preview-code.
-->
<style>
/*
  Сцена демо — точкова сітка на тлі сторінки. Компонент на ній читається
  як об'єкт на поверхні, а не як частина тексту документа, і межі
  прозорих елементів (ghost-кнопки, розділювачі) стає видно.
*/
.preview-stage {
  background-image: radial-gradient(
    color-mix(in oklab, var(--ink) 10%, transparent) 1px,
    transparent 1px
  );
  background-size: 16px 16px;
}

/*
  Плагін віддає підсвітку з defaultColor: false — кольори лежать в
  інлайнових --shiki-light / --shiki-dark на кожному span, а тему
  перемикає клас .dark на <html>. Без другої копії HTML і без повторного
  рендеру.
*/
.preview-code .shiki {
  margin: 0;
  padding: 1rem 1.15rem;
  background-color: var(--bg-subtle);
  font-family: ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  tab-size: 2;
}

.preview-code .shiki,
.preview-code .shiki span {
  color: var(--shiki-light);
}

.dark .preview-code .shiki,
.dark .preview-code .shiki span {
  color: var(--shiki-dark);
}

/*
  Гасимо тло на КОЖНОМУ span — інакше рядки коду стають смужками.

  Механіка рівно така. @nuxt/content додає на сторінку глобальні правила
  для СВОЇХ блоків: `html.dark .shiki span { background: var(--shiki-dark-bg) }`.
  Наш плагін віддає розмітку з тим самим класом `shiki`, тож правило
  чіпляється й до неї — але саме по собі воно нешкідливе: у блоків Content
  ця змінна не визначена, і властивість лишається порожньою.

  Ламає все те, що Shiki кладе `--shiki-dark-bg` ІНЛАЙНОМ на наш `<pre>`.
  Змінна успадковується в кожен вкладений span, глобальне правило її
  підхоплює, і кожен `span.line` (а ми робимо їх display:block) дістає
  власне тло #24292e поверх тла самого `pre`. Візуально — десяток окремих
  коробок замість суцільного блоку, з видимим інтерлін'яжем у проміжках.

  Тло має задавати лише `pre`.
*/
.preview-code .shiki span,
.dark .preview-code .shiki span {
  background: transparent;
}

/*
  Рядок = блок. Оголошуємо самі, а не покладаємось на глобальне
  `pre code .line { display: block }` від @nuxt/content: воно є лише тому,
  що Content малює власні блоки коду, і зникне разом із ним.

  min-height обов'язковий: порожній рядок вихідного коду не має вмісту,
  тож його блок мав би нульову висоту і порожні рядки просто зникали б.
*/
.preview-code .shiki .line {
  display: block;
  min-height: 1.6em;
}
</style>
