---
title: Roadmap компонентів
description: Пріоритети наступних UI-компонентів за частотою використання, складністю доступності та користю для композиції.
order: 3
---

Roadmap не обіцяє дату релізу. Він фіксує, які прогалини бібліотеки варто
закривати першими і чому. Пріоритети звірені з каталогами
[Radix Primitives](https://www.radix-ui.com/primitives/docs/components),
[shadcn/ui](https://ui.shadcn.com/docs/components) та
[Headless UI](https://headlessui.com/).

## P0 — основа форм і оверлеїв

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| `UiCheckbox` | Незалежні булеві параметри та множинний вибір | Form groups, Table settings | mixed state, label/error зв'язок | proposed |
| `UiRadioGroup` | Один вибір із 2–7 видимих варіантів | Налаштування, опитування | roving tabindex, Arrow/Home/End | proposed |
| `UiPopover` | Довільна немодальна панель біля trigger | HoverCard, складені фільтри | focus return, outside click, positioning | proposed |

## P1 — продуктові й адміністративні сценарії

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| `UiContextMenu` | Дії над рядком, вузлом або полотном | Menu + positioning | клавіша Context Menu, координати pointer | proposed |
| `UiInputOtp` | Коди підтвердження та 2FA | Input semantics | paste, mobile keyboard, єдине accessible value | proposed |
| `UiNavigationMenu` | Ієрархічна продуктова навігація | Popover + links | menubar/navigation semantics, focus | proposed |
| `UiSidebar` | Адаптивна навігація застосунку | Drawer + navigation | collapse state, landmarks, mobile focus | proposed |

## P2 — спеціалізовані складені контролі

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| `UiScrollArea` | Узгоджений scroll affordance | Dropdown, Sidebar, panels | не ламати нативну прокрутку | proposed |
| `UiResizablePanels` | Робочі області редакторів і dashboard | Pointer utilities | separator role, клавіатурний resize | proposed |
| `UiCarousel` | Послідовність промо або медіа | Buttons + reduced motion | оголошення slide, autoplay controls | proposed |
| `UiHoverCard` | Необов'язковий preview за посиланням | Popover | hover/focus parity, dismiss | proposed |

## Як компонент переходить у роботу

Кандидат піднімається у пріоритеті, якщо повторюється щонайменше у двох
продуктах, має нетривіальний keyboard/ARIA-контракт або стає основою для
кількох наступних компонентів. Реалізація має лишатися copy-first і не
додавати runtime-залежність без окремого задокументованого винятку.
