<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId } from 'vue'
import { isFileAccepted } from '~/utils/fileUpload'
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
  /** Одиночний файл видалено з локального прев'ю. */
  remove: [file: File]
}>()

defineSlots<{
  /** Замінює зону цілком; `open` відкриває системний file picker. */
  default?: (props: {
    open: () => void
    dragActive: boolean
    loading: boolean
    disabled: boolean
  }) => unknown
  /** Власне прев'ю замість зображення. */
  preview?: (props: { fileUrl: string; fileName: string }) => unknown
}>()

const inputId = `${useId()}-file`
const errorId = `${inputId}-error`
const hintId = `${inputId}-hint`
const inputEl = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const objectUrl = shallowRef<string | null>(null)
const selectedFile = shallowRef<File | null>(null)
const localError = ref<string | null>(null)

const hasError = computed(() => !!props.error || !!localError.value)
const errorText = computed(() => props.error ?? localError.value)
const describedBy = computed(() => {
  if (hasError.value) return errorId
  if (props.hint) return hintId
  return undefined
})

/*
 * Локальне прев'ю зображення: URL.createObjectURL дає посилання без
 * читання файлу в пам'ять. Попередній URL відкликається при новому файлі
 * і при знищенні компонента — інакше витік.
 */
function setPreview(file: File) {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
  selectedFile.value = file
  const isImage = file.type.startsWith('image/')
  if (isImage && typeof URL !== 'undefined' && URL.createObjectURL) {
    objectUrl.value = URL.createObjectURL(file)
  }
}

function clearPreview() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
  selectedFile.value = null
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`
}

onBeforeUnmount(clearPreview)

function onFiles(fileList: FileList | null) {
  localError.value = null
  if (!fileList?.length) return
  const files = props.multiple ? Array.from(fileList) : Array.from(fileList).slice(0, 1)
  const valid: File[] = []

  for (const file of files) {
    if (!isFileAccepted(file, props.accept)) {
      const message = `«${file.name}» — недопустимий тип файлу`
      localError.value ??= message
      emit('error', message)
      continue
    }
    if (file.size > props.maxSizeMb * 1024 * 1024) {
      const message = `«${file.name}» більший за ${props.maxSizeMb} МБ`
      localError.value ??= message
      emit('error', message)
      continue
    }
    valid.push(file)
  }

  if (valid.length) {
    emit('select', valid)
    if (!props.multiple) setPreview(valid[0]!)
  }
}

/*
 * Лічильник, а не булевий прапорець.
 *
 * dragleave спрацьовує щоразу, коли курсор переходить із зони на її
 * ДОЧІРНІЙ елемент (іконку, текст) — і зона гасла посеред перетягування,
 * блимаючи на кожній межі. Пара dragenter/dragleave на кожному вузлі
 * симетрична, тож стан «над зоною» — це лічильник > 0.
 */
let dragDepth = 0

function onDragEnter() {
  if (props.disabled) return
  dragDepth += 1
  dragActive.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragActive.value = false
}

function onDrop(event: DragEvent) {
  dragDepth = 0
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
  const file = selectedFile.value
  clearPreview()
  inputEl.value && (inputEl.value.value = '')
  if (file) emit('remove', file)
}

defineExpose({
  /** Відкрити системний вибір файлу. */
  open: openDialog,
})
</script>

<template>
  <div>
    <label v-if="label && !$slots.default" :for="inputId" :class="labelClass">
      {{ label }}
    </label>

    <!-- Прев'ю одиночного файлу -->
    <div
      v-if="selectedFile && !multiple"
      class="mb-2 flex items-center gap-3 rounded-card border border-line bg-subtle p-2.5"
    >
      <slot name="preview" :file-url="objectUrl ?? ''" :file-name="selectedFile.name">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-card">
          <img
            v-if="objectUrl"
            :src="objectUrl"
            alt=""
            class="h-full w-full object-cover"
          />
          <svg v-else class="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 3h7l4 4v14H7zM14 3v5h4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          </svg>
        </div>
      </slot>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-ink">{{ selectedFile.name }}</p>
        <p class="text-xs text-muted">{{ formatFileSize(selectedFile.size) }}</p>
      </div>
      <button
        type="button"
        :aria-label="`Видалити файл ${selectedFile.name}`"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="removeFile"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <slot
      :open="openDialog"
      :drag-active="dragActive"
      :loading="loading"
      :disabled="disabled"
    >
      <div
        role="button"
        :tabindex="disabled ? -1 : 0"
        :aria-busy="loading || undefined"
        :aria-disabled="disabled || undefined"
        :aria-describedby="describedBy"
        :aria-label="typeof label === 'string' ? label : 'Завантажити файл'"
        class="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          dragActive
            ? 'border-accent-solid bg-primary-50 ring-[3px] ring-ring/20'
            : 'border-line bg-subtle hover:border-line-strong hover:bg-hover',
          disabled ? 'pointer-events-none opacity-50' : '',
        ]"
        @click="openDialog"
        @keydown="onKeydown"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent
        @dragleave="onDragLeave"
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
        <div
          v-if="progress != null"
          role="progressbar"
          aria-label="Прогрес завантаження"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.min(100, Math.max(0, progress))"
          class="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line"
        >
          <div class="h-full rounded-full bg-accent-solid transition-[width] duration-300" :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }" />
        </div>
      </div>
    </slot>

    <input
      :id="inputId"
      ref="inputEl"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onFiles(($event.target as HTMLInputElement).files)"
    />

    <p v-if="hasError" :id="errorId" :class="errorTextClass" role="alert">{{ errorText }}</p>
    <p v-else-if="hint" :id="hintId" :class="helperTextClass">{{ hint }}</p>
  </div>
</template>
