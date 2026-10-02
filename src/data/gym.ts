export interface Exercise {
  name: string
  prescription: string
  sets: number
  cue?: string
}

export const GYM_RULES = [
  '2–3 set, 10–15 repetisi, RPE 6–7 (masih sisa 3–4 repetisi sebelum gagal).',
  'Istirahat 60–90" antar set.',
  'Naikkan beban kecil (1–2,5 kg) kalau semua set terasa ringan 2 sesi berturut-turut.',
  'Hembuskan napas saat fase berat, tarik saat turun. Jangan menahan napas / mengejan.',
]

export const WARMUP = "Pemanasan 5': sepeda statis/jalan treadmill + leg swing, hip circle."
export const COOLDOWN = "Pendinginan 3–5': jalan pelan, jangan langsung duduk/berdiri diam."

export const GYM: Record<'A' | 'B', Exercise[]> = {
  A: [
    { name: 'Goblet squat', prescription: '3x10–12', sets: 3, cue: 'Dumbbell di dada' },
    { name: 'Romanian deadlift dumbbell', prescription: '3x10–12', sets: 3 },
    { name: 'Chest press machine', prescription: '2–3x12', sets: 3 },
    { name: 'Lat pulldown', prescription: '2–3x12', sets: 3 },
    { name: 'Split squat / reverse lunge', prescription: '2x10 per kaki', sets: 2 },
    { name: 'Dead bug', prescription: '2x10 per sisi', sets: 2 },
  ],
  B: [
    { name: 'Leg press', prescription: '3x12–15', sets: 3, cue: 'Beban sedang' },
    { name: 'Hip thrust / glute bridge', prescription: '3x12', sets: 3 },
    { name: 'Seated cable row', prescription: '2–3x12', sets: 3 },
    { name: 'Push-up', prescription: '2x8–12', sets: 2, cue: 'Incline kalau perlu' },
    { name: 'Calf raise', prescription: '3x15', sets: 3, cue: 'Lurus dan tekuk lutut' },
    { name: 'Side plank', prescription: '2x20–30" per sisi', sets: 2, cue: 'Tetap bernapas' },
  ],
}
