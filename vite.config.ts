import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 的專案網址是 /<repo 名稱>/，由部署流程用 BASE_PATH 傳入；本機開發維持 /
  base: process.env.BASE_PATH || '/',
  plugins: [vue()],
  build: {
    // 防具資料（含素材）打包後約 650 KB，gzip 約 75 KB
    chunkSizeWarningLimit: 1000,
  },
})
