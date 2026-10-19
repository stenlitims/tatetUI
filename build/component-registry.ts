import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import ts from 'typescript'
import { parse } from 'yaml'
import { strToU8, zipSync } from 'fflate'
import type { RegistryComponent, RegistryDownload, RegistryFile, RegistryItem } from '../shared/types/registry'

interface Doc {
  file: string
  route: string
  source: string
  title: string
  description: string
  component?: string
  dependsOn?: string[]
  emitDescriptions?: Record<string, string>
  status?: RegistryItem['status']
}

export const foundationFiles = [
  'app/assets/css/tokens.css',
  'app/assets/css/theme.css',
  'app/assets/css/components.css',
]

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const sourceUrl = (path: string) => `/registry/source/${path}.txt`
const markdownUrl = (route: string) => `/registry${route}.md`
const allowedSource = /^(app\/(components\/ui|composables|utils|assets\/css)\/)[\w./-]+$/

async function walk(root: string, dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) files.push(...await walk(root, path))
    else if (!entry.name.startsWith('_')) files.push(path)
  }
  return files.sort()
}

function imports(source: string, path: string): string[] {
  if (path.endsWith('.css')) {
    return [...source.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(match => match[1]!)
  }
  const scripts = path.endsWith('.vue')
    ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]!).join('\n')
    : source
  return ts.preProcessFile(scripts, true, true).importedFiles.map(file => file.fileName)
}

/** Resolve the complete import graph, plus non-imported dependencies declared in docs. */
export async function collectFiles(root: string, seeds: string[], extra: Map<string, string[]> = new Map()) {
  const sources = new Map<string, string>()
  const packages = new Set<string>()
  const integration = new Set<string>()
  const pending = [...seeds]
  while (pending.length) {
    const path = posix.normalize(pending.pop()!)
    if (!allowedSource.test(path) || path.includes('/../')) throw new Error(`Unsafe registry path: ${path}`)
    if (sources.has(path)) continue
    const source = await readFile(join(root, path), 'utf8')
    sources.set(path, source)
    pending.push(...(extra.get(path) ?? []))
    for (const specifier of imports(source, path)) {
      if (specifier.startsWith('#')) {
        if (specifier !== '#components') throw new Error(`Unsupported integration ${specifier} in ${path}`)
        integration.add('Nuxt #components: NuxtLink. For Vue/Vite, replace with a RouterLink wrapper supporting the to prop.')
        continue
      }
      if (!specifier.startsWith('.') && !specifier.startsWith('~/') && !specifier.startsWith('@/')) {
        packages.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!)
        continue
      }
      const base = specifier.startsWith('.')
        ? posix.join(posix.dirname(path), specifier)
        : `app/${specifier.slice(2)}`
      let resolved: string | undefined
      for (const candidate of [base, `${base}.ts`, `${base}.vue`, `${base}/index.ts`]) {
        if (!allowedSource.test(posix.normalize(candidate))) throw new Error(`Unsafe import ${specifier} in ${path}`)
        if (await stat(join(root, candidate)).then(value => value.isFile(), () => false)) {
          resolved = candidate
          break
        }
      }
      if (!resolved) throw new Error(`Cannot resolve ${specifier} from ${path}`)
      pending.push(resolved)
    }
  }
  return { sources: new Map([...sources].sort(([a], [b]) => a.localeCompare(b))), packages, integration: [...integration].sort() }
}

/** Static assets: usable on any host, without a live Nitro server or Git access. */
export async function generateRegistry({ root, siteUrl }: { root: string; siteUrl: string }) {
  const origin = new URL(siteUrl).origin
  const output = join(root, 'public/registry')
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    overrides: Record<string, string>
  }
  const docs: Doc[] = []
  for (const file of await walk(root, 'content/docs')) {
    if (!file.endsWith('.md')) continue
    const source = await readFile(join(root, file), 'utf8')
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
    if (!match) throw new Error(`Missing frontmatter: ${file}`)
    const data = parse(match[1]!)
    const route = file.replace(/^content/, '').replace(/\.md$/, '').replace(/\/index$/, '')
    docs.push({ ...data, file, route, source: source.slice(match[0].length) })
  }
  const components = docs.filter((doc): doc is Doc & { component: string } => !!doc.component)
  const extra = new Map(components.map(doc => [`app/components/ui/${doc.component}.vue`, doc.dependsOn ?? []]))
  const demos = new Map((await walk(root, 'app/demos')).map(path => [
    posix.basename(path, '.vue').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(), path,
  ]))
  const renderedDocs = new Map<string, string>()
  for (const doc of docs) {
    let markdown = `# ${doc.title}\n\n${doc.description}\n\n${doc.source}`
    for (const match of [...markdown.matchAll(/::component-preview\{name="([^"]+)"[^}]*\}\s*\n::/g)]) {
      const path = demos.get(match[1]!)
      if (!path) throw new Error(`Missing demo ${match[1]} in ${doc.file}`)
      markdown = markdown.replace(match[0], `\nExample (${path}):\n\n\`\`\`vue\n${await readFile(join(root, path), 'utf8')}\n\`\`\`\n`)
    }
    markdown = markdown.replace(/::component-api\s*\n::/g,
      `[Props, events, slots, exposed API (JSON)](${origin}/api/component-meta/${doc.component})`)
    if (doc.component) {
      const descriptions = Object.entries(doc.emitDescriptions ?? {})
      if (descriptions.length) markdown += '\n\n## Event descriptions\n\n' + descriptions.map(([name, description]) => `- \`${name}\`: ${description}`).join('\n') + '\n'
      markdown += `\n\n[Source files, dependencies and ZIP](${origin}/registry/components/${posix.basename(doc.route)}.json)\n`
    }
    // All links remain usable when a client reads this as plain text outside the site.
    markdown = markdown.replace(/\]\((\/(?!\/)[^)]*)\)/g, `](${origin}$1)`)
    renderedDocs.set(doc.route, markdown)
  }

  await rm(output, { recursive: true, force: true })
  async function emit(path: string, content: string | Uint8Array) {
    const target = join(root, 'public', path.replace(/^\//, ''))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  for (const doc of docs) await emit(markdownUrl(doc.route), renderedDocs.get(doc.route)!)

  const items: RegistryItem[] = []
  const downloads: Record<string, RegistryDownload> = {}
  const allSources = new Map<string, string>()
  for (const doc of components) {
    const name = posix.basename(doc.route)
    const item: RegistryItem = {
      name, component: doc.component, title: doc.title, description: doc.description,
      status: doc.status ?? 'stable', docs: doc.route, markdown: markdownUrl(doc.route),
      api: `/api/component-meta/${doc.component}`,
      registry: `/registry/components/${name}.json`, download: `/registry/downloads/${name}.zip`,
    }
    const graph = await collectFiles(root, [`app/components/ui/${doc.component}.vue`, ...foundationFiles], extra)
    const dependencies: Record<string, string> = {}
    const peerDependencies: Record<string, string> = { vue: pkg.dependencies.vue!, tailwindcss: '^4.0.0' }
    for (const name of [...graph.packages].sort()) {
      if (name === 'vue') continue
      const version = pkg.dependencies[name]
      if (!version) throw new Error(`Undeclared registry package ${name} in ${doc.component}`)
      dependencies[name] = version
    }
    // TipTap peers need one pinned core/ProseMirror instance even when only imported transitively.
    const overrides = Object.fromEntries(Object.entries(pkg.overrides ?? {}).filter(([name]) =>
      name in dependencies || (name.startsWith('@tiptap/') && [...graph.packages].some(pkg => pkg.startsWith('@tiptap/'))),
    ))
    for (const [name, version] of Object.entries(overrides)) dependencies[name] = version
    const files: RegistryFile[] = [...graph.sources].map(([path, content]) => ({
      path, url: sourceUrl(path), sha256: hash(content), content,
    }))
    for (const [path, content] of graph.sources) allSources.set(path, content)
    const revision = hash(JSON.stringify({ files, dependencies, peerDependencies, overrides }))
    const entry: RegistryComponent = {
      ...item, schemaVersion: 1, revision, dependencies, peerDependencies, overrides,
      integration: graph.integration, files,
    }
    downloads[name] = {
      name, download: item.download, registry: item.registry, markdown: item.markdown, dependencies,
      files: files.map(({ path, url }) => ({ path, url })),
    }
    await emit(item.registry, JSON.stringify(entry, null, 2) + '\n')
    const archive: Record<string, Uint8Array> = Object.fromEntries(files.map(file => [file.path, strToU8(file.content)]))
    archive['registry.json'] = strToU8(JSON.stringify(entry, null, 2))
    const bundledDocs = docs.filter(page => !page.component || graph.sources.has(`app/components/ui/${page.component}.vue`))
    for (const page of bundledDocs) archive[page.file] = strToU8(renderedDocs.get(page.route)!)
    archive['README.md'] = strToU8(`# tatetUI / ${doc.title}\n\n${doc.description}\n\n` +
      `Read content/docs/agents.md and content/docs/copy-guide.md before copying files.\n` +
      `Copy only missing files into your project; review existing files before replacing them.\n` +
      `Paths use Nuxt 4 app/. In Nuxt 3 or Vue/Vite, adjust the source root and aliases.\n` +
      `Import tokens.css, theme.css, components.css into your Tailwind v4 CSS entry point.\n` +
      `Install dependencies listed in registry.json and apply its overrides.\n` +
      `Integration: ${graph.integration.join(' ')}\n\nDocumentation: ${origin}${doc.route}\nRevision: ${revision}\n`)
    await emit(item.download, zipSync(archive, { level: 6, mtime: new Date('2020-01-01T00:00:00Z') }))
    items.push(item)
  }
  for (const [path, source] of allSources) await emit(sourceUrl(path), source)
  await emit('/registry/downloads.json', JSON.stringify(downloads) + '\n')
  await emit('/registry/index.json', JSON.stringify({ schemaVersion: 1, name: 'tatetUI',
    description: 'Vue 3.5 / Nuxt 4 / Tailwind CSS 4. Copy components with their complete dependency graph.',
    guide: '/docs/agents', llms: '/llms.txt', components: items,
  }, null, 2) + '\n')
  const links = items.map(item => `- [${item.component}](${origin}${item.markdown}): ${item.description} Status: ${item.status}. Registry: ${origin}${item.registry}`).join('\n')
  await emit('/llms.txt', `# tatetUI\n\n> Copy-first Vue 3.5 / Nuxt 4 UI components. No Git checkout required.\n\n` +
    `## Start here\n\n- [Agent integration guide](${origin}/registry/docs/agents.md)\n` +
    `- [Component catalog (JSON)](${origin}/registry/index.json)\n` +
    `- [All documentation and examples](${origin}/llms-full.txt)\n` +
    `- [Design tokens](${origin}/registry/docs/foundations/tokens.md)\n\n` +
    `Each component registry JSON includes source files, SHA-256 hashes, external dependencies, integration notes and a ZIP URL.\n` +
    `All paths in registry JSON are relative to this site's origin. Fetch them from ${origin}.\n` +
    `Use the site's API JSON links for props/events/slots; Markdown includes usage and real example source.\n` +
    `Start with Tailwind CSS 4; Tailwind 3 and Vue/Vite require the adaptations described in the guide.\n\n## Components\n\n${links}\n`)
  await emit('/llms-full.txt', docs.map(doc => `${renderedDocs.get(doc.route)}\n\nSource: ${origin}${doc.route}`).join('\n\n---\n\n'))
  return items
}
