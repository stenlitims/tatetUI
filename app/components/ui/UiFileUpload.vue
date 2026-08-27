<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { errorTextClass, helperTextClass, labelClass } from '~/utils/uiFieldStyles'

/**
 * Зона завантаження: drag&drop + клік + клавіатура. ВАЖЛИВО: сам upload
 * тут НЕ відбувається — бібліотека не має бекенд-залежностей. Компонент
 * валідує файли (accept, maxSizeMb), прев'юїть зображення локально й
 * віддає File[] у `select`; фетч, прогрес і `loading` — на споживачі.
 */
const props = withDefaults(
  defineProps<{
    /** Фільтр типів: `image/*,.pdf`. Валідація по MIME або розширенню. */
    accept?: string
    /** Дозволити кілька файлів. */
    multiple?: boolean
    /** Ліміт розміру файлу в МБ. */
    maxSizeMb?: number
    /** Заголовок зони. */
    label?: string
    /** Підказка під зоною. */
    hint?: string
    disabled?: boolean
    /** Стан завантаження споживача: зона показує спінер. */
    loading?: boolean
    /** Прогрес споживача 0–100 — показує смугу. */
    progress?: number | null
    /** Текст помилки валідації споживача. */
    error?: string
  }>(),
  {
    accept: undefined,
    multiple: false,
    maxSizeMb: 10,
    label: 'Перетягніть файли сюди',
    hint: undefined,
    disabled: false,
    loading: false,
    progress: null,
    error: undefined,
  },
)

const emit = defineEmits<{
  /** Валідні файли. Споживач сам вирішує, що з ними робити. */
  select: [files: File[]]
  /** Хоча б один файл не пройшов валідацію. */
  error: [message: string]
}>()

defineSlots<{
  /** Замінює зону цілком. */
  default?: () => unknown
  /** Власне прев'ю замість зображення. */
  preview?: (props: { fileUrl: string; fileName: string }) => unknown
}>()

const inputId = `${useId()}-file`
const inputEl = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const objectUrl = ref<string | null>(null)
const fileName = ref<string | null>(null)
const localError = ref<string | null>(null)

const hasError = computed(() => !!props.error || !!localError.value)
const errorText = computed(() => props.error ?? localError.value)

/*
 * Локальне прев'ю зображення: URL.createObjectURL дає посилання без
 * читання файлу в пам'ять. Попередній URL відкликається при новому файлі
 * і при знищенні компонента — інакше витік.
 */
function setPreview(file: File) {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
  fileName.value = null
  const isImage = file.type.startsWith('image/')
  if (isImage && typeof URL !== 'undefined' && URL.createObjectURL) {
    objectUrl.value = URL.createObjectURL(file)
    fileName.value = file.name
  }
}

function clearPreview() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
  fileName.value = null
}

onBeforeUnmount(clearPreview)

/** Зіставлення accept: список через кому, MIME (`image/*`) або `.ext`. */
function matchesAccept(file: File, accept: string): boolean {
  const rules = accept.split(',').map((rule) => rule.trim().toLowerCase())
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some((rule) => {
    if (!rule) return false
    if (rule.startsWith('.')) return name.endsWith(rule)
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

function onFiles(fileList: FileList | null) {
  localError.value = null
  if (!fileList?.length) return
  const files = Array.from(fileList)
  const valid: File[] = []

  for (const file of files) {
    if (props.accept && !matchesAccept(file, props.accept)) {
      emit('error', `«${file.name}» — недопустимий тип файлу`)
      continue
    }
    if (file.size > props.maxSizeMb * 1024 * 1024) {
      emit('error', `«${file.name}» більший за ${props.maxSizeMb} МБ`)
      continue
    }
    valid.push(file)
  }

  if (valid.length) {
    emit('select', valid)
    if (!props.multiple) setPreview(valid[0]!)
  }
}

function onDrop(event: DragEvent) {
  dragActive.value = false
  if (props.disabled) return
  onFiles(event.dataTransfer?.files ?? null)
}

function openDialog() {
  if (props.disabled) return
  inputEl.value?.click()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openDialog()
  }
}

function removeFile() {
  clearPreview()
  inputEl.value && (inputEl.value.value = '')
}
</script>

<template>
  <div>
    <label v-if="label && !$slots.default" :class="labelClass">{{ label }}</label>

    <!-- Прев'ю зображення -->
    <div v-if="objectUrl && !$slots.default" class="mb-2 flex items-center gap-3">
      <slot name="preview" :file-url="objectUrl" :file-name="fileName ?? ''">
        <div class="relative">
          <img
            :src="objectUrl"
            alt=""
            class="h-20 w-20 rounded-card border border-line object-cover"
          />
          <button
            type="button"
            aria-label="Видалити"
            class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-muted shadow-card transition-colors hover:bg-hover hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="removeFile"
          >
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </slot>
    </div>

    <slot>
      <div
        role="button"
        tabindex="0"
        :aria-disabled="disabled || undefined"
        :aria-label="typeof label === 'string' ? label : 'Завантажити файл'"
        class="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          dragActive ? 'border-accent-solid bg-primary-50' : 'border-line bg-subtle',
          disabled ? 'pointer-events-none opacity-50' : '',
        ]"
        @click="openDialog"
        @keydown="onKeydown"
        @dragover.prevent="dragActive = true"
        @dragleave="dragActive = false"
        @drop.prevent="onDrop"
      >
        <svg v-if="loading" class="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.2-10.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <svg v-else class="h-6 w-6 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <p class="text-sm font-medium text-ink">{{ loading ? 'Завантаження…' : label }}</p>
        <p v-if="!loading" class="text-xs text-muted">
          або {{ multiple ? 'перетягніть кілька файлів' : 'натисніть, щоб обрати' }}
        </p>

        <!-- Прогрес upload споживача -->
        <div v-if="progress != null" class="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line">
          <div class="h-full rounded-full bg-accent-solid transition-[width] duration-300" :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }" />
        </div>
      </div>
    </slot>

    <input
      ref="inputEl"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onFiles(($event.target as HTMLInputElement).files)"
    />

    <p v-if="hasError" :class="errorTextClass" role="alert">{{ errorText }}</p>
    <p v-else-if="hint" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>