/**
 * Generates the static brand assets from one geometry definition:
 *   public/brand/assertly-mark.svg, assertly-mark-dark.svg, and 512px PNGs
 *   app/icon.svg (adaptive favicon), app/apple-icon.png
 * Run: node scripts/build-brand.mjs
 * Keep components/brand/logo.tsx in sync if you change the geometry.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import sharp from "sharp"

const LIGHT = { bg: "#2557D6", fg: "#FFFFFF" }
const DARK = { bg: "#6C97FF", fg: "#0B1020" }

const G = { w: 10, S: [20, 31], V: [31, 42], T: [51, 22], c: [21, 26.5], r: 8.5, cut: 2.4 }
const [cx, cy] = [G.c[0], G.c[1]]
const xs = [cx - G.r, G.S[0] - G.w / 2, G.T[0] + G.w / 2]
const ys = [cy - G.r, G.V[1] + G.w / 2, G.T[1] - G.w / 2]
const tx = +(32 - (Math.min(...xs) + Math.max(...xs)) / 2).toFixed(2)
const ty = +(32 - (Math.min(...ys) + Math.max(...ys)) / 2).toFixed(2)

// Crosshair cut: two 45-degree lines through the disc
const e = G.r + 1.2
const cutPaths = `<path d="M${cx - e} ${cy - e} L${cx + e} ${cy + e}"/><path d="M${cx + e} ${cy - e} L${cx - e} ${cy + e}"/>`
const check = `M${G.S} L${G.V} L${G.T}`

const mark = ({ bg, fg }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Assertly">
  <rect width="64" height="64" rx="15" fill="${bg}"/>
  <g transform="translate(${tx} ${ty})">
    <g fill="${fg}" stroke="${fg}" stroke-width="${G.w}" stroke-linecap="round" stroke-linejoin="round">
      <path d="${check}" fill="none"/>
      <circle cx="${cx}" cy="${cy}" r="${G.r}" stroke="none"/>
    </g>
    <g stroke="${bg}" stroke-width="${G.cut}" fill="none">${cutPaths}</g>
  </g>
</svg>
`

const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <style>.b{fill:${LIGHT.bg}}.g{fill:${LIGHT.fg};stroke:${LIGHT.fg}}.c{stroke:${LIGHT.bg}}@media (prefers-color-scheme:dark){.b{fill:${DARK.bg}}.g{fill:${DARK.fg};stroke:${DARK.fg}}.c{stroke:${DARK.bg}}}</style>
  <rect class="b" width="64" height="64" rx="15"/>
  <g transform="translate(${tx} ${ty})">
    <g class="g" stroke-width="${G.w}" stroke-linecap="round" stroke-linejoin="round">
      <path d="${check}" fill="none"/>
      <circle cx="${cx}" cy="${cy}" r="${G.r}" stroke="none"/>
    </g>
    <g class="c" stroke-width="${G.cut}" fill="none">${cutPaths}</g>
  </g>
</svg>
`

mkdirSync("public/brand", { recursive: true })
writeFileSync("public/brand/assertly-mark.svg", mark(LIGHT))
writeFileSync("public/brand/assertly-mark-dark.svg", mark(DARK))
writeFileSync("app/icon.svg", adaptive)

const png = (svg, size, out) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(out)
await png(mark(LIGHT), 180, "app/apple-icon.png")
await png(mark(LIGHT), 512, "public/brand/assertly-mark-512.png")
await png(mark(DARK), 512, "public/brand/assertly-mark-dark-512.png")

console.log(`brand assets written (glyph offset ${tx}, ${ty})`)
console.log("React path for components/brand/logo.tsx:", { check, cutPaths })
