// Models from the local models folder (served by the dev server only; see vite.config.ts).

export interface LocalModel {
  path: string // relative to the folder, with forward slashes
  size: number
  side?: 'order' | 'chaos' // read from inside the file by the dev route
}

export interface DescribedModel {
  key: string
  label: string // the file name without .glb, exactly as it is
  team?: 'order' | 'chaos' // Order is the blue side, Chaos the red side
  group: 'Structures' | 'Monsters' | 'Minions' | 'Champions'
  url: string
  height: number // how tall it is made in the scene, in world units; resizing a type changes it
}

// In development the files come from the local folder through the dev route. In a build they are the
// copies in public/models/rift, which is flat: just the file name.
const FILE_URL = import.meta.env.DEV ? '/__local-models/file/' : import.meta.env.BASE_URL + 'models/rift/'

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
    url: FILE_URL + (import.meta.env.DEV ? path.split('/') : [file]).map(encodeURIComponent).join('/'),
    height,
  }
}

// Every model in the folder. Empty when the dev route is not there (a build, or no folder).
export async function fetchLocalModels(): Promise<LocalModel[]> {
  try {
    const response = await fetch('/__local-models/list')
    if (!response.ok) return []
    const list: unknown = await response.json()
    return Array.isArray(list) ? (list as LocalModel[]) : []
  } catch {
    return []
  }
}
