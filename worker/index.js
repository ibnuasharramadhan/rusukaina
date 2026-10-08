// Cloudflare Worker kecil untuk OAuth Strava.
// PWA tidak boleh menyimpan client_secret, jadi penukaran kode → token
// (dan refresh token) dilakukan di sini. Worker tidak menyimpan apa pun.
//
// Secret/variabel (set lewat `wrangler secret put` / dashboard):
//   STRAVA_CLIENT_ID      ID aplikasi API Strava
//   STRAVA_CLIENT_SECRET  secret aplikasi API Strava
//   ALLOWED_ORIGIN        origin PWA, mis. https://ibnuasharramadhan.github.io

const TOKEN_URL = 'https://www.strava.com/oauth/token'

function cors(env, extra = {}) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    ...extra,
  }
}

function json(env, status, body) {
  return new Response(JSON.stringify(body), { status, headers: cors(env, { 'Content-Type': 'application/json' }) })
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    if (origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) })
    if (request.method !== 'POST') return json(env, 405, { error: 'Metode tidak didukung' })

    let body
    try {
      body = await request.json()
    } catch {
      return json(env, 400, { error: 'Body harus JSON' })
    }

    const form = new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET })
    if (typeof body.code === 'string' && body.code) {
      form.set('grant_type', 'authorization_code')
      form.set('code', body.code)
    } else if (typeof body.refresh_token === 'string' && body.refresh_token) {
      form.set('grant_type', 'refresh_token')
      form.set('refresh_token', body.refresh_token)
    } else {
      return json(env, 400, { error: 'Butuh code atau refresh_token' })
    }

    const res = await fetch(TOKEN_URL, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return json(env, res.status, { error: data.message || 'Strava menolak permintaan token' })

    // Kirim balik hanya yang dibutuhkan PWA.
    return json(env, 200, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete ? { id: data.athlete.id, firstname: data.athlete.firstname } : undefined,
    })
  },
}
