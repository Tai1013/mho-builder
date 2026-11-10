import { PART_IDS } from '../data'
import { decodeBuild, encodeBuild, isPlainCode } from './buildCode'

/**
 * 配裝分享代碼：把標題和配裝內容轉成一串看起來像亂數的字（base64url），
 * 不需要伺服器，貼給別人就能在配裝清單匯入。
 * 內容：[版本, 標題, 目標稀有度, 頭, 胸, 腕, 腰, 腿]，部位寫成「系列.稀有度」，沒裝是空字串。
 * 有支援的瀏覽器會先壓縮（代碼開頭是 z，長度大約少一半）；不支援時直接編碼（開頭一定是 W，因為 JSON 以「[」開頭）。
 */
const VERSION = 1
const ZIP_PREFIX = 'z'

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}
const canZip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

/** 配裝（標題＋配裝代碼）→ 分享代碼 */
export async function toShareCode(name: string, code: string): Promise<string> {
  const p = new URLSearchParams(code)
  const json = JSON.stringify([VERSION, name, p.get('r') ?? '', ...PART_IDS.map((part) => p.get(part) ?? '')])
  const bytes = new TextEncoder().encode(json)
  if (canZip) {
    try {
      return ZIP_PREFIX + bytesToBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))
    } catch {
      // 壓縮失敗就用不壓縮的格式
    }
  }
  return bytesToBase64Url(bytes)
}

export interface ImportedBuild {
  name: string
  /** 配裝代碼（跟網址 # 後面一樣） */
  code: string
  /** 代碼裡有、但目前資料沒有或不能配裝而略過的部件數 */
  skipped: number
}

/**
 * 分享代碼 → 配裝；看不懂、或一件能用的部件都沒有時回傳 null。
 * 也接受整個網址（取 # 後面）和舊格式（head=...）。allowEmpty：網址用，沒有部件也算成功。
 */
export async function fromShareCode(text: string, opts: { allowEmpty?: boolean } = {}): Promise<ImportedBuild | null> {
  try {
    let clean = text.replace(/\s+/g, '')
    if (clean.includes('#')) clean = clean.slice(clean.lastIndexOf('#') + 1)
    if (isPlainCode(clean)) return normalize('', clean, opts)
    let bytes: Uint8Array
    if (clean.startsWith(ZIP_PREFIX)) {
      if (!canZip) return null
      bytes = await pipe(base64UrlToBytes(clean.slice(ZIP_PREFIX.length)), new DecompressionStream('deflate-raw'))
    } else {
      bytes = base64UrlToBytes(clean)
    }
    const arr: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!Array.isArray(arr) || arr[0] !== VERSION) return null
    const [, name, r, ...parts] = arr
    const p = new URLSearchParams()
    if (typeof r === 'string' && r) p.set('r', r)
    PART_IDS.forEach((part, i) => {
      if (typeof parts[i] === 'string' && parts[i]) p.set(part, parts[i])
    })
    return normalize(typeof name === 'string' ? name : '', p.toString(), opts)
  } catch {
    return null
  }
}

/** 用網站目前的資料重新整理：不存在、技能等級不確定、超過稀有度上限的部件會被拿掉 */
function normalize(name: string, code: string, opts: { allowEmpty?: boolean }): ImportedBuild | null {
  const p = new URLSearchParams(code)
  const { slots, targetRarity } = decodeBuild(code)
  const kept = PART_IDS.filter((part) => slots[part].pieceId).length
  if (!kept && !opts.allowEmpty) return null
  return {
    name: name.trim().slice(0, 30),
    code: encodeBuild(slots, targetRarity),
    skipped: PART_IDS.filter((part) => p.has(part)).length - kept,
  }
}
