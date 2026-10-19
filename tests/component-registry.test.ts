// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import { collectFiles, generateRegistry } from '../build/component-registry'
import type { RegistryComponent, RegistryItem } from '../shared/types/registry'

const root = new URL('..', import.meta.url).pathname
let fixture: string
let items: RegistryItem[]
const json = async (path: string) => JSON.parse(await readFile(join(fixture, 'public', path), 'utf8'))

beforeAll(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'tatetui-registry-'))
  for (const path of ['app', 'content', 'package.json']) await cp(join(root, path), join(fixture, path), { recursive: true })
  items = await generateRegistry({ root: fixture, siteUrl: 'https://ui.example.test' })
}, 30000)
afterAll(async () => { if (fixture) await rm(fixture, { recursive: true, force: true }) })

describe('published component distribution', () => {
  it('makes every documented component discoverable with Markdown, API and download links', async () => {
    const index = await json('/registry/index.json')
    expect(index.components).toEqual(items)
    expect(new Set(items.map(item => item.component)).size).toBe(items.length)
    const llms = await readFile(join(fixture, 'public/llms.txt'), 'utf8')
    for (const item of items) {
      expect(llms).toContain(`https://ui.example.test${item.registry}`)
      const markdown = await readFile(join(fixture, 'public', item.markdown), 'utf8')
      expect(markdown).toContain(`https://ui.example.test${item.api}`)
      expect(markdown).not.toContain('::component-preview')
      expect(markdown).not.toContain('::component-api')
    }
    const button = await readFile(join(fixture, 'public/registry/docs/components/button.md'), 'utf8')
    expect(button).toContain('<UiButton')
    expect(button).toContain('Клік по кнопці')
  })

  it('ships matching raw sources, JSON and ZIP files for every component', async () => {
    for (const item of items) {
      const entry: RegistryComponent = await json(item.registry)
      const downloads = await json('/registry/downloads.json')
      expect(downloads[item.name].download).toBe(item.download)
      expect(downloads[item.name].files).toEqual(entry.files.map(({ path, url }) => ({ path, url })))
      expect(downloads[item.name].files[0]).not.toHaveProperty('content')
      const archive = unzipSync(await readFile(join(fixture, 'public', item.download)))
      expect(archive['README.md']).toBeDefined()
      expect(archive['content/docs/agents.md']).toBeDefined()
      expect(JSON.parse(strFromU8(archive['registry.json']!))).toEqual(entry)
      for (const file of entry.files) {
        expect(strFromU8(archive[file.path]!)).toBe(file.content)
        expect(await readFile(join(fixture, 'public', file.url), 'utf8')).toBe(file.content)
        expect(await readFile(join(root, file.path), 'utf8')).toBe(file.content)
        expect(createHash('sha256').update(file.content).digest('hex')).toBe(file.sha256)
      }
    }
  }, 30000)

  it('includes nested overlays, private editor files and CSS-only dependencies', async () => {
    const select: RegistryComponent = await json('/registry/components/select.json')
    const paths = select.files.map(file => file.path)
    expect(paths).toContain('app/components/ui/UiDrawer.vue')
    expect(paths).toContain('app/composables/useScrollEdges.ts')
    expect(paths).toContain('app/utils/swipe.ts')
    expect(paths).toContain('app/assets/css/components.css')
    expect(select.dependencies).toEqual({})
    const editor: RegistryComponent = await json('/registry/components/rich-text-editor.json')
    expect(editor.files.map(file => file.path)).toContain('app/components/ui/rich-text-editor/shared/icons.ts')
    expect(editor.files.map(file => file.path)).toContain('app/assets/css/ui-prose.css')
    expect(editor.dependencies['@tiptap/vue-3']).toBe('3.30.2')
    expect(editor.overrides['@tiptap/core']).toBe('3.30.2')
    const button: RegistryComponent = await json('/registry/components/button.json')
    expect(button.integration.join(' ')).toContain('NuxtLink')
  })

  it('resolves dynamic imports, re-exports and cycles; rejects missing or unsafe imports', async () => {
    const utils = join(fixture, 'app/utils')
    await mkdir(utils, { recursive: true })
    await writeFile(join(utils, 'registryA.ts'), "export * from './registryB'; import('./registryC')")
    await writeFile(join(utils, 'registryB.ts'), "export * from './registryA'")
    await writeFile(join(utils, 'registryC.ts'), 'export const value = 1')
    const graph = await collectFiles(fixture, ['app/utils/registryA.ts'])
    expect([...graph.sources.keys()]).toHaveLength(3)
    await writeFile(join(utils, 'registryC.ts'), "import './missingRegistryFile'")
    await expect(collectFiles(fixture, ['app/utils/registryA.ts'])).rejects.toThrow('Cannot resolve')
    await expect(collectFiles(fixture, ['../package.json'])).rejects.toThrow('Unsafe registry path')
    await writeFile(join(utils, 'registryC.ts'), "import '../../../../../package.json'")
    await expect(collectFiles(fixture, ['app/utils/registryC.ts'])).rejects.toThrow('Unsafe import')
  })
})
