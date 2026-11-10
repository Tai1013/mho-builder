import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { registerServiceWorker } from './composables/appUpdate'

createApp(App).use(createPinia()).mount('#app')
registerServiceWorker()
