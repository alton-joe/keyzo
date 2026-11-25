// Downloads the built-in house-tour and city-scene photos (Unsplash License) into /public as WebP.
// The list lives in src/features/tour/photos.ts - this script reads the ids straight from that file.
//   node scripts/fetch-tour-photos.mjs           (skips files that already exist)
//   node scripts/fetch-tour-photos.mjs --force
// Behind a TLS-inspecting proxy/antivirus, run with: node --use-system-ca scripts/fetch-tour-photos.mjs
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const force = process.argv.includes('--force')
const src = await fs.readFile(path.join(root, 'src/features/tour/photos.ts'), 'utf8')

const jobs = []
const [libPart, scenePart] = src.split('export const scenes')
for (const m of libPart.matchAll(/id: '([\w-]+)'[^}]*?u: '([\w-]+)'/g)) jobs.push({ dir: 'tour', id: m[1], u: m[2], w: 1600 })
for (const m of scenePart.matchAll(/id: '([\w-]+)', u: '([\w-]+)'/g)) jobs.push({ dir: 'scenes', id: m[1], u: m[2], w: 2000 })

const fetchTo = async (url, file) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      await fs.writeFile(file, Buffer.from(await r.arrayBuffer()))
      return
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((res) => setTimeout(res, 800 * attempt))
    }
  }
}

let done = 0, skipped = 0, failed = 0
const queue = [...jobs]
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let j; (j = queue.shift());) {
    const dir = path.join(root, 'public', j.dir)
    await fs.mkdir(dir, { recursive: true })
    for (const [suffix, w] of [['', j.w], ['-sm', Math.round(j.w / 2)]]) {
      const file = path.join(dir, `${j.id}${suffix}.webp`)
      if (!force && await fs.access(file).then(() => true, () => false)) { skipped++; continue }
      const url = `https://images.unsplash.com/photo-${j.u}?w=${w}&q=${suffix ? 58 : 62}&fm=webp&fit=max`
      try { await fetchTo(url, file); done++ } catch (e) { failed++; console.error(`FAILED ${j.dir}/${j.id}${suffix}: ${e.message}`) }
    }
  }
}))
console.log(`${jobs.length} photos - ${done} downloaded, ${skipped} already present, ${failed} failed`)
process.exitCode = failed ? 1 : 0
