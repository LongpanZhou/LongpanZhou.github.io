import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react-swc'

// Local models for the rift's layout editor inventory. The dev server (and only the dev server)
// serves every .glb under one folder. The folder lives beside the source tree as ./modelviewer
// (LOCAL_MODELS_DIR overrides it) and is ignored by git, so the files are never committed.
//   GET /__local-models/list        -> [{ path, size, side }] for every .glb, searched recursively
//   GET /__local-models/file/<path> -> that file
function localModels(): Plugin {
  const dir = path.resolve(process.env.LOCAL_MODELS_DIR ?? path.join(process.cwd(), 'modelviewer'))

  // League calls the blue side Order and the red side Chaos. Many models say which one inside the
  // file, in the names of their materials and parts (SRUAP_OrderNexus_Mat, Cannon_Chaos_Mat), so
  // the side is read from there, once per file.
  const sides = new Map<string, { mtime: number; side?: 'order' | 'chaos' }>()
  const sideOf = (file: string, mtime: number): 'order' | 'chaos' | undefined => {
    const cached = sides.get(file)
    if (cached && cached.mtime === mtime) return cached.side
    let side: 'order' | 'chaos' | undefined
    try {
      const fd = fs.openSync(file, 'r')
      try {
        const head = Buffer.alloc(20)
        fs.readSync(fd, head, 0, 20, 0)
        const length = head.readUInt32LE(12) // the glTF JSON chunk comes first
        const chunk = Buffer.alloc(length)
        fs.readSync(fd, chunk, 0, length, 20)
        const json = JSON.parse(chunk.toString('utf8'))
        const names: string[] = [...(json.materials ?? []), ...(json.nodes ?? []), ...(json.meshes ?? [])].map(
          (item: { name?: string }) => item.name ?? '',
        )
        const order = names.some((n) => /order/i.test(n))
        const chaos = names.some((n) => /chaos/i.test(n))
        side = order && !chaos ? 'order' : chaos && !order ? 'chaos' : undefined
      } finally {
        fs.closeSync(fd)
      }
    } catch {
      // Not a readable GLB: it simply has no side.
    }
    sides.set(file, { mtime, side })
    return side
  }

  const walk = (folder: string, depth = 0): { path: string; size: number; side?: 'order' | 'chaos' }[] => {
    if (depth > 3) return []
    const found: { path: string; size: number; side?: 'order' | 'chaos' }[] = []
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name)
      if (entry.isDirectory()) found.push(...walk(full, depth + 1))
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
        const stat = fs.statSync(full)
        found.push({ path: path.relative(dir, full).split(path.sep).join('/'), size: stat.size, side: sideOf(full, stat.mtimeMs) })
      }
    }
    return found
  }

  return {
    name: 'local-models',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local-models', (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '/').split('?')[0])
        if (url === '/list') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(fs.existsSync(dir) ? walk(dir) : []))
          return
        }
        if (url.startsWith('/file/')) {
          const file = path.resolve(dir, url.slice('/file/'.length))
          // Only .glb files inside the folder, never anything outside it
          const inside = file.startsWith(dir + path.sep) && file.toLowerCase().endsWith('.glb')
          if (!inside || !fs.existsSync(file)) {
            res.statusCode = 404
            res.end('Not found')
            return
          }
          res.setHeader('Content-Type', 'model/gltf-binary')
          fs.createReadStream(file).pipe(res)
          return
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // GLM_API_KEY lives in .env.local and is read here, on the server side only.
  // It isn't VITE_-prefixed, so it never reaches the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), localModels()],
    base: '/',
    server: {
      proxy: {
        // Local dev only: the viewer calls /glm-api and this forwards to GLM with
        // the key attached. GLM's API sends no CORS header, so the browser can't
        // call it directly.
        '/glm-api': {
          target: 'https://api.z.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/glm-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.GLM_API_KEY ?? ''}`)
            })
          },
        },
      },
    },
  }
})
