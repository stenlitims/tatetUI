/**
 * Іконки тулбара.
 *
 * Правило дому каже «іконка — слот, не рядок-клас». Тут свідомий виняток, і
 * причина правила при цьому виконується: воно існує, щоб компонент не тягнув
 * залежність від набору іконок. Це замкнений набір із трьох десятків шляхів
 * без жодного імпорту — слоти на кожну кнопку тулбара дали б API, яким
 * ніхто не скористається.
 *
 * `d` — шлях; `fill` означає, що фігура заливна, інакше малюється обведенням.
 */
export interface IconDef {
  d: string
  fill?: boolean
}

const ICONS = {
  bold: { d: 'M6 4h6a4 4 0 0 1 0 8H6zm0 8h7a4 4 0 0 1 0 8H6z' },
  italic: { d: 'M19 4h-9M14 20H5M15 4L9 20' },
  underline: { d: 'M6 4v6a6 6 0 0 0 12 0V4M4 21h16' },
  strike: { d: 'M4 12h16M17.5 7A4.5 4.5 0 0 0 13 4h-1a4 4 0 0 0-1.2 7.8M7 17a4.5 4.5 0 0 0 4.5 3h1a4 4 0 0 0 1.2-7.8' },
  code: { d: 'M8 6l-6 6 6 6M16 6l6 6-6 6' },
  superscript: { d: 'M4 6l8 12M12 6L4 18M22 10h-4c0-2 4-2 4-4a2 2 0 0 0-4 0' },
  subscript: { d: 'M4 6l8 12M12 6L4 18M22 22h-4c0-2 4-2 4-4a2 2 0 0 0-4 0' },
  clearFormatting: { d: 'M8 4h12M9 20h6M14 4L9 20M4 4l16 16' },

  bulletList: { d: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
  numberedList: { d: 'M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M4 14h2v2H4v2h2' },
  blockquote: { d: 'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z', fill: true },
  codeBlock: { d: 'M3 5h18v14H3zM9 10l-2 2 2 2M15 10l2 2-2 2' },
  horizontalRule: { d: 'M3 12h18' },

  alignLeft: { d: 'M4 6h16M4 12h10M4 18h13' },
  alignCenter: { d: 'M4 6h16M7 12h10M6 18h12' },
  alignRight: { d: 'M4 6h16M10 12h10M7 18h13' },
  alignJustify: { d: 'M4 6h16M4 12h16M4 18h16' },

  textColor: { d: 'M5 20h14M8 16l4-10 4 10M9.5 13h5' },
  highlight: { d: 'M4 20h16M6 16l8-8 4 4-8 8zM12 6l3-3 4 4-3 3' },

  link: { d: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1' },
  unlink: { d: 'M10 13a5 5 0 0 0 7 0l1-1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 5 8M4 4l16 16' },

  image: { d: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6' },
  table: { d: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14' },

  undo: { d: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3' },
  redo: { d: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3' },

  fullscreen: { d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' },
  exitFullscreen: { d: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' },

  editHtml: { d: 'M8 6l-6 6 6 6M16 6l6 6-6 6M13 4l-2 16' },
  more: { d: 'M5 12h.01M12 12h.01M19 12h.01' },
  chevronDown: { d: 'M6 9l6 6 6-6' },
  check: { d: 'M20 6L9 17l-5-5' },
  close: { d: 'M18 6L6 18M6 6l12 12' },
  trash: { d: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13' },
} as const

/*
 * Ключі виводяться з літерала, а значення типізовані як IconDef.
 *
 * `as const satisfies Record<string, IconDef>` не годиться: він зберігає
 * ЛІТЕРАЛЬНИЙ тип кожного запису, тож `icon.fill` не існує на тих, що його
 * не оголошують, і звернення до нього не компілюється.
 */
export type RteIconName = keyof typeof ICONS

export const RTE_ICONS: Record<RteIconName, IconDef> = ICONS
