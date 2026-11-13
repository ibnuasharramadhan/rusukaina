// Animasi gerakan gym: figur garis sederhana yang bergerak di antara dua pose.
// Dibuat sendiri (bukan gambar pihak lain), jadi bebas dipakai dan tetap jalan offline.
// Koordinat dalam kotak 120 x 100, lantai di y = 94.

export type Pt = [number, number]

/** Tampak samping, menghadap ke kanan. Tangan dan kaki diletakkan langsung; siku dan lutut dihitung. */
export interface SidePose {
  hip: Pt
  /** Arah badan dari pinggul ke bahu: 180 = tegak, 90 = mendatar ke depan, -90 = mendatar ke belakang. */
  torso: number
  hand: Pt
  foot: Pt
  /** Tangan dan kaki sisi jauh; kalau kosong sama dengan sisi dekat. */
  hand2?: Pt
  foot2?: Pt
  /** Ujung jari kaki; kalau ada, telapak digambar dari pergelangan ke titik ini (untuk jinjit). */
  toe?: Pt
}

/** Tampak depan, simetris. Posisi tangan kanan figur (sisi kiri layar); sisi lain dicerminkan. */
export interface FrontPose {
  hand: Pt
}

export type Hold = 'dumbbell' | 'handle' | 'bar'

interface MoveBase {
  label: string
  /** Langkah singkat cara melakukan gerakan. */
  how: string[]
  /** Benda diam di latar: [x1, y1, x2, y2] garis tebal (bangku, sandaran, dinding). */
  props?: [number, number, number, number][]
  hold?: Hold
  /** Titik katrol; kabel digambar dari sini ke tangan. */
  cable?: Pt
  /** Pijakan leg press di kaki, bantalan di pergelangan kaki. */
  plate?: boolean
  pad?: boolean
  /** Satu putaran gerakan (ms). */
  ms?: number
}
export interface SideMove extends MoveBase {
  view: 'side'; a: SidePose; b: SidePose
  /** Arah tekuk lutut: -1 ke depan (berdiri/duduk), 1 untuk posisi tengkurap. */
  knee?: 1 | -1
}
export interface FrontMove extends MoveBase { view: 'front'; seated?: boolean; a: FrontPose; b: FrontPose }
export type Move = SideMove | FrontMove

export const LEN = { torso: 30, neck: 4, head: 6, upper: 16, fore: 15, thigh: 22, shin: 22 }
export const FLOOR = 94

const SEAT = (x1: number, x2: number, y: number): [number, number, number, number] => [x1, y + 4, x2, y + 4]

export const MOVES = {
  gobletSquat: {
    view: 'side', label: 'Goblet squat', hold: 'dumbbell',
    a: { hip: [56, 49], torso: 180, hand: [64, 30], foot: [58, 92] },
    b: { hip: [44, 70], torso: 158, hand: [66, 52], foot: [58, 92] },
    how: ['Pegang dumbel tegak di depan dada, kaki selebar bahu.', 'Turunkan pinggul ke belakang dan bawah seperti mau duduk, dada tetap tegak.', 'Dorong lantai dengan tumit untuk berdiri lagi.'],
  },
  rdl: {
    view: 'side', label: 'Romanian deadlift', hold: 'dumbbell',
    a: { hip: [56, 49], torso: 180, hand: [58, 49], foot: [58, 92] },
    b: { hip: [46, 51], torso: 110, hand: [75, 71], foot: [58, 92] },
    how: ['Berdiri, dumbel di depan paha, lutut sedikit ditekuk.', 'Dorong pinggul ke belakang, dumbel turun dekat kaki, punggung tetap lurus.', 'Berhenti saat paha belakang terasa tertarik, lalu dorong pinggul ke depan untuk berdiri.'],
  },
  chestPress: {
    view: 'side', label: 'Chest press', hold: 'handle', props: [SEAT(30, 58, 62), [36, 66, 32, 30]],
    a: { hip: [42, 62], torso: 176, hand: [58, 40], foot: [66, 92] },
    b: { hip: [42, 62], torso: 176, hand: [72, 38], foot: [66, 92] },
    how: ['Duduk dengan punggung menempel sandaran, pegangan sejajar dada.', 'Dorong ke depan sampai lengan hampir lurus sambil membuang napas.', 'Kembalikan pelan sampai pegangan dekat dada.'],
  },
  pecFly: {
    view: 'front', label: 'Pectoral fly', seated: true, hold: 'handle',
    a: { hand: [26, 34] },
    b: { hand: [54, 36] },
    how: ['Duduk tegak, punggung menempel sandaran, siku sedikit ditekuk.', 'Rapatkan kedua lengan di depan dada seperti memeluk pohon.', 'Buka lagi pelan sampai dada terasa meregang, jangan lewat garis bahu.'],
  },
  latPulldown: {
    view: 'side', label: 'Lat pulldown', hold: 'bar', cable: [56, 0], props: [SEAT(34, 62, 64)],
    a: { hip: [48, 64], torso: 176, hand: [56, 6], foot: [70, 92] },
    b: { hip: [48, 64], torso: 172, hand: [58, 32], foot: [70, 92] },
    how: ['Duduk, paha terkunci di bawah bantalan, pegang bar sedikit lebih lebar dari bahu.', 'Tarik bar ke dada atas sambil menurunkan siku ke samping badan.', 'Rapatkan tulang belikat sebentar, lalu naikkan bar pelan.'],
  },
  seatedRow: {
    view: 'side', label: 'Seated row', hold: 'handle', cable: [104, 50], props: [SEAT(22, 56, 70), [82, 68, 82, 92]],
    a: { hip: [40, 70], torso: 180, hand: [70, 48], foot: [80, 78] },
    b: { hip: [40, 70], torso: 186, hand: [56, 58], foot: [80, 78] },
    how: ['Duduk tegak, kaki di pijakan, lutut sedikit ditekuk.', 'Tarik pegangan ke perut, siku lurus ke belakang, rapatkan belikat.', 'Luruskan lengan lagi pelan tanpa membungkuk.'],
  },
  shoulderPress: {
    view: 'side', label: 'Shoulder press', hold: 'handle', props: [SEAT(34, 60, 64), [38, 68, 34, 28]],
    a: { hip: [46, 64], torso: 178, hand: [52, 30], foot: [70, 92] },
    b: { hip: [46, 64], torso: 178, hand: [50, 4], foot: [70, 92] },
    how: ['Duduk tegak, pegangan setinggi bahu.', 'Dorong ke atas sampai lengan hampir lurus sambil membuang napas.', 'Turunkan pelan sampai pegangan sejajar dagu.'],
  },
  lateralRaise: {
    view: 'front', label: 'Lateral raise', hold: 'dumbbell',
    a: { hand: [48, 52] },
    b: { hand: [22, 24] },
    how: ['Berdiri, dumbel di samping paha, siku sedikit ditekuk.', 'Angkat ke samping sampai setinggi bahu, telapak menghadap lantai.', 'Turunkan pelan, jangan mengayun badan.'],
  },
  kickback: {
    view: 'side', label: 'Triceps kickback', hold: 'dumbbell', props: [[84, 70, 112, 70]],
    a: { hip: [50, 52], torso: 115, hand: [63, 62], foot: [52, 92] },
    b: { hip: [50, 52], torso: 115, hand: [48, 47], foot: [52, 92] },
    how: ['Badan condong ke depan, satu tangan bertumpu, lengan atas menempel di badan.', 'Luruskan siku ke belakang sampai lengan lurus.', 'Tekuk lagi pelan; lengan atas tetap diam.'],
  },
  pushdown: {
    view: 'side', label: 'Cable pushdown', hold: 'handle', cable: [68, 0],
    a: { hip: [50, 49], torso: 172, hand: [64, 28], foot: [52, 92] },
    b: { hip: [50, 49], torso: 172, hand: [58, 50], foot: [52, 92] },
    how: ['Berdiri dekat kabel, siku menempel di samping badan.', 'Dorong tali atau bar ke bawah sampai lengan lurus.', 'Naikkan pelan sampai lengan bawah sejajar lantai; siku tidak ikut bergerak.'],
  },
  pushup: {
    view: 'side', label: 'Push-up',
    a: { hip: [72, 74], torso: -119, hand: [46, 91], foot: [112, 91] },
    b: { hip: [74, 84], torso: -100, hand: [46, 91], foot: [112, 91] },
    how: ['Tangan sedikit lebih lebar dari bahu, badan lurus dari kepala ke tumit.', 'Turunkan dada mendekati lantai, siku sekitar 45° dari badan.', 'Dorong naik lagi. Terlalu berat: tangan di bangku (incline) atau lutut di lantai.'],
  },
  legPress: {
    view: 'side', label: 'Leg press', plate: true, props: [[22, 50, 46, 72], SEAT(36, 60, 66)],
    a: { hip: [42, 68], torso: -140, hand: [34, 70], foot: [62, 50] },
    b: { hip: [42, 68], torso: -140, hand: [34, 70], foot: [78, 44] },
    how: ['Punggung menempel sandaran, kaki di pijakan selebar pinggul.', 'Dorong pijakan sampai kaki hampir lurus; lutut jangan dikunci.', 'Tekuk lagi pelan sampai lutut sekitar 90°.'],
  },
  legExtension: {
    view: 'side', label: 'Leg extension', pad: true, props: [SEAT(34, 70, 58), [38, 62, 34, 26]],
    a: { hip: [46, 60], torso: 182, hand: [50, 58], foot: [70, 82] },
    b: { hip: [46, 60], torso: 182, hand: [50, 58], foot: [90, 58] },
    how: ['Duduk, lutut di ujung kursi, bantalan di depan pergelangan kaki.', 'Luruskan kaki ke depan sampai hampir lurus, tahan sebentar.', 'Turunkan pelan; jangan menghentak.'],
  },
  legCurl: {
    view: 'side', label: 'Lying leg curl', pad: true, knee: 1, props: [[20, 68, 92, 68]],
    a: { hip: [60, 64], torso: -90, hand: [24, 70], foot: [104, 64] },
    b: { hip: [60, 64], torso: -90, hand: [24, 70], foot: [84, 44] },
    how: ['Tengkurap, lutut tepat di ujung bangku, bantalan di atas tumit.', 'Tekuk lutut, tarik tumit ke arah bokong.', 'Luruskan lagi pelan; pinggul tetap menempel bangku.'],
  },
  wallSit: {
    view: 'side', label: 'Wall sit', props: [[34, 0, 34, 94]],
    a: { hip: [40, 66], torso: 180, hand: [56, 64], foot: [62, 92] },
    b: { hip: [40, 63], torso: 180, hand: [56, 61], foot: [62, 89], toe: [69, 93] },
    how: ['Punggung menempel dinding, turun sampai paha hampir sejajar lantai.', 'Lutut di atas pergelangan kaki, tahan sambil tetap bernapas.', 'Variasi jinjit: angkat tumit pelan lalu turunkan, posisi duduk tetap.'],
    ms: 3000,
  },
  calfRaise: {
    view: 'side', label: 'Calf raise', hold: 'dumbbell',
    a: { hip: [56, 49], torso: 180, hand: [57, 49], foot: [56, 92], toe: [63, 93] },
    b: { hip: [56, 43], torso: 180, hand: [57, 43], foot: [56, 86], toe: [63, 93] },
    how: ['Berdiri tegak, beban di tangan bila ada.', 'Jinjit setinggi mungkin, tahan 1 detik.', 'Turunkan tumit pelan. Lutut tekuk sedikit untuk melatih otot betis bagian dalam.'],
  },
  splitSquat: {
    view: 'side', label: 'Split squat', hold: 'dumbbell',
    a: { hip: [54, 52], torso: 180, hand: [55, 51], foot: [72, 92], foot2: [32, 90], toe: [79, 93] },
    b: { hip: [52, 68], torso: 180, hand: [53, 67], foot: [72, 92], foot2: [32, 90], toe: [79, 93] },
    how: ['Satu kaki di depan, satu di belakang, badan tegak.', 'Turunkan lutut belakang mendekati lantai, lutut depan di atas pergelangan kaki.', 'Dorong dengan kaki depan untuk naik; ganti kaki setelah satu set.'],
  },
  deadBug: {
    view: 'side', label: 'Dead bug',
    a: { hip: [64, 84], torso: -90, hand: [40, 56], foot: [84, 62], hand2: [40, 56], foot2: [84, 62] },
    b: { hip: [64, 84], torso: -90, hand: [16, 82], foot: [84, 62], hand2: [40, 56], foot2: [106, 82] },
    how: ['Telentang, lengan lurus ke atas, lutut 90° di atas pinggul.', 'Turunkan satu lengan ke belakang kepala dan kaki seberangnya ke depan.', 'Punggung bawah tetap menempel lantai; kembali lalu ganti sisi.'],
  },
  hipThrust: {
    view: 'side', label: 'Glute bridge',
    a: { hip: [56, 88], torso: -90, hand: [44, 92], foot: [76, 92] },
    b: { hip: [56, 72], torso: -60, hand: [44, 92], foot: [76, 92] },
    how: ['Telentang, lutut ditekuk, telapak kaki di lantai.', 'Angkat pinggul sampai badan lurus dari bahu ke lutut, kencangkan bokong.', 'Turunkan pelan.'],
  },
  sidePlank: {
    view: 'side', label: 'Side plank',
    a: { hip: [72, 82], torso: -102, hand: [58, 90], foot: [104, 90] },
    b: { hip: [72, 75], torso: -90, hand: [58, 90], foot: [104, 90] },
    how: ['Berbaring miring, siku tepat di bawah bahu.', 'Angkat pinggul sampai badan lurus dari kepala ke kaki.', 'Tahan sambil tetap bernapas, lalu ganti sisi.'],
    ms: 3200,
  },
} satisfies Record<string, Move>

export type MoveId = keyof typeof MOVES

const MATCH: [RegExp, MoveId][] = [
  [/split squat|lunge/i, 'splitSquat'],
  [/goblet|squat/i, 'gobletSquat'],
  [/romanian|rdl|deadlift/i, 'rdl'],
  [/pec(toral)?\s*fly|butterfly|chest fly/i, 'pecFly'],
  [/chest press|bench press/i, 'chestPress'],
  [/lat pull|pulldown/i, 'latPulldown'],
  [/row/i, 'seatedRow'],
  [/lateral raise|kepak/i, 'lateralRaise'],
  [/kickback/i, 'kickback'],
  [/push\s*down|tricep.*(kabel|cable)/i, 'pushdown'],
  [/shoulder press|overhead press|military/i, 'shoulderPress'],
  [/push[\s-]*up/i, 'pushup'],
  [/leg press/i, 'legPress'],
  [/leg ext/i, 'legExtension'],
  [/leg curl|hamstring curl/i, 'legCurl'],
  [/wall sit/i, 'wallSit'],
  [/calf|betis/i, 'calfRaise'],
  [/dead bug/i, 'deadBug'],
  [/hip thrust|glute bridge|bridge/i, 'hipThrust'],
  [/side plank/i, 'sidePlank'],
]

/** Cari animasi dari nama latihan, juga untuk latihan tambahan yang diketik sendiri. */
export function matchMove(name: string): MoveId | undefined {
  return MATCH.find(([re]) => re.test(name))?.[1]
}

// ---- Geometri ----

const rad = (d: number) => (d * Math.PI) / 180
export const dir = (deg: number): Pt => [Math.sin(rad(deg)), Math.cos(rad(deg))]
const add = (p: Pt, v: Pt, k = 1): Pt => [p[0] + v[0] * k, p[1] + v[1] * k]

/** Sendi tengah dua ruas (siku/lutut). bend: +1 atau -1 memilih sisi tekukan. */
export function joint(root: Pt, end: Pt, l1: number, l2: number, bend: 1 | -1): Pt {
  const dx = end[0] - root[0], dy = end[1] - root[1]
  const d = Math.min(Math.max(Math.hypot(dx, dy), 0.01), l1 + l2 - 0.01)
  const cos = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
  const a = Math.acos(cos) * bend
  const ux = dx / Math.hypot(dx, dy || 0.01), uy = dy / Math.hypot(dx, dy || 0.01)
  return [root[0] + l1 * (ux * Math.cos(a) - uy * Math.sin(a)), root[1] + l1 * (ux * Math.sin(a) + uy * Math.cos(a))]
}

export interface SideBody {
  hip: Pt; shoulder: Pt; head: Pt
  elbow: Pt; hand: Pt; knee: Pt; foot: Pt; toe: Pt
  elbow2: Pt; hand2: Pt; knee2: Pt; foot2: Pt; toe2: Pt
}

function toeOf(foot: Pt, knee: Pt, toe?: Pt): Pt {
  if (toe) return toe
  // Telapak kira-kira tegak lurus tulang kering, mengarah ke depan.
  const sx = foot[0] - knee[0], sy = foot[1] - knee[1], l = Math.hypot(sx, sy) || 1
  const n: Pt = [sy / l, -sx / l]
  return add(foot, n[0] >= 0 ? n : [-n[0], -n[1]], 7)
}

export function sideBody(p: SidePose, kneeBend: 1 | -1 = -1): SideBody {
  const t = dir(p.torso)
  const shoulder = add(p.hip, t, LEN.torso)
  const head = add(shoulder, t, LEN.neck + LEN.head)
  // Lutut menekuk ke arah muka figur, siku ke arah belakang (relatif terhadap badan).
  const elbowBend: 1 | -1 = 1
  const knee = joint(p.hip, p.foot, LEN.thigh, LEN.shin, kneeBend)
  const elbow = joint(shoulder, p.hand, LEN.upper, LEN.fore, elbowBend)
  const hand2 = p.hand2 ?? p.hand, foot2 = p.foot2 ?? p.foot
  const knee2 = joint(p.hip, foot2, LEN.thigh, LEN.shin, kneeBend)
  const elbow2 = joint(shoulder, hand2, LEN.upper, LEN.fore, elbowBend)
  return {
    hip: p.hip, shoulder, head, elbow, hand: p.hand, knee, foot: p.foot, toe: toeOf(p.foot, knee, p.toe),
    elbow2, hand2, knee2, foot2, toe2: toeOf(foot2, knee2, p.foot2 ? undefined : p.toe),
  }
}

export interface FrontBody {
  head: Pt; neck: Pt; pelvis: Pt
  shoulders: [Pt, Pt]; elbows: [Pt, Pt]; hands: [Pt, Pt]
  hips: [Pt, Pt]; knees: [Pt, Pt]; feet: [Pt, Pt]
}

const mirror = (p: Pt): Pt => [120 - p[0], p[1]]

export function frontBody(p: FrontPose, seated = false): FrontBody {
  const hipY = seated ? 62 : 52
  const shY = hipY - LEN.torso
  const sh: Pt = [50, shY]
  const elbow = joint(sh, p.hand, LEN.upper, LEN.fore, 1)
  // Siku selalu di sisi luar.
  const e: Pt = elbow[0] > (sh[0] + p.hand[0]) / 2 ? joint(sh, p.hand, LEN.upper, LEN.fore, -1) : elbow
  const hipL: Pt = [54, hipY], hipR = mirror(hipL)
  const kneeL: Pt = seated ? [52, hipY + 6] : [55, hipY + LEN.thigh]
  const footL: Pt = [54, FLOOR - 2]
  return {
    head: [60, shY - LEN.neck - LEN.head], neck: [60, shY], pelvis: [60, hipY],
    shoulders: [sh, mirror(sh)], elbows: [e, mirror(e)], hands: [p.hand, mirror(p.hand)],
    hips: [hipL, hipR], knees: [kneeL, mirror(kneeL)], feet: [footL, mirror(footL)],
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lp = (a: Pt | undefined, b: Pt | undefined, k: number): Pt | undefined => (a && b ? [lerp(a[0], b[0], k), lerp(a[1], b[1], k)] : a ?? b)

export function mixSide(a: SidePose, b: SidePose, k: number): SidePose {
  return {
    hip: lp(a.hip, b.hip, k)!, torso: lerp(a.torso, b.torso, k), hand: lp(a.hand, b.hand, k)!, foot: lp(a.foot, b.foot, k)!,
    hand2: lp(a.hand2, b.hand2, k), foot2: lp(a.foot2, b.foot2, k), toe: lp(a.toe, b.toe, k),
  }
}

export function mixFront(a: FrontPose, b: FrontPose, k: number): FrontPose {
  return { hand: lp(a.hand, b.hand, k)! }
}
