export interface RegistryFile {
  path: string
  url: string
  sha256: string
  content: string
}

export interface RegistryItem {
  name: string
  component: string
  title: string
  description: string
  status: 'stable' | 'beta' | 'wip'
  docs: string
  markdown: string
  api: string
  registry: string
  download: string
}

export interface RegistryComponent extends RegistryItem {
  schemaVersion: 1
  revision: string
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  overrides: Record<string, string>
  integration: string[]
  files: RegistryFile[]
}

/** Small build-time catalog for the docs UI; never includes component source text. */
export type RegistryDownload = Pick<RegistryComponent, 'name' | 'download' | 'registry' | 'markdown' | 'dependencies'> & {
  files: Pick<RegistryFile, 'path' | 'url'>[]
}
