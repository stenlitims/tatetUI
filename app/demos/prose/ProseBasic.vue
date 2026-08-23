<script setup lang="ts">
import UiProse from '~/components/ui/UiProse.vue'

/**
 * Демо не імпортує tiptap узагалі — саме тому воно доводить, що ui-prose
 * корисний сам по собі, як читалка вмісту з бази.
 */
const html = `
<h2>Оформлення вмісту</h2>
<p>Абзац зі <strong>жирним</strong>, <em>курсивом</em>, <u>підкресленням</u>,
<code>інлайновим кодом</code> та <a href="#">посиланням</a>.</p>

<p class="typography-lead">Пресет «lead»: вступний абзац, більший за основний текст.</p>

<blockquote data-blockquote data-blockquote-type="info" data-show-icon="true"
  class="blockquote blockquote-info"><p>Іконка малюється через CSS, а не розмітку — інакше
серверний санітайзер зніс би її, і варіант виродився б у звичайну цитату.</p></blockquote>

<blockquote data-blockquote data-blockquote-type="warning" data-show-icon="true"
  class="blockquote blockquote-warning"><p>Попередження.</p></blockquote>

<blockquote data-blockquote data-blockquote-type="danger" data-show-icon="true"
  class="blockquote blockquote-danger"><p>Помилка або незворотна дія.</p></blockquote>

<h3>Списки</h3>
<ul><li>Перший рівень
  <ul><li>другий — коло</li>
    <ul><li>третій — квадрат</li></ul>
  </ul></li>
<li>Ще пункт</li></ul>

<h3>Таблиця</h3>
<table><thead><tr><th>Токен</th><th>Роль</th></tr></thead>
<tbody><tr><td><code>--ink</code></td><td>основний текст</td></tr>
<tr><td><code>--ink-muted</code></td><td>другорядний текст</td></tr>
<tr><td><code>--line</code></td><td>межі</td></tr></tbody></table>

<pre><code>const html = editor.getHTML()</code></pre>
`
</script>

<template>
  <div class="w-full">
    <UiProse :html="html" as="article" />
  </div>
</template>
