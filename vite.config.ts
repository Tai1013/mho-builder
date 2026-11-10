import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

/**
 * 建置完成後產生 dist/sw.js（離線用，樣板在 src/sw.js）：
 * 把 dist 裡所有檔案列進去讓手機先存好，版本號用檔案內容算，內容沒變 sw.js 就完全一樣，手機不會以為有新版本。
 */
function serviceWorker(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'mho-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => relative(outDir, join(e.parentPath, e.name)).split(sep).join('/'))
        .filter((f) => f !== 'sw.js')
        .sort()
      const template = readFileSync(join(root, 'src/sw.js'), 'utf8')
      const hash = createHash('sha256').update(template)
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      // index.html 用網址 ./ 存：打開網站時瀏覽器要的是 ./，不是 ./index.html
      const urls = files.map((f) => (f === 'index.html' ? './' : f))
      const sw = template
        .replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('__FILES__', JSON.stringify(urls))
      writeFileSync(join(outDir, 'sw.js'), sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 的專案網址是 /<repo 名稱>/，由部署流程用 BASE_PATH 傳入；本機開發維持 /
  base: process.env.BASE_PATH || '/',
  plugins: [vue(), serviceWorker()],
  build: {
    // 防具資料（含素材）打包後約 650 KB，gzip 約 75 KB
    chunkSizeWarningLimit: 1000,
  },
})
