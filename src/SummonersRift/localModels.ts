// Models for the editor's inventory.
//
// On the developer's machine they come from the local models folder, through the dev server (see
// vite.config.ts). On the live site there is no such folder: the list, a picture of each model and the
// models themselves are in the model pack, a repository served through the jsDelivr CDN. Only the
// pictures and the list are loaded up front. A model is downloaded when someone drops it on the map.
// The few that already ship with the site (public/models/rift) load from the site itself.
import { BUNDLED_MODELS } from './modelPack.generated'

// Pinned to a version (a tag of the repository) so that the CDN never serves a list that does not match the
// models. When models are added: build the pack, push it, tag it v2, and change the two v1 here.
export const PACK_URL = 'https://cdn.jsdelivr.net/gh/LongpanZhou/league-of-legends-models@v1/'
// The CDN does not serve files over 20 MB from a repository; the few champions that big come straight from it
const RAW_URL = 'https://raw.githubusercontent.com/LongpanZhou/league-of-legends-models/v1/'
const CDN_FILE_LIMIT = 19.5e6

export interface LocalModel {
  path: string // relative to the folder, with forward slashes
  size: number
  side?: 'order' | 'chaos' // read from inside the file by the dev route
  thumb?: string // a picture of the model (live site only: in development it is drawn from the model)
}

export interface DescribedModel {
  key: string
  label: string // the file name without .glb, exactly as it is
  team?: 'order' | 'chaos' // Order is the blue side, Chaos the red side
  group: 'Structures' | 'Monsters' | 'Minions' | 'Champions'
  url: string
  height: number // how tall it is made in the scene, in world units; resizing a type changes it
}

// Where a model is loaded from. In development: the local folder, through the dev route. On the live
// site: the copy that ships with the site if there is one (public/models/rift, flat: just the file name),
// otherwise the model pack.
export const isBundled = (path: string) => !path.includes('/') && BUNDLED_MODELS.has(path)
function modelUrl(path: string): string {
  if (import.meta.env.DEV) return '/__local-models/file/' + path.split('/').map(encodeURIComponent).join('/')
  if (isBundled(path)) return `${import.meta.env.BASE_URL}models/rift/${encodeURIComponent(path)}`
  // The pack keeps the folders of the models folder (models/champions/...)
  const inPack = 'models/' + path.split('/').map(encodeURIComponent).join('/')
  return (knownSizes.get(path) ?? 0) > CDN_FILE_LIMIT ? RAW_URL + inPack : PACK_URL + inPack
}

// How big each model in the list is, so a download can show how far it has got
const knownSizes = new Map<string, number>()

/** Downloads a model ahead of its use, reporting how far it has got (0..1). The browser keeps it, so the
 *  loader that places it on the map does not fetch it again. Returns false if it could not be fetched. */
export async function downloadModel(path: string, onProgress: (fraction: number) => void): Promise<boolean> {
  try {
    const response = await fetch(modelUrl(path))
    if (!response.ok || !response.body) return false
    const total = knownSizes.get(path) ?? (Number(response.headers.get('content-length')) || 0)
    const reader = response.body.getReader()
    let got = 0
    onProgress(0)
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      got += value.length
      if (total) onProgress(Math.min(0.99, got / total))
    }
    onProgress(1)
    return true
  } catch {
    return false
  }
}

// Works out a name, a group and a sensible height from the file's path alone.
export function describeLocalModel(path: string, side?: 'order' | 'chaos'): DescribedModel {
  const file = path.split('/').pop() ?? path
  const base = file.replace(/\.glb$/i, '')
  const lower = base.toLowerCase()
  // The real file name. Nothing is reworded or title-cased.
  const label = base
  // The side the file itself declares, or else the one in its name (minion_melee_order)
  const team = side ?? (/(^|[_-])order($|[_-])/.test(lower) ? 'order' : /(^|[_-])chaos($|[_-])/.test(lower) ? 'chaos' : undefined)

  let group: DescribedModel['group'] = 'Monsters'
  let height = 2
  if (path.toLowerCase().startsWith('champions/')) {
    group = 'Champions'
    height = 2.4
  } else if (lower.startsWith('minion')) {
    group = 'Minions'
    height = 1.2
  } else if (lower.includes('nexus')) {
    group = 'Structures'
    height = 8
  } else if (/turret|tower|inhib/.test(lower)) {
    group = 'Structures'
    height = 7
  } else if (lower.includes('baron')) {
    height = 7.5
  } else if (/herald|atakhan/.test(lower)) {
    height = 4
  } else if (lower.includes('dragon')) {
    height = 2.4
  }

  return {
    key: `file:${path}`,
    label,
    team,
    group,
    url: modelUrl(path),
    height,
  }
}

// Every model that can be put on the map. In development: the models folder (the dev route). On the live
// site: the model pack's list. Empty when neither can be reached.
export async function fetchLocalModels(): Promise<LocalModel[]> {
  try {
    if (!import.meta.env.DEV) {
      const response = await fetch(`${PACK_URL}models.json`)
      if (!response.ok) return []
      const pack = (await response.json()) as { models?: { path: string; size: number; side?: 'order' | 'chaos'; thumb?: string | null }[] }
      return (pack.models ?? []).map((m) => {
        knownSizes.set(m.path, m.size)
        return { path: m.path, size: m.size, side: m.side, thumb: m.thumb ? PACK_URL + m.thumb : undefined }
      })
    }
    const response = await fetch('/__local-models/list')
    if (!response.ok) return []
    const list: unknown = await response.json()
    return Array.isArray(list) ? (list as LocalModel[]) : []
  } catch {
    return []
  }
}
