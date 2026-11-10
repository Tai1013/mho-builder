import { PART_IDS, fitsTarget, pieceMap, stageFor } from '../data'
import type { PartId } from '../types'

/**
 * 配裝代碼（網站內部用的格式：瀏覽器儲存、配裝清單、比對目前配裝）。
 * 例：r=9&head=great-jagras.9&legs=kulu-ya-ku.7
 * 給人看的網址和分享代碼會再轉成較短的亂碼格式（見 shareCode.ts）。
 */

export interface SlotState {
  pieceId: string | null
  rarity: number | null
}

export type BuildSlots = Record<PartId, SlotState>

export function emptySlots(): BuildSlots {
  return Object.fromEntries(PART_IDS.map((p) => [p, { pieceId: null, rarity: null }])) as BuildSlots
}

export function encodeBuild(slots: BuildSlots, targetRarity: number | 'max'): string {
  const params = new URLSearchParams()
  if (targetRarity !== 'max') params.set('r', String(targetRarity))
  for (const part of PART_IDS) {
    const s = slots[part]
    const piece = s.pieceId ? pieceMap.get(s.pieceId) : undefined
    if (piece) params.set(part, `${piece.series}.${s.rarity ?? ''}`)
  }
  return params.toString()
}

export function decodeBuild(code: string): { slots: BuildSlots; targetRarity: number | 'max' } {
  const params = new URLSearchParams(code)
  const t = params.get('r')
  const target: number | 'max' = t && /^\d+$/.test(t) ? Number(t) : 'max'
  const slots = emptySlots()
  for (const part of PART_IDS) {
    const [seriesId, rarity] = (params.get(part) ?? '').split('.')
    const piece = seriesId ? pieceMap.get(`${seriesId}/${part}`) : undefined
    // 技能等級還不確定（只有「?」的階）、或超過目標稀有度上限的部件不能配裝
    if (!piece || !fitsTarget(piece, target)) continue
    const wanted = rarity && /^\d+$/.test(rarity) ? Number(rarity) : 'max'
    slots[part].pieceId = piece.id
    // 部位的稀有度也不能超過上限
    slots[part].rarity = stageFor(piece, target === 'max' ? wanted : wanted === 'max' ? target : Math.min(wanted, target)).rarity
  }
  return { slots, targetRarity: target }
}

/** 代碼裡有沒有任何配裝資料（部位或目標稀有度） */
export function hasBuildData(code: string): boolean {
  const params = new URLSearchParams(code)
  return params.has('r') || PART_IDS.some((p) => params.has(p))
}

/** 舊格式（head=...&r=10）一定有「=」；分享代碼只有英數和 - _ */
export function isPlainCode(text: string): boolean {
  return text.includes('=')
}
