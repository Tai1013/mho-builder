import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const scope = 'https://example.com/mho-builder/'
const cachePrefix = `mho:${scope}:`
const source = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8')

function createWorker({ keys = [], clients = [] } = {}) {
  const handlers = new Map()
  const deleted = []
  let claimed = false
  const self = {
    registration: { scope },
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: {
      claim: async () => { claimed = true },
      matchAll: async () => clients,
    },
  }
  const caches = {
    keys: async () => keys,
    delete: async (key) => { deleted.push(key) },
  }
  runInNewContext(source, { self, caches, URL, __VERSION__: 'new', __FILES__: [] })
  return {
    activate() {
      let activation
      handlers.get('activate')({ waitUntil: (promise) => { activation = promise } })
      return activation
    },
    deleted,
    get claimed() { return claimed },
  }
}

test('更新時不等待頁面導覽，才能完成啟用並載入新版', async () => {
  const navigated = []
  let finishNavigation
  const navigation = new Promise((resolve) => { finishNavigation = resolve })
  const clients = [
    { url: `${scope}?foo=bar#build-code`, navigate: (url) => { navigated.push(url); return navigation } },
    { url: 'https://example.com/other/', navigate: () => { throw new Error('其他網站不應被重新載入') } },
  ]
  const worker = createWorker({ keys: [`${cachePrefix}old`, `${cachePrefix}new`, 'other-cache'], clients })

  // 模擬瀏覽器必須等 activate 完成，才會完成受此 worker 控制的導覽。
  let timeout
  try {
    await Promise.race([
      worker.activate(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('啟用與導覽互相等待')), 500) }),
    ])
  } finally {
    clearTimeout(timeout)
    finishNavigation()
  }

  assert.equal(worker.claimed, true)
  assert.deepEqual(worker.deleted, [`${cachePrefix}old`])
  assert.deepEqual(navigated, [`${scope}?foo=bar&__mho_updated=1#build-code`])
})

test('初次安裝不重新載入頁面', async () => {
  let navigated = false
  const worker = createWorker({
    keys: [`${cachePrefix}new`],
    clients: [{ url: scope, navigate: () => { navigated = true } }],
  })

  await worker.activate()
  assert.equal(worker.claimed, true)
  assert.equal(navigated, false)
})

test('頁面無法導覽時不影響啟用', async () => {
  const worker = createWorker({
    keys: [`${cachePrefix}old`, `${cachePrefix}new`],
    clients: [{ url: scope, navigate: () => Promise.reject(new Error('頁面已關閉')) }],
  })

  await worker.activate()
  assert.equal(worker.claimed, true)
})