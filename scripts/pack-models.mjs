// Repacks the models in public/models/rift so they download smaller, without changing what they hold.
// Needs (not kept in package.json): npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
// Run: node scripts/pack-models.mjs <folder of source .glb> public/models/rift
//
// Textures go from PNG to lossless WebP, geometry and animation through meshopt's exact (unquantized)
// codec. Each output is read back and compared with its source value by value; a file that differs in
// any way is reported and not written.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import sharp from 'sharp'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { dedup } from '@gltf-transform/functions'
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const [src, out] = process.argv.slice(2)
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const raw = async (buf) => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const gz = (b) => zlib.gzipSync(b, { level: 6 }).length

// Everything a model is made of, as comparable values
const describe = async (doc) => {
  const root = doc.getRoot()
  const acc = (a) => (a ? Buffer.from(a.getArray().buffer, a.getArray().byteOffset, a.getArray().byteLength).toString('base64') + `|${a.getType()}|${a.getComponentType()}|${a.getNormalized()}` : null)
  // The index codec may start a triangle at another of its corners (a,b,c -> b,c,a): the same triangle,
  // facing the same way. Each triangle is compared starting from its lowest corner.
  const tris = (p) => {
    const ix = p.getIndices()
    if (!ix) return null
    if (p.getMode() !== 4) return acc(ix)
    const v = Uint32Array.from(ix.getArray())
    for (let i = 0; i + 2 < v.length; i += 3) {
      const [x, y, z] = [v[i], v[i + 1], v[i + 2]]
      const best = [[x, y, z], [y, z, x], [z, x, y]].sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2])[0]
      v.set(best, i)
    }
    return Buffer.from(v.buffer).toString('base64')
  }
  const images = []
  for (const t of root.listTextures()) {
    const r = await raw(Buffer.from(t.getImage()))
    images.push({ name: t.getName(), w: r.info.width, h: r.info.height, px: r.data.toString('base64') })
  }
  return JSON.stringify({
    images,
    nodes: root.listNodes().map((n) => [n.getName(), n.getTranslation(), n.getRotation(), n.getScale(), n.listChildren().length, n.getMesh()?.getName() ?? null, n.getSkin()?.getName() ?? null]),
    meshes: root.listMeshes().map((m) => [m.getName(), m.listPrimitives().map((p) => [p.getMode(), p.getMaterial()?.getName() ?? null, tris(p), p.listSemantics().map((s) => [s, acc(p.getAttribute(s))])])]),
    skins: root.listSkins().map((s) => [s.getName(), s.listJoints().map((j) => j.getName()), acc(s.getInverseBindMatrices())]),
    anims: root.listAnimations().map((a) => [a.getName(), a.listChannels().map((c) => [c.getTargetNode()?.getName(), c.getTargetPath(), c.getSampler().getInterpolation(), acc(c.getSampler().getInput()), acc(c.getSampler().getOutput())])]),
    materials: root.listMaterials().map((m) => [m.getName(), m.getAlphaMode(), m.getAlphaCutoff(), m.getDoubleSided(), m.getBaseColorFactor(), m.getBaseColorTexture()?.getName() ?? null, m.listExtensions().map((e) => e.extensionName)]),
  })
}

fs.mkdirSync(out, { recursive: true })
let before = 0, after = 0, gzBefore = 0, gzAfter = 0
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.glb'))) {
  const srcBuf = fs.readFileSync(path.join(src, f))
  const doc = await io.readBinary(new Uint8Array(srcBuf))
  const want = await describe(doc)
  let webp = 0
  for (const t of doc.getRoot().listTextures()) {
    if (t.getMimeType() !== 'image/png') continue
    const png = Buffer.from(t.getImage())
    const w = await sharp(png).webp({ lossless: true, effort: 6, exact: true }).toBuffer()
    const a = await raw(png), b = await raw(w)
    if (a.info.width === b.info.width && a.info.height === b.info.height && a.data.equals(b.data) && w.length < png.length) {
      t.setImage(new Uint8Array(w)).setMimeType('image/webp')
      webp++
    }
  }
  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR] }))
  if (webp) doc.createExtension(EXTTextureWebP).setRequired(true)
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  const packed = Buffer.from(await io.writeBinary(doc))
  const got = await describe(await io.readBinary(new Uint8Array(packed)))
  const same = got === want
  if (same) fs.writeFileSync(path.join(out, f), packed)
  before += srcBuf.length; after += packed.length
  const g0 = gz(srcBuf), g1 = gz(packed)
  gzBefore += g0; gzAfter += g1
  console.log(`${f.padEnd(24)} ${(srcBuf.length / 1e6).toFixed(2).padStart(6)} -> ${(packed.length / 1e6).toFixed(2).padStart(6)} MB   gz ${(g0 / 1e6).toFixed(2).padStart(5)} -> ${(g1 / 1e6).toFixed(2).padStart(5)}   webp ${webp}   ${same ? 'identical' : 'DIFFERS, not written'}`)
}
console.log(`TOTAL ${(before / 1e6).toFixed(1)} -> ${(after / 1e6).toFixed(1)} MB, gzipped ${(gzBefore / 1e6).toFixed(1)} -> ${(gzAfter / 1e6).toFixed(1)} MB`)
