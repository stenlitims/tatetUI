<script setup lang="ts">
/**
 * Три крапки, що пульсують. CSS-анімація без SVG і без залежностей.
 *
 * Колір береться з `currentColor`, тож індикатор автоматично збігається з
 * текстом батька — усередині суцільної кнопки він білий, усередині
 * ghost-кнопки приглушений, і жодного props для цього не потрібно.
 */

withDefaults(
  defineProps<{
    /** Діаметр крапки. Типово 0.25rem — пропорційно тексту кнопки. */
    size?: string
    /** Що зачитати скрінрідеру замість крапок. */
    label?: string
  }>(),
  { size: '0.25rem', label: 'Завантаження' },
)

defineSlots<Record<string, never>>()
</script>

<template>
  <!--
    Стан — прихованим ТЕКСТОМ, а не aria-label. Жива область оголошує зміну
    вмісту; aria-label вмістом не є, тож role="status" без тексту не мав що
    сказати — «Завантаження» не звучало ніколи.
  -->
  <span class="ui-loading-dots" :style="{ '--dot': size }" role="status">
    <span class="ui-loading-dot" aria-hidden="true" />
    <span class="ui-loading-dot" aria-hidden="true" />
    <span class="ui-loading-dot" aria-hidden="true" />
    <span class="sr-only">{{ label }}</span>
  </span>
</template>

<style scoped>
.ui-loading-dots {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--dot) * 1.2);
}

/* Клас, а не `> span`: прихований текст — теж span, і дочірній селектор
   намалював би його четвертою крапкою. */
.ui-loading-dot {
  width: var(--dot);
  height: var(--dot);
  border-radius: 9999px;
  background-color: currentColor;
  animation: ui-dot-bounce 1.4s infinite ease-in-out both;
}

/* Від'ємна затримка, а не додатна: інакше перші 1.4 с усі три крапки
   стоять нерухомо, і індикатор виглядає як застиглий, а не як триваючий. */
.ui-loading-dot:nth-child(1) { animation-delay: -0.32s; }
.ui-loading-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes ui-dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40%           { transform: scale(1);   opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .ui-loading-dot {
    animation: none;
    opacity: 0.6;
  }
}
</style>
