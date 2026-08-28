---
title: ResizablePanels
description: Дві робочі панелі з pointer resize і доступним separator-контролем.
component: UiResizablePanels
emitDescriptions:
  update:modelValue: Частка першої панелі у відсотках.
  change: Фінальне значення після keyboard або pointer дії.
status: stable
order: 50
---

## Приклад

::component-preview{name="resizable-panels-basic" stage="min-h-80"}
::

## API

::component-api
::

## Коли використовувати

Для редакторів, файлових менеджерів і dashboard, де користувачу потрібно
розподіляти місце між двома одночасно важливими областями.

## Коли НЕ використовувати

Не використовуйте resize, якщо одна панель є тимчасовою — тоді краще Drawer.
На вузьких екранах часто зрозуміліше скласти блоки вертикально без separator.

## Доступність

Роздільник має `role="separator"`, значення min/max/now і правильну
orientation. Arrow-клавіші змінюють розмір на `step`, Home та End переходять
до меж. Disabled separator вилучається з tab order.
