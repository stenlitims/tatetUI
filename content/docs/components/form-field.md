---
title: FormField
description: Лейбл, опис, підказка й помилка для будь-якого контрола — з тими самими ARIA-зв'язками, що у вбудованих полях.
component: UiFormField
dependsOn:
  - app/utils/uiFieldStyles.ts
emitDescriptions:
status: stable
order: 2
---

Поля бібліотеки (`UiInput`, `UiSelect`, `UiTextarea`…) мають власні
`label`, `hint` і `error`. `UiFormField` дає ту саму обв'язку контролам, у
яких її немає: сегментному перемикачу, нативному `<input type="color">`,
сторонньому віджету чи власному полю.

::component-preview{name="form-field-basic" stage="min-h-80"}
::

## Як прив'язати контрол

Слот за замовчуванням отримує все, що треба розкласти на поле:

- `id` — на нього вказує `for` лейбла;
- `labelId` — для `aria-labelledby`, де `for` не працює (групи, власні
  віджети);
- `describedBy` — опис і рівно один із пари «помилка / підказка»;
- `invalid`, `required`, `disabled`.

```vue
<UiFormField label="Колір" hint="HEX або вибір з палітри" :error="error">
  <template #default="{ id, describedBy, invalid }">
    <input :id="id" type="color" :aria-describedby="describedBy" :aria-invalid="invalid || undefined" />
  </template>
</UiFormField>
```

## API

::component-api
::

## Коли використовувати

- Контрол без власного лейбла: `UiToggleGroup`, `UiSlider` без `label`,
  нативні поля, сторонні віджети.
- Група контролів під одним заголовком — `as="fieldset"`: кілька
  чекбоксів, перемикачів.
- Лейбл із дією праворуч — «Забули пароль?», «Скинути» — через слот
  `label-aside`.

## Коли НЕ використовувати

- Навколо `UiInput`, `UiSelect` та інших полів із власним `label` — вийде
  два лейбли й два описи.
- Для макета форми (колонки, відступи між полями) — це звичайна сітка.

## Доступність

`aria-describedby` вказує на `description` і рівно на ОДИН із пари помилка
/ підказка. Обидва одразу — і скрінрідер зачитає інструкцію, яку
користувач щойно порушив, раніше за причину відмови (правило дому).

У режимі `fieldset` лейбл — `<legend>`, і вона стоїть **першою дитиною**
`fieldset`: лише тоді браузер дає групі назву. Вкладена у flex-рядок поруч
із `label-aside`, вона назвою вже не була б. Тому легенда прихована, а
видимий рядок дублює її для ока з `aria-hidden`.

Помилка має `role="alert"` і з'являється разом із текстом — так само, як у
вбудованих полях: стан помилки вмикає САМА наявність тексту.
