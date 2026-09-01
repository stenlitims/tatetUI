<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Стан перемикача. Використовуйте через `v-model`. */
    modelValue: boolean
    disabled?: boolean
    /** Доступна назва. ОБОВ'ЯЗКОВА, якщо поруч немає видимого лейбла. */
    label?: string
    /**
     * Суто візуальний режим: рендериться `<span aria-hidden>` без власної
     * інтерактивності.
     *
     * Потрібен, коли перемикач стоїть УСЕРЕДИНІ кнопки-рядка меню: вкладені
     * `<button>` у `<button>` — невалідний HTML. У такому разі
     * `role="switch"` і `aria-checked` несе зовнішня кнопка, а перемикач
     * лишається лише картинкою.
     */
    presentational?: boolean
  }>(),
  {},
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

defineSlots<Record<string, never>>()

const trackClass = computed(() =>
  props.modelValue ? 'bg-accent-solid' : 'bg-line-strong',
)

function onClick(event: MouseEvent) {
  if (props.disabled) return
  // stopPropagation: перемикач часто лежить у клікабельному рядку, і без
  // цього один клік спрацьовував би двічі — на перемикачі й на рядку.
  event.stopPropagation()
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <!--
    role="switch" + aria-checked. У вихідних проєктах це був <div> усередині
    <button>, де стан передавався ЛИШЕ кольором — для скрінрідера перемикач
    не існував.
  -->
  <component
    :is="presentational ? 'span' : 'button'"
    :type="presentational ? undefined : 'button'"
    :role="presentational ? undefined : 'switch'"
    :aria-checked="presentational ? undefined : modelValue"
    :aria-label="presentational ? undefined : label"
    :aria-hidden="presentational ? 'true' : undefined"
    :disabled="presentational ? undefined : disabled"
    class="ui-switch relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
    :class="[
      trackClass,
      disabled ? 'cursor-not-allowed opacity-50' : '',
      presentational
        ? ''
        : 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset',
    ]"
    @click="presentational ? undefined : onClick($event)"
  >
    <!-- Повзунок під натисканням витягується (див. стилі нижче) — це
         відгук на дотик, якого не дає :hover на телефоні. -->
    <span
      class="ui-switch-thumb absolute left-0.5 h-4 w-4 rounded-full bg-accent-contrast shadow-raised transition-[translate,width] ease-emphasized"
      :class="modelValue ? 'translate-x-4' : 'translate-x-0'"
    />
  </component>
</template>

<style scoped>
/*
 * Натиснутий перемикач витягує повзунок на 4px у бік руху. Це не декор:
 * на дотику :hover не настає, і без цього між натисканням і зміною стану
 * немає жодного проміжного відгуку. Увімкнений повзунок росте вліво
 * (translate менший), вимкнений — вправо.
 */
.ui-switch:active:not(:disabled) .ui-switch-thumb {
  width: 1.25rem;
}

.ui-switch:active:not(:disabled)[aria-checked='true'] .ui-switch-thumb {
  translate: 0.75rem 0;
}

/*
 * Невидима зона натискання 44×44 навколо перемикача.
 *
 * Сам перемикач має бути дрібним — це індикатор, а не кнопка. Але 20×36
 * пальцем не влучиш, а збільшувати візуальний розмір заради дотику означає
 * зіпсувати щільність списків, де таких перемикачів десяток.
 */
@media (hover: none) and (pointer: coarse) {
  .ui-switch::after {
    content: '';
    position: absolute;
    inset: 50% auto auto 50%;
    width: max(100%, 44px);
    height: max(100%, 44px);
    transform: translate(-50%, -50%);
  }
}
</style>
