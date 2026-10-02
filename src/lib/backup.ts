import { today } from './date'
import { exportAll, markExported } from './db'

export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Unduh cadangan JSON lengkap dan catat waktunya untuk pengingat cadangan. */
export async function downloadBackup() {
  const data = await exportAll()
  download(`latihan-${today()}.json`, JSON.stringify(data, null, 2))
  await markExported()
}
