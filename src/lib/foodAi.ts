import { db } from './db'

/**
 * Analisa foto atau deskripsi makanan dengan Gemini (API key gratis dari
 * Google AI Studio). Key disimpan hanya di HP ini (IndexedDB meta) dan tidak
 * ikut file cadangan. Foto dikirim langsung dari HP ke Google, tanpa server kami.
 */
export interface AiSettings { key: string; model: string }

export const DEFAULT_MODEL = 'gemini-flash-latest'
export const KEY_URL = 'https://aistudio.google.com/app/apikey'

export async function getAiSettings(): Promise<AiSettings | undefined> {
  return (await (await db()).get('meta', 'foodAi')) as AiSettings | undefined
}
export async function saveAiSettings(s: AiSettings | null) {
  const d = await db()
  if (s) await d.put('meta', s, 'foodAi')
  else await d.delete('meta', 'foodAi')
}

export interface AiFood { name: string; portion: string; kcal: number; proteinG: number; carbsG: number; fatG: number }
export interface AiResult { items: AiFood[]; note?: string }

const PROMPT = `Kamu ahli gizi Indonesia. Kenali setiap makanan dan minuman yang terlihat di foto atau disebut di deskripsi.
Untuk setiap item, perkirakan porsi (sebut gram atau ukuran rumah tangga, mis. "1 piring (150 g)") dan gizinya untuk porsi itu: kalori (kkal), protein, karbohidrat, lemak (gram).
Pakai nama dalam bahasa Indonesia sehari-hari dan acuan Tabel Komposisi Pangan Indonesia. Perhitungkan minyak goreng dan santan.
Kalau ada yang tidak yakin, tulis singkat di "note" (mis. "porsi nasi sulit dilihat"). Jangan menambah item yang tidak ada.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' }, portion: { type: 'STRING' }, kcal: { type: 'NUMBER' },
          proteinG: { type: 'NUMBER' }, carbsG: { type: 'NUMBER' }, fatG: { type: 'NUMBER' },
        },
        required: ['name', 'portion', 'kcal', 'proteinG', 'carbsG', 'fatG'],
      },
    },
    note: { type: 'STRING' },
  },
  required: ['items'],
}

/** Perkecil foto ke sisi terpanjang 1024 px, JPEG, supaya cepat dan hemat kuota. */
export async function compressImage(file: Blob, max = 1024): Promise<{ data: string; mime: string }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Foto tidak bisa dibaca.'))), 'image/jpeg', 0.8))
  return { data: await toBase64(blob), mime: 'image/jpeg' }
}

async function toBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const clean = (n: unknown) => (typeof n === 'number' && isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0)

/** Rapikan jawaban AI: buang item kosong, angka negatif atau bukan angka jadi 0. */
export function parseAiResult(text: string): AiResult {
  const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { items?: Partial<AiFood>[]; note?: string }
  const items = (raw.items ?? [])
    .filter((x) => typeof x.name === 'string' && x.name.trim())
    .map((x) => ({
      name: x.name!.trim(), portion: String(x.portion ?? '').trim(), kcal: Math.round(clean(x.kcal)),
      proteinG: clean(x.proteinG), carbsG: clean(x.carbsG), fatG: clean(x.fatG),
    }))
  return { items, note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined }
}

export async function analyzeFood(s: AiSettings, input: { image?: { data: string; mime: string }; text?: string }): Promise<AiResult> {
  if (!input.image && !input.text?.trim()) throw new Error('Pilih foto atau tulis makanannya dulu.')
  const parts: unknown[] = [{ text: PROMPT + (input.text?.trim() ? `\n\nDeskripsi dari pengguna: ${input.text.trim()}` : '') }]
  if (input.image) parts.push({ inline_data: { mime_type: input.image.mime, data: input.image.data } })
  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model || DEFAULT_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': s.key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
      }),
    })
  } catch {
    throw new Error('Tidak bisa terhubung ke Gemini. Cek internet.')
  }
  const body = await res.json().catch(() => ({})) as {
    error?: { message?: string; status?: string }
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  }
  if (!res.ok) {
    const st = body.error?.status
    if (res.status === 400 && /API key/i.test(body.error?.message ?? '')) throw new Error('API key Gemini tidak valid. Cek lagi di Info.')
    if (res.status === 403 || st === 'PERMISSION_DENIED') throw new Error('API key Gemini ditolak. Buat key baru di Google AI Studio.')
    if (res.status === 429 || st === 'RESOURCE_EXHAUSTED') throw new Error('Kuota gratis Gemini habis untuk sementara. Coba lagi nanti atau isi manual.')
    if (res.status === 404) throw new Error(`Model "${s.model}" tidak ditemukan. Kosongkan kolom model di Info untuk memakai bawaan.`)
    throw new Error(`Gemini error ${res.status}: ${body.error?.message ?? 'tidak diketahui'}`)
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Gemini tidak memberi jawaban. Coba foto lain atau tulis makanannya.')
  try {
    return parseAiResult(text)
  } catch {
    throw new Error('Jawaban Gemini tidak terbaca. Coba lagi.')
  }
}
