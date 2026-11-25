// Built-in photo library for house tours and the landing-page city scenes.
// Every photo is a real photograph published under the Unsplash License (free for commercial use, no attribution
// required). `u` is the Unsplash photo id (https://images.unsplash.com/photo-<u>); the files are self-hosted in
// /public/tour and /public/scenes (WebP, `<id>.webp` 1600px wide - 2000px for scenes - and `<id>-sm.webp` at half size for phones).
// Re-download with: node scripts/fetch-tour-photos.mjs
//
// `f` is the focal point in % of the photo: where the camera "walks" toward when leaving the room
// (a doorway, window or the far end of the room).

export type RoomKind = 'exterior' | 'door' | 'hall' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony'
export type HomeStyle = 'apartment' | 'villa' | 'studio'

export type LibraryPhoto = { id: string; room: RoomKind; styles: HomeStyle[]; u: string; f: [number, number]; tag?: string }

const A: HomeStyle[] = ['apartment'], V: HomeStyle[] = ['villa'], S: HomeStyle[] = ['studio']
const AS: HomeStyle[] = ['apartment', 'studio']

export const library: LibraryPhoto[] = [
  // ---- exteriors (one per property, chosen by property id so every unit in a building shares it)
  { id: 'ext-glass', room: 'exterior', styles: A, u: '1624204386084-dd8c05e32226', f: [64, 50], tag: 'Glass balconies at golden hour' },
  { id: 'ext-white', room: 'exterior', styles: A, u: '1600994562666-98dbd6d44e44', f: [52, 55], tag: 'Low-rise blocks among the trees' },
  { id: 'ext-tower', room: 'exterior', styles: A, u: '1651752523215-9bf678c29355', f: [50, 58], tag: 'Modern residential tower' },
  { id: 'ext-brick', room: 'exterior', styles: S, u: '1676680071181-0a0b45968d23', f: [55, 60], tag: 'Brick-clad studio block' },
  { id: 'ext-villa1', room: 'exterior', styles: V, u: '1721989518229-3e84837fc398', f: [50, 52], tag: 'Private villa with pool deck' },
  { id: 'ext-villa2', room: 'exterior', styles: V, u: '1721989519334-40923a0ee1c0', f: [38, 50], tag: 'Tropical garden villa' },
  { id: 'ext-villa3', room: 'exterior', styles: V, u: '1707189856923-46dd41ea2bdc', f: [50, 48], tag: 'Villa lit up at dusk' },

  // ---- front doors (the 3D door-opening effect splits this photo at the focal point)
  { id: 'door-teak', room: 'door', styles: AS, u: '1630543696609-fe4668a4e34d', f: [47, 48] },
  { id: 'door-oak', room: 'door', styles: AS, u: '1691517534724-3732c7621407', f: [42, 42] },
  { id: 'door-blue', room: 'door', styles: AS, u: '1629999400001-5e666f0754d9', f: [60, 45] },
  { id: 'door-glass', room: 'door', styles: V, u: '1668911494256-becf9fea265b', f: [52, 50] },
  { id: 'door-porch', room: 'door', styles: V, u: '1601041597271-71988152f98b', f: [52, 55] },

  // ---- living rooms / halls
  { id: 'hall-boho', room: 'hall', styles: A, u: '1631679706909-1844bbd07221', f: [50, 55] },
  { id: 'hall-grey', room: 'hall', styles: A, u: '1628744876497-eb30460be9f6', f: [52, 48] },
  { id: 'hall-tv', room: 'hall', styles: A, u: '1634045924031-98026a4557c4', f: [42, 48] },
  { id: 'hall-classic', room: 'hall', styles: A, u: '1600121848594-d8644e57abab', f: [50, 45] },
  { id: 'hall-sage', room: 'hall', styles: A, u: '1605774337664-7a846e9cdf17', f: [50, 52] },
  { id: 'hall-pastel', room: 'hall', styles: A, u: '1705321963943-de94bb3f0dd3', f: [45, 50] },
  { id: 'hall-cream', room: 'hall', styles: A, u: '1705326701287-346fc37a2c86', f: [62, 48] },
  { id: 'hall-window', room: 'hall', styles: A, u: '1724582586529-62622e50c0b3', f: [22, 50] },
  { id: 'hall-dining', room: 'hall', styles: V, u: '1773578978637-c9771e7a9913', f: [50, 42] },
  { id: 'hall-glass', room: 'hall', styles: V, u: '1600210492493-0946911123ea', f: [75, 45] },
  { id: 'hall-fireside', room: 'hall', styles: V, u: '1774199496664-a9690967be5a', f: [50, 48] },
  { id: 'hall-rustic', room: 'hall', styles: V, u: '1781794902242-f8578908d640', f: [55, 50] },
  { id: 'hall-grand', room: 'hall', styles: V, u: '1598928506311-c55ded91a20c', f: [50, 45] },
  { id: 'studio-red', room: 'hall', styles: S, u: '1522708323590-d24dbb6b0267', f: [62, 42], tag: 'Open-plan living with kitchenette' },
  { id: 'studio-sofa', room: 'hall', styles: S, u: '1774311237295-a65a4c1ff38a', f: [55, 42] },
  { id: 'studio-desk', room: 'hall', styles: S, u: '1702014862053-946a122b920d', f: [50, 50], tag: 'Living area with workspace' },
  { id: 'studio-loft', room: 'hall', styles: S, u: '1786564026100-7ad7ae7654b2', f: [45, 50] },

  // ---- bedrooms
  { id: 'bed-sunlit', room: 'bedroom', styles: A, u: '1616486029423-aaa4789e8c9a', f: [15, 45] },
  { id: 'bed-white', room: 'bedroom', styles: A, u: '1595526114035-0d45ed16cfbf', f: [72, 45] },
  { id: 'bed-blue', room: 'bedroom', styles: A, u: '1618221118493-9cfa1a1c00da', f: [82, 50] },
  { id: 'bed-airy', room: 'bedroom', styles: A, u: '1598928636135-d146006ff4be', f: [85, 50] },
  { id: 'bed-grey', room: 'bedroom', styles: A, u: '1595526051245-4506e0005bd0', f: [80, 45] },
  { id: 'bed-charcoal', room: 'bedroom', styles: A, u: '1560185893-a55cbc8c57e8', f: [55, 40] },
  { id: 'bed-cosy', room: 'bedroom', styles: A, u: '1774578342100-f779e988c83d', f: [50, 45] },
  { id: 'bed-study', room: 'bedroom', styles: A, u: '1758060215425-303300b1c7e2', f: [42, 40] },
  { id: 'bed-dark', room: 'bedroom', styles: A, u: '1617104678098-de229db51175', f: [82, 50] },
  { id: 'bed-resort', room: 'bedroom', styles: V, u: '1611892440504-42a792e24d32', f: [55, 45], tag: 'Opens to a private garden' },
  { id: 'bed-teak', room: 'bedroom', styles: V, u: '1566665797739-1674de7a421a', f: [50, 45] },
  { id: 'bed-walkin', room: 'bedroom', styles: V, u: '1562438668-bcf0ca6578f0', f: [78, 45], tag: 'Walk-in wardrobe' },
  { id: 'bed-beams', room: 'bedroom', styles: V, u: '1770941633927-b7a15557e0e1', f: [55, 40] },
  { id: 'bed-curve', room: 'bedroom', styles: V, u: '1778731525620-ae459167c176', f: [20, 40] },
  { id: 'bed-panel', room: 'bedroom', styles: V, u: '1696762932825-2737db830bbe', f: [50, 45] },
  { id: 'nook-bright', room: 'bedroom', styles: S, u: '1702014861736-d62834317c5e', f: [50, 45] },
  { id: 'nook-city', room: 'bedroom', styles: S, u: '1620332372374-f108c53d2e03', f: [52, 40], tag: 'Skyline view from the bed' },
  { id: 'nook-bench', room: 'bedroom', styles: S, u: '1633505765486-e404bbbec654', f: [80, 45] },

  // ---- kitchens
  { id: 'kit-modular', room: 'kitchen', styles: A, u: '1596205250168-c3583813eea0', f: [50, 45], tag: 'Modular kitchen' },
  { id: 'kit-compact', room: 'kitchen', styles: AS, u: '1484154218962-a197022b5858', f: [55, 50] },
  { id: 'kit-gloss', room: 'kitchen', styles: A, u: '1588854337236-6889d631faa8', f: [50, 45] },
  { id: 'kit-island', room: 'kitchen', styles: A, u: '1602028915047-37269d1a73f7', f: [55, 45] },
  { id: 'kit-fresh', room: 'kitchen', styles: A, u: '1556911220-bff31c812dba', f: [62, 40] },
  { id: 'kit-shaker', room: 'kitchen', styles: A, u: '1588854337221-4cf9fa96059c', f: [50, 45] },
  { id: 'kit-luxe', room: 'kitchen', styles: V, u: '1632583824020-937ae9564495', f: [50, 45] },
  { id: 'kit-garden', room: 'kitchen', styles: V, u: '1617228069096-4638a7ffc906', f: [30, 40], tag: 'Garden-facing kitchen' },
  { id: 'kit-pendant', room: 'kitchen', styles: V, u: '1771372125074-5c7c4332095f', f: [50, 45] },
  { id: 'kit-marble', room: 'kitchen', styles: V, u: '1682888813913-e13f18692019', f: [60, 45] },
  { id: 'kit-open', room: 'kitchen', styles: V, u: '1628745277862-bc0b2d68c50c', f: [30, 45] },
  { id: 'kit-studio', room: 'kitchen', styles: S, u: '1610527003928-47afd5f470c6', f: [50, 45], tag: 'Kitchenette' },

  // ---- bathrooms / washrooms
  { id: 'bath-glass', room: 'bathroom', styles: A, u: '1584622650111-993a426fbf0a', f: [25, 45] },
  { id: 'bath-round', room: 'bathroom', styles: A, u: '1771681278369-e2a5480b8c29', f: [40, 40] },
  { id: 'bath-vessel', room: 'bathroom', styles: A, u: '1629079447777-1e605162dc8d', f: [22, 45] },
  { id: 'bath-compact', room: 'bathroom', styles: AS, u: '1639751898256-e80ef909ea8d', f: [55, 45] },
  { id: 'bath-bronze', room: 'bathroom', styles: A, u: '1696987007764-7f8b85dd3033', f: [35, 45] },
  { id: 'bath-slate', room: 'bathroom', styles: AS, u: '1704428381342-ea9df943619e', f: [62, 45] },
  { id: 'bath-green', room: 'bathroom', styles: A, u: '1682888818696-906287d759f5', f: [55, 40] },
  { id: 'bath-stone', room: 'bathroom', styles: V, u: '1733426107854-ee00a25d72a7', f: [35, 45] },
  { id: 'bath-slat', room: 'bathroom', styles: V, u: '1631889993959-41b4e9c6e3c5', f: [20, 45] },
  { id: 'bath-sand', room: 'bathroom', styles: V, u: '1781344334947-60c704bafd51', f: [70, 45] },
  { id: 'bath-marble', room: 'bathroom', styles: V, u: '1638799869566-b17fa794c4de', f: [45, 40] },
  { id: 'bath-onyx', room: 'bathroom', styles: V, u: '1742134131017-44d377a611b1', f: [45, 45] },
  { id: 'bath-tub', room: 'bathroom', styles: V, u: '1620626011761-996317b8d101', f: [70, 40] },

  // ---- balconies, terraces and pool decks
  { id: 'bal-skyline', room: 'balcony', styles: AS, u: '1776363116182-51694a04a1d5', f: [45, 45], tag: 'City-view balcony' },
  { id: 'bal-plants', room: 'balcony', styles: AS, u: '1486484290742-0ce4eb743a34', f: [45, 40], tag: 'Balcony garden' },
  { id: 'bal-grille', room: 'balcony', styles: A, u: '1765558290832-f50b7fab8f36', f: [50, 35], tag: 'Flower-lined balcony' },
  { id: 'bal-green', room: 'balcony', styles: A, u: '1759052863124-ceceaa961b00', f: [55, 35], tag: 'Leafy balcony' },
  { id: 'bal-terrace', room: 'balcony', styles: A, u: '1661024768242-5fd7c8f1e3c5', f: [55, 45], tag: 'Garden terrace' },
  { id: 'pool-dusk', room: 'balcony', styles: V, u: '1757924330358-a48d65664dac', f: [50, 45], tag: 'Infinity pool deck' },
  { id: 'pool-palms', room: 'balcony', styles: V, u: '1596178067639-5c6e68aea6dc', f: [45, 55], tag: 'Lap pool under the palms' },
  { id: 'pool-court', room: 'balcony', styles: V, u: '1692736933760-8a8a9b8c1b6f', f: [50, 50], tag: 'Courtyard pool' },
  { id: 'pool-white', room: 'balcony', styles: V, u: '1613152184920-bc1c4ab7fd1d', f: [50, 50], tag: 'Private pool' },
]

/** Landing-page backdrop: real places in the cities Keyzo lists homes in. */
export const scenes = [
  { id: 'bengaluru', u: '1769337953149-f48f1083f0e1', city: 'Bengaluru', caption: 'The Garden City after dark' },
  { id: 'kochi', u: '1593693411515-c20261bcad6e', city: 'Kochi', caption: 'Palm-lined Kerala backwaters' },
  { id: 'chennai', u: '1724992609079-75164f1ba2dd', city: 'Chennai', caption: 'Marina Beach and the Bay of Bengal' },
  { id: 'chennai-temple', u: '1582510003544-4d00b7f74220', city: 'Chennai', caption: 'Temple towers under the evening sky' },
] as const

export const photoSrc = (id: string, small = false) => `/tour/${id}${small ? '-sm' : ''}.webp`
export const sceneSrc = (id: string, small = false) => `/scenes/${id}${small ? '-sm' : ''}.webp`
