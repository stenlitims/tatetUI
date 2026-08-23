---
title: RichTextEditor
description: Редактор на TipTap. Єдиний компонент бібліотеки із зовнішніми залежностями.
component: UiRichTextEditor
dependsOn:
  - app/assets/css/ui-prose.css
  - app/components/ui/UiProse.vue
emitDescriptions:
  update:modelValue: Новий HTML документа. Спрацьовує на кожну транзакцію.
  focus: Редактор отримав фокус.
  blur: Редактор втратив фокус.
status: wip
order: 20
---

Це **єдиний виняток** із правила «бібліотека без зовнішніх залежностей».
ProseMirror переписати неможливо, а редактор без нього — не редактор.

## Залежності

Скопіювавши компонент, поставте:

```bash
bun add @tiptap/core@3.30.2 @tiptap/pm@3.30.2 @tiptap/vue-3@3.30.2 @tiptap/starter-kit@3.30.2 @tiptap/extensions@3.30.2 @tiptap/extension-paragraph@3.30.2 @tiptap/extension-image@3.30.2 @tiptap/extension-table@3.30.2 @tiptap/extension-text-style@3.30.2 @tiptap/extension-highlight@3.30.2 @tiptap/extension-text-align@3.30.2 @tiptap/extension-typography@3.30.2 @tiptap/extension-subscript@3.30.2 @tiptap/extension-superscript@3.30.2 @floating-ui/dom
```

**Версії точні, і це не педантизм.** `@tiptap/vue-3` пінує `@tiptap/core` та
`@tiptap/pm` точно, а решта сімейства залежить одне від одного через карет.
Варто зафіксувати лише частину — і решта поїде вперед: у нас `extension-list`
підтягнувся на 3.30.2, поки закріплений `core` лишався на 3.27.3, і імпорт
упав на відсутньому експорті. Додайте ще й `overrides`:

```json
{ "overrides": { "@tiptap/core": "3.30.2", "@tiptap/pm": "3.30.2" } }
```

Дві копії ProseMirror у графі — найгірший зі сценаріїв: помилки не буде
взагалі, просто всі команди мовчки перестануть працювати, бо схеми
походитимуть з різних інстансів. Перевірка одним рядком:

```bash
find node_modules -type d -name prosemirror-model | wc -l
```

Чого в списку **немає** і чому: `extension-link`, `-underline`,
`-horizontal-rule`, `-blockquote` уже всередині `starter-kit`; `-placeholder`
і `-character-count` — у `@tiptap/extensions`; `-color` — у `-text-style`;
`-table-row`, `-table-cell`, `-table-header` — у `-table`. Поставити їх
окремо означає покласти в граф другу копію того самого розширення.

## Приклад

::component-preview{name="rich-text-editor-basic" stage="min-h-96" bare}
::

## API

::component-api
::

## Коли використовувати

Для вмісту, який пишуть люди й читають люди: стаття, опис, довгий коментар.

## Коли НЕ використовувати

Для короткого тексту без форматування беріть `UiTextarea` — 180 КБ заради
одного рядка не варті нічого.

Не використовуйте як редактор коду. Тут немає ні підсвітки синтаксису, ні
відступів — для цього потрібен інший інструмент.

## Чому немає ClientOnly

Перевірено, а не припущено: `useEditor` створює інстанс усередині
`onMounted`, а `EditorContent` на сервері рендерить порожній `<div>`. Тобто
надісланий HTML і перший клієнтський рендер збігаються, і гідрація чиста.

Обгортка в `ClientOnly` була б не лише зайвою, а й шкідливою: це специфіка
Nuxt, а бібліотеку копіюють і у Vite-проєкти.

## Зв'язок із UiProse

Корінь ProseMirror несе клас `ui-prose` — **той самий**, що й `UiProse`. Це і
є контракт WYSIWYG: якби оформлення жило у scoped-стилях редактора,
публічній сторінці довелося б мати власну копію, і копії розійшлися б за
перший тиждень.

Тому `ui-prose.css` — обов'язкова залежність, а не рекомендація.
