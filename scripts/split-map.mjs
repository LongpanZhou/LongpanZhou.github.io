// Splits the map so the site can show it before its textures have all arrived.
//
//   node scripts/split-map.mjs            (needs: npm i --no-save sharp)
//
// Reads scripts/rift-opt.glb, the whole map in one file (about 20 MB, most of it textures), and writes:
//   public/rift-lite.glb     the same map with every texture shrunk to a small picture. The site loads
//                            this first and shows it.
//   public/rift-tex/<n>.webp the textures at full size, one file each, byte for byte as they are in the
//                            source file. The site loads them next and swaps each one in (mapTextures.ts).
// <n> is the image's index in the file. Nothing but the pictures inside the .glb is changed: the
// geometry and every other part of it are copied as they are.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SMALL = 256 // the longer side of a shrunk texture, in pixels
const source = path.resolve('scripts/rift-opt.glb')
const liteFile = path.resolve('public/rift-lite.glb')
const texDir = path.resolve('public/rift-tex')

const glb = fs.readFileSync(source)
const jsonLength = glb.readUInt32LE(12)
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'))
const bin = glb.subarray(20 + jsonLength + 8, 20 + jsonLength + 8 + glb.readUInt32LE(20 + jsonLength))

// The buffer that is the file's own binary part: the one with no address of its own that is not a
// stand-in (meshopt leaves an empty stand-in buffer for readers that cannot decode it)
const own = json.buffers.findIndex((b) => b.uri === undefined && !b.extensions?.EXT_meshopt_compression?.fallback)

// Every stretch of the binary part that something points at: a buffer view, or the packed data a
// meshopt buffer view points at instead
const parts = []
json.bufferViews.forEach((view, index) => {
  const packed = view.extensions?.EXT_meshopt_compression
  const ref = packed && packed.buffer === own ? packed : view.buffer === own ? view : null
  if (ref) parts.push({ ref, index, bytes: bin.subarray(ref.byteOffset ?? 0, (ref.byteOffset ?? 0) + ref.byteLength) })
})

fs.rmSync(texDir, { recursive: true, force: true })
fs.mkdirSync(texDir, { recursive: true })
let full = 0
let small = 0
for (const [n, image] of json.images.entries()) {
  const part = parts.find((p) => p.index === image.bufferView)
  if (!part || image.mimeType !== 'image/webp') throw new Error(`image ${n} is not a WebP inside the file`)
  fs.writeFileSync(path.join(texDir, `${n}.webp`), part.bytes)
  full += part.bytes.length
  part.bytes = await sharp(part.bytes).resize(SMALL, SMALL, { fit: 'inside' }).webp({ quality: 80, effort: 6 }).toBuffer()
  small += part.bytes.length
}

// The binary part again, with the small pictures in place of the full ones
let offset = 0
const pieces = []
for (const part of parts.sort((a, b) => (a.ref.byteOffset ?? 0) - (b.ref.byteOffset ?? 0))) {
  part.ref.byteOffset = offset
  part.ref.byteLength = part.bytes.length
  const padded = Buffer.alloc(Math.ceil(part.bytes.length / 4) * 4)
  part.bytes.copy(padded)
  pieces.push(padded)
  offset += padded.length
}
json.buffers[own].byteLength = offset
const newBin = Buffer.concat(pieces)
let newJson = Buffer.from(JSON.stringify(json), 'utf8')
newJson = Buffer.concat([newJson, Buffer.alloc((4 - (newJson.length % 4)) % 4, 0x20)])
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0) // "glTF"
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + newJson.length + 8 + newBin.length, 8)
const chunk = (length, type) => {
  const b = Buffer.alloc(8)
  b.writeUInt32LE(length, 0)
  b.writeUInt32LE(type, 4)
  return b
}
fs.writeFileSync(liteFile, Buffer.concat([header, chunk(newJson.length, 0x4e4f534a), newJson, chunk(newBin.length, 0x004e4942), newBin]))

const mb = (n) => (n / 1e6).toFixed(2) + ' MB'
console.log(`source ${mb(glb.length)}: ${json.images.length} textures, ${mb(full)}`)
console.log(`rift-lite.glb ${mb(fs.statSync(liteFile).size)} (textures ${mb(small)}), rift-tex ${mb(full)}`)
