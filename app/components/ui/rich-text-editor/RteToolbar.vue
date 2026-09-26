<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import UiDrawer from '../UiDrawer.vue'
import RteIconBtn from './shared/RteIconBtn.vue'
import RteIcon from './shared/RteIcon.vue'
import { useRteLabels } from './labels'
import { touchTargetClass } from '~/utils/uiFieldStyles'

const props = defineProps<{
  editor: Editor | undefined
  /** Лічильник транзакцій із кореня — робить стан кнопок реактивним. */
  tick: number
  mode: 'simple' | 'full'
  disabled?: boolean
}>()

defineSlots<Record<string, never>>()

const l = useRteLabels()
const mobileOpen = ref(false)

/*
 * isActive() і can() — звичайні методи, не реактивні джерела. `tick` тут
 * читається першим саме щоб зробити ці computed залежними від транзакцій
 * редактора; без нього кнопки застигають у стані на момент монтування.
 */
const active = computed(() => {
  void props.tick
  const e = props.editor
  if (!e) return {} as Record<string, boolean>
  return {
    bold: e.isActive('bold'),
    italic: e.isActive('italic'),
    underline: e.isActive('underline'),
    strike: e.isActive('strike'),
    code: e.isActive('code'),
    bulletList: e.isActive('bulletList'),
    orderedList: e.isActive('orderedList'),
    blockquote: e.isActive('blockquote'),
    codeBlock: e.isActive('codeBlock'),
    alignLeft: e.isActive({ textAlign: 'left' }),
    alignCenter: e.isActive({ textAlign: 'center' }),
    alignRight: e.isActive({ textAlign: 'right' }),
  }
})

const history = computed(() => {
  void props.tick
  const e = props.editor
  return { undo: !!e?.can().undo(), redo: !!e?.can().redo() }
})

const headingLevel = computed({
  get: () => {
    void props.tick
    const e = props.editor
    if (!e) return '0'
    for (const level of [1, 2, 3, 4] as const) {
      if (e.isActive('heading', { level })) return String(level)
    }
    return '0'
  },
  set: (value: string) => {
    const chain = props.editor?.chain().focus()
    if (!chain) return
    if (value === '0') chain.setParagraph().run()
    else chain.setHeading({ level: Number(value) as 1 | 2 | 3 | 4 }).run()
  },
})

function cmd(fn: (chain: ReturnType<NonNullable<typeof props.editor>['chain']>) => void) {
  if (props.disabled) return
  const e = props.editor
  if (!e) return
  fn(e.chain().focus())
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) mobileOpen.value = false
  },
)
</script>

<template>
  <fieldset
    :disabled="disabled"
    class="m-0 flex min-w-0 items-center gap-1 border-0 border-b border-line bg-subtle px-2 py-1.5"
  >
    <!-- Десктоп: повний ряд -->
    <div class="hidden flex-wrap items-center gap-0.5 md:flex">
      <select v-model="headingLevel" class="h-9 rounded-control border border-line bg-input px-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:text-xs" :aria-label="l.headingLevel">
        <option value="0">{{ l.paragraph }}</option>
        <option value="1">{{ l.heading }} 1</option>
        <option value="2">{{ l.heading }} 2</option>
        <option value="3">{{ l.heading }} 3</option>
        <option value="4">{{ l.heading }} 4</option>
      </select>

      <span class="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <RteIconBtn icon="bold" :title="l.bold" :active="active.bold" @click="cmd(c => c.toggleBold().run())" />
      <RteIconBtn icon="italic" :title="l.italic" :active="active.italic" @click="cmd(c => c.toggleItalic().run())" />
      <RteIconBtn icon="underline" :title="l.underline" :active="active.underline" @click="cmd(c => c.toggleUnderline().run())" />
      <RteIconBtn icon="strike" :title="l.strike" :active="active.strike" @click="cmd(c => c.toggleStrike().run())" />
      <RteIconBtn icon="code" :title="l.code" :active="active.code" @click="cmd(c => c.toggleCode().run())" />

      <span class="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <RteIconBtn icon="bulletList" :title="l.bulletList" :active="active.bulletList" @click="cmd(c => c.toggleBulletList().run())" />
      <RteIconBtn icon="numberedList" :title="l.numberedList" :active="active.orderedList" @click="cmd(c => c.toggleOrderedList().run())" />
      <RteIconBtn icon="blockquote" :title="l.blockquote" :active="active.blockquote" @click="cmd(c => c.toggleBlockquote().run())" />
      <RteIconBtn icon="codeBlock" :title="l.codeBlock" :active="active.codeBlock" @click="cmd(c => c.toggleCodeBlock().run())" />
      <RteIconBtn icon="horizontalRule" :title="l.horizontalRule" @click="cmd(c => c.setHorizontalRule().run())" />

      <template v-if="mode === 'full'">
        <span class="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <RteIconBtn icon="alignLeft" :title="l.alignLeft" :active="active.alignLeft" @click="cmd(c => c.setTextAlign('left').run())" />
        <RteIconBtn icon="alignCenter" :title="l.alignCenter" :active="active.alignCenter" @click="cmd(c => c.setTextAlign('center').run())" />
        <RteIconBtn icon="alignRight" :title="l.alignRight" :active="active.alignRight" @click="cmd(c => c.setTextAlign('right').run())" />
      </template>

      <span class="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <RteIconBtn icon="clearFormatting" :title="l.clearFormatting" @click="cmd(c => c.unsetAllMarks().clearNodes().run())" />
      <RteIconBtn icon="undo" :title="l.undo" :disabled="!history.undo" @click="cmd(c => c.undo().run())" />
      <RteIconBtn icon="redo" :title="l.redo" :disabled="!history.redo" @click="cmd(c => c.redo().run())" />
    </div>

    <!--
      Мобільний: рівно дві кнопки в ряду, решта — у drawer.
      Тридцять кнопок по 44px на телефон не поміщаються ніяк, а зменшувати
      їх до розміру десктопних означає зробити тулбар незручним саме там,
      де точність дотику найгірша.
    -->
    <div class="flex items-center gap-1 md:hidden">
      <RteIconBtn icon="bold" :title="l.bold" :active="active.bold" @click="cmd(c => c.toggleBold().run())" />
      <RteIconBtn icon="italic" :title="l.italic" :active="active.italic" @click="cmd(c => c.toggleItalic().run())" />
      <button type="button" class="relative ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink active:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden" :class="touchTargetClass" :title="l.more" :aria-label="l.more" @click="mobileOpen = true">
        <RteIcon name="more" />
      </button>
    </div>

    <!--
      Аркуш має ті самі можливості, що й десктопний ряд: рівень заголовка й
      вирівнювання раніше були лише на десктопі, і на телефоні зробити
      заголовок було неможливо взагалі. gap-2, а не gap-1: зони дотику
      45×45 сусідніх кнопок інакше наповзали одна на одну на 11px.
    -->
    <UiDrawer v-model="mobileOpen" position="bottom" size="auto" :title="l.more" close-on-backdrop>
      <select v-model="headingLevel" class="mb-3 h-12 w-full rounded-control border border-line bg-input px-3 text-[16px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" :aria-label="l.headingLevel">
        <option value="0">{{ l.paragraph }}</option>
        <option value="1">{{ l.heading }} 1</option>
        <option value="2">{{ l.heading }} 2</option>
        <option value="3">{{ l.heading }} 3</option>
        <option value="4">{{ l.heading }} 4</option>
      </select>
      <div class="flex flex-wrap gap-2">
        <RteIconBtn icon="underline" :title="l.underline" :active="active.underline" @click="cmd(c => c.toggleUnderline().run())" />
        <RteIconBtn icon="strike" :title="l.strike" :active="active.strike" @click="cmd(c => c.toggleStrike().run())" />
        <RteIconBtn icon="code" :title="l.code" :active="active.code" @click="cmd(c => c.toggleCode().run())" />
        <RteIconBtn icon="bulletList" :title="l.bulletList" :active="active.bulletList" @click="cmd(c => c.toggleBulletList().run())" />
        <RteIconBtn icon="numberedList" :title="l.numberedList" :active="active.orderedList" @click="cmd(c => c.toggleOrderedList().run())" />
        <RteIconBtn icon="blockquote" :title="l.blockquote" :active="active.blockquote" @click="cmd(c => c.toggleBlockquote().run())" />
        <RteIconBtn icon="codeBlock" :title="l.codeBlock" :active="active.codeBlock" @click="cmd(c => c.toggleCodeBlock().run())" />
        <RteIconBtn icon="horizontalRule" :title="l.horizontalRule" @click="cmd(c => c.setHorizontalRule().run())" />
        <template v-if="mode === 'full'">
          <RteIconBtn icon="alignLeft" :title="l.alignLeft" :active="active.alignLeft" @click="cmd(c => c.setTextAlign('left').run())" />
          <RteIconBtn icon="alignCenter" :title="l.alignCenter" :active="active.alignCenter" @click="cmd(c => c.setTextAlign('center').run())" />
          <RteIconBtn icon="alignRight" :title="l.alignRight" :active="active.alignRight" @click="cmd(c => c.setTextAlign('right').run())" />
        </template>
        <RteIconBtn icon="clearFormatting" :title="l.clearFormatting" @click="cmd(c => c.unsetAllMarks().clearNodes().run())" />
        <RteIconBtn icon="undo" :title="l.undo" :disabled="!history.undo" @click="cmd(c => c.undo().run())" />
        <RteIconBtn icon="redo" :title="l.redo" :disabled="!history.redo" @click="cmd(c => c.redo().run())" />
      </div>
    </UiDrawer>
  </fieldset>
</template>
