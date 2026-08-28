---
title: Carousel
description: Керована карусель зі swipe, клавіатурою, autoplay-паузою та reduced motion.
component: UiCarousel
dependsOn:
  - app/composables/useReducedMotion.ts
emitDescriptions:
  update:modelValue: Індекс активного слайда.
  change: Новий індекс після переходу.
status: stable
order: 51
---

## Приклад

::component-preview{name="carousel-basic" stage="min-h-96"}
::

## API

::component-api
::

## Коли використовувати

Для невеликої послідовності промо, onboarding або медіа, де один елемент має
бути в центрі уваги. Компонент підтримує controlled index і кастомний слот
слайда.

## Коли НЕ використовувати

Не ховайте критичний контент чи основну навігацію в каруселі. Для списку
карток краще звичайна grid, а для великих наборів — pagination.

## Доступність

Region і слайди мають carousel-ролі та позицію «N з M». Стрілки, Home й End
працюють із клавіатури. Autoplay зупиняється під час focus і hover, має явну
кнопку Pause та не запускається при `prefers-reduced-motion`.
