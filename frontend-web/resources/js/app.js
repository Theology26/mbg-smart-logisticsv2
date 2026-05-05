import { createApp, h } from 'vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import axios from 'axios'
import './bootstrap.js'

// Set up Axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
axios.defaults.headers.common['Content-Type'] = 'application/json'

// Attach JWT token to every request if available
const token = localStorage.getItem('mbg_token')
if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

// Intercept 401s to redirect to login
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('mbg_token')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

createInertiaApp({
    title: (title) => `${title} — MBG Smart Logistics`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue')
        ),
    setup({ el, App, props, plugin }) {
        const app = createApp({ render: () => h(App, props) })
        app.use(plugin)
        app.mount(el)
    },
    progress: {
        color: '#4ade80',   // Green progress bar (matching logistics theme)
    },
})
