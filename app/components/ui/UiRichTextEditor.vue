<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Typography from '@tiptap/extension-typography'
import RteToolbar from './rich-text-editor/RteToolbar.vue'
import { provideRteLabels, type RteLabels } from './rich-text-editor/labels'

/**
 * Редактор форматованого тексту на TipTap.
 *
 * ЄДИНИЙ компонент бібліотеки із зовнішніми залежностями. Перелік пакетів
 * і причину винятку описано на сторінці /docs/components/rich-text-editor.
 * ProseMirror переписати неможливо, а редактор без нього — не редактор.
 *
 * Корінь ProseMirror несе клас `ui-prose` — той самий, що й UiProse. Саме
 * тому написане в редакторі виглядає на публічній сторінці точно так само.
 */

const props = withDefaults(
  defineProps<{
    /** HTML-рядок. Використовуйте через `v-model`. */
    modelValue?: string | null
    /**
     * Набір можливостей.
     * `simple` — лише текст, списки й заголовки; без таблиць і зображень.
     */
    mode?: 'simple' | 'full'
    placeholder?: string
    /** Тільки читання, але з можливістю виділяти й копіювати. */
    readonly?: boolean
    disabled?: boolean
    /**
     * Ліміт символів. Ввід понад ліміт відхиляється самим редактором, а не
     * підсвічується постфактум.
     */
    maxChars?: number
    /** Мінімальна висота поля, напр. `"12rem"`. */
    minHeight?: string
    /**
     * Перекриття підписів. Задавайте лише ключі, що змінюються.
     *
     * У проєкті з i18n це один виклик замість 152: передайте об'єкт із
     * `t()`, і зміна мови оновить підписи без перемонтування редактора.
     */
    labels?: Partial<RteLabels>
    /** Доступна назва області редагування. */
    ariaLabel?: string
  }>(),
  {
    mode: 'full',
    minHeight: '10rem',
    placeholder: 'Почніть писати…',
    ariaLabel: 'Редактор тексту',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: []
  blur: []
}>()

defineSlots<{
  /** Панель інструментів. Поки не задано — рендериться типова. */
  toolbar?: (props: { editor: unknown; editable: boolean }) => unknown
}>()

const isEditable = computed(() => !props.readonly && !props.disabled)

/*
 * Лічильник транзакцій — явна залежність для всього, що читає СТАН
 * редактора: кількість символів, активність кнопок тулбара.
 *
 * `editor.storage` і `editor.isActive()` — звичайні об'єкти й методи, а не
 * реактивні джерела. Computed, що читає лише їх, не має від чого
 * перерахуватись і застигає назавжди. Виміряно на зібраній сторінці:
 * текст у полі змінювався, а лічильник показував 164/600 і не рухався.
 *
 * Власна реактивність @tiptap/vue-3 тут не рятує — вона дебаунсена через
 * два вкладені requestAnimationFrame, тож у невидимій вкладці не спрацьовує
 * взагалі. Це той самий клас артефакту, що вже описаний у CLAUDE.md
 * для <Transition>.
 */
const uiTick = ref(0)

provideRteLabels(() => props.labels)

/*
 * ClientOnly тут НЕ потрібен, і це перевірено, а не припущено.
 *
 * useEditor створює Editor усередині onMounted, а EditorContent на сервері
 * рендерить порожній <div>. Тобто надісланий HTML і перший клієнтський
 * рендер збігаються — гідрація чиста. Обгортка в ClientOnly не лише зайва,
 * а й шкідлива: це специфіка Nuxt, а бібліотеку копіюють і у Vite-проєкти.
 */
const editor = useEditor({
  content: props.modelValue ?? '',
  editable: isEditable.value,
  extensions: [
    StarterKit.configure({
      // Посилання вимикаємо тут і додамо окремо з власними rel/target —
      // типові налаштування StarterKit для публічного вмісту небезпечні.
      link: false,
    }),
    Placeholder.configure({ placeholder: () => props.placeholder }),
    // Typography: друкарські лапки й тире прямо під час набору.
    Typography,
    ...(props.maxChars ? [CharacterCount.configure({ limit: props.maxChars })] : []),
    // Повний режим: вирівнювання, кольори, індекси. У simple їх немає не
    // заради ваги бандла — розширення однаково в ньому, — а щоб тулбар
    // короткого поля не виглядав як панель текстового процесора.
    ...(props.mode === 'full'
      ? [
          TextAlign.configure({ types: ['heading', 'paragraph'] }),
          TextStyle,
          Color,
          Highlight.configure({ multicolor: true }),
          Subscript,
          Superscript,
        ]
      : []),
  ],
  editorProps: {
    attributes: {
      /*
       * Той самий клас, що й у UiProse. Це і є контракт WYSIWYG: якщо
       * оформлення жило б у scoped-стилях редактора, публічній сторінці
       * довелося б мати власну копію — і копії розійшлися б за тиждень.
       */
      class: 'ui-prose focus:outline-none',
      'aria-label': props.ariaLabel,
      'aria-readonly': String(!!props.readonly),
      'aria-disabled': String(!!props.disabled),
    },
  },
  onUpdate: ({ editor: instance }) => emit('update:modelValue', instance.getHTML()),
  // transaction, а не update: update не спрацьовує на зміну лише виділення,
  // а стан кнопок тулбара від нього залежить.
  onTransaction: () => (uiTick.value += 1),
  onFocus: () => emit('focus'),
  onBlur: () => emit('blur'),
})

/*
 * Зовнішня зміна значення. Порівняння з поточним HTML обов'язкове: без
 * нього кожне emit('update:modelValue') поверталося б назад через props і
 * викликало setContent, збиваючи позицію курсора на кожному натисканні.
 */
watch(
  () => props.modelValue,
  (value) => {
    const instance = editor.value
    if (!instance) return
    const next = value ?? ''
    if (next === instance.getHTML()) return
    instance.commands.setContent(next, { emitUpdate: false })
  },
)

watch(isEditable, (value) => editor.value?.setEditable(value))

watch(
  [() => props.ariaLabel, () => props.readonly, () => props.disabled],
  () => {
    const root = editor.value?.view.dom
    if (!root) return
    root.setAttribute('aria-label', props.ariaLabel)
    root.setAttribute('aria-readonly', String(!!props.readonly))
    root.setAttribute('aria-disabled', String(!!props.disabled))
  },
)

const charCount = computed(() => {
  // Читаємо uiTick першим: саме він робить цей computed залежним від
  // транзакцій редактора.
  void uiTick.value
  const instance = editor.value
  if (!instance || !props.maxChars) return null
  return (instance.storage.characterCount as { characters?: () => number } | undefined)
    ?.characters?.() ?? 0
})

onBeforeUnmount(() => editor.value?.destroy())

defineExpose({
  /** Інстанс TipTap. Знадобиться для власних команд і розширень. */
  editor,
  /** Ставить фокус у поле вводу. */
  focus: () => editor.value?.commands.focus(),
})
</script>

<template>
  <div
    class="overflow-hidden rounded-card border bg-card transition-colors"
    :class="disabled ? 'opacity-50' : 'border-line focus-within:border-accent-solid'"
  >
    <slot name="toolbar" :editor="editor" :editable="isEditable">
      <RteToolbar :editor="editor" :tick="uiTick" :mode="mode" :disabled="!isEditable" />
    </slot>

    <div class="scrollbar-thin overflow-y-auto px-4 py-3" :style="{ minHeight }">
      <EditorContent :editor="editor" />
    </div>

    <div
      v-if="maxChars"
      class="flex justify-end border-t border-line bg-subtle px-3 py-1.5 text-xs"
      :class="charCount === maxChars ? 'text-warning' : 'text-muted'"
    >
      {{ charCount }} / {{ maxChars }}
    </div>
  </div>
</template>

<style>
/*
 * Блок НЕ scoped навмисно.
 *
 * Плейсхолдер малює сам ProseMirror через декорацію — у вузла немає
 * data-v-атрибута цього SFC, тож scoped-правило до нього не дійшло б.
 *
 * І без @apply: у Tailwind v4 він усередині <style> компонента вимагає
 * @reference на таблицю стилів проєкту, а шлях до неї в чужому проєкті
 * невідомий. Прості var(--token) працюють скрізь, де скопійовано tokens.css.
 */
.ui-prose p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--ink-muted);
}
</style>
