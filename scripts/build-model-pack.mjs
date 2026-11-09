// Builds the model pack that the live site downloads from: the models, a small picture of each, and
// models.json (the list the editor reads). Run it whenever models are added to the modelviewer folder.
//
//   1. bun run dev                          (the pictures are drawn by the site's own preview renderer)
//   2. npm i --no-save playwright-core      (a browser to draw them in; Chrome must be installed)
//   3. node scripts/build-model-pack.mjs ../league-of-legends-models
//
// The argument is a clone of the league-of-legends-models repository. The script fills it:
//   models/<name>.glb   the models at the top of modelviewer, and models/champions/<name>.glb for the
//                       champions folder
//   thumbs/<name>.png   a picture of each (thumbs/champions/<name>.png for the champions)
//   models.json         [{ path, size, side, thumb, bundled }] for every model
// and writes src/SummonersRift/modelPack.generated.ts (which models already ship with the site in
// public/models/rift, so they are not downloaded again). Commit and push the pack repository after.

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const out = path.resolve(process.argv[2] ?? '../league-of-legends-models')
const site = process.cwd()
const origin = process.env.SITE_ORIGIN ?? 'http://localhost:5173'
const chrome = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const list = await (await fetch(`${origin}/__local-models/list`)).json()
// Everything at the top of the folder, and the champions folder
const top = list.filter((m) => m.path.toLowerCase().endsWith('.glb') && (!m.path.includes('/') || m.path.startsWith('champions/')))

const bundledDir = path.join(site, 'public', 'models', 'rift')
const bundled = new Set(fs.existsSync(bundledDir) ? fs.readdirSync(bundledDir).filter((f) => f.endsWith('.glb')) : [])

const browser = await chromium.launch({
  executablePath: chrome,
  headless: false,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 400, height: 300 } })
await page.goto(origin, { waitUntil: 'domcontentloaded' })

const manifest = []
let failed = 0
for (const m of top) {
  fs.mkdirSync(path.dirname(path.join(out, 'models', m.path)), { recursive: true })
  fs.mkdirSync(path.dirname(path.join(out, 'thumbs', m.path)), { recursive: true })
  fs.copyFileSync(path.join(site, 'modelviewer', m.path), path.join(out, 'models', m.path))
  const name = m.path.replace(/\.glb$/i, '')
  let thumb = null
  // A picture that was already made is kept (so a run that stopped halfway can be run again); set REDRAW=1 to draw them all again
  if (!process.env.REDRAW && fs.existsSync(path.join(out, 'thumbs', `${name}.png`))) {
    thumb = `thumbs/${name}.png`
    manifest.push({ path: m.path, size: m.size, ...(m.side ? { side: m.side } : {}), thumb, bundled: bundled.has(m.path) })
    process.stdout.write(`${manifest.length}/${top.length}`)
    continue
  }
  const dataUrl = await page.evaluate(async (url) => {
    const mod = await import('/src/SummonersRift/modelPreview.ts')
    return mod.getPreview(url)
  }, `/__local-models/file/${m.path.split('/').map(encodeURIComponent).join('/')}`)
  if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
    fs.writeFileSync(path.join(out, 'thumbs', `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))
    thumb = `thumbs/${name}.png`
  } else {
    failed++
    console.log('no picture for', m.path)
  }
  manifest.push({ path: m.path, size: m.size, ...(m.side ? { side: m.side } : {}), thumb, bundled: bundled.has(m.path) })
  process.stdout.write(`\r${manifest.length}/${top.length}`)
}
await browser.close()

fs.writeFileSync(path.join(out, 'models.json'), JSON.stringify({ version: 1, models: manifest }))
fs.writeFileSync(
  path.join(site, 'src', 'SummonersRift', 'modelPack.generated.ts'),
  `// Written by scripts/build-model-pack.mjs. The models that ship with the site (public/models/rift) and\n// so are not downloaded from the model pack.\nexport const BUNDLED_MODELS: ReadonlySet<string> = new Set(${JSON.stringify([...bundled].sort())})\n`,
)
console.log(`\n${manifest.length} models, ${failed} without a picture, ${(top.reduce((n, m) => n + m.size, 0) / 1e6).toFixed(0)} MB`)
