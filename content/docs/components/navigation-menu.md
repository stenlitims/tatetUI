---
title: NavigationMenu
description: Продуктова навігація з dropdown-групами, посиланнями та клавіатурним focus management.
component: UiNavigationMenu
dependsOn:
  - app/utils/overlayPosition.ts
emitDescriptions:
  update:modelValue: Ідентифікатор відкритої групи або null.
  select: Обраний кореневий або дочірній пункт.
status: stable
order: 47
---

## Приклад

::component-preview{name="navigation-menu-basic" stage="min-h-64"}
::

## Розмір і вигляд

Пропси `size` і `variant` керують пропорціями та виглядом кореневих
пунктів, шеврона і панелі разом. Стан «поточної сторінки» малюється з
`current` пункту: `underline` підкреслює його, `pill` дає брендову
підкладку, `plain` змінює колір на акцентний.

::component-preview{name="navigation-menu-customize" stage="min-h-64"}
::

## API

::component-api
::

## Коли використовувати

Для головної навігації продукту, де кілька верхніх пунктів розкривають
невеликі групи повʼязаних сторінок. Прості пункти лишаються справжніми
посиланнями, групи — кнопками.

## Коли НЕ використовувати

Не використовуйте як меню дій або великий багаторівневий sitemap. Для команд
є `UiMenu`, а глибоку структуру краще показати через `UiSidebar`.

## Доступність

ArrowLeft і ArrowRight переміщують фокус між кореневими пунктами, ArrowDown
відкриває групу, Home та End переходять до країв. У dropdown працюють
ArrowUp, ArrowDown і Escape. Disabled-посилання не потрапляють у обхід.

Шеврон групи — SVG, а не текстовий знак: символ «⌄» шрифти малюють
по-своєму, дрібно й зі з'їздом від базової лінії, тож вигляд залежав би
від системного шрифту. SVG масштабується пропорційно `size` і фарбується
через `currentColor`.
