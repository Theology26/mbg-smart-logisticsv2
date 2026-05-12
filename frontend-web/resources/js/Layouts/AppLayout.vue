<template>
  <div class="min-h-screen bg-slate-50 font-sans transition-colors duration-300">
    <!-- Sidebar Navigation -->
    <aside class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <div>
          <p class="text-slate-900 font-bold text-sm leading-tight">{{ globalSettings.app_name }}</p>
          <p class="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Smart Distribution</p>
        </div>
      </div>

      <!-- User Info -->
      <div class="px-4 py-4 border-b border-slate-100">
        <div class="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-blue-600/20">
            {{ userInitials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-slate-900 text-xs font-bold truncate">{{ user?.name }}</p>
            <span :class="roleBadgeClass" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
              {{ user?.role }}
            </span>
          </div>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-4 py-6 space-y-2">
        <Link v-for="item in navItems" :key="item.href" :href="item.href"
          :class="[
            'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200',
            $page.url === item.href
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 active:scale-95'
              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
          ]">
          <span class="text-lg">{{ item.icon }}</span>
          {{ item.label }}
        </Link>
      </nav>

      <!-- Logout -->
      <div class="px-4 py-6 border-t border-slate-100">
        <button @click="logout"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
          <span>🚪</span> Keluar
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="pl-64">
      <!-- Top Bar -->
      <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex items-center justify-between">
        <h1 class="text-slate-900 text-xl font-black tracking-tight">{{ $page.props.pageTitle || 'Dashboard' }}</h1>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-4">
            <!-- OSRM Status -->
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
              <span :class="systemStatus.osrm ? 'bg-emerald-500' : 'bg-red-500'"
                class="w-2 h-2 rounded-full shadow-sm"></span>
              OSRM
            </div>
            <!-- AI Status -->
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
              <span :class="systemStatus.ai ? 'bg-emerald-500' : 'bg-red-500'"
                class="w-2 h-2 rounded-full shadow-sm"></span>
              AI
            </div>
            <span class="text-slate-200">|</span>
            <span class="text-slate-900 font-black text-sm">{{ currentTime }}</span>
          </div>
        </div>
      </header>

      <!-- Page Slot -->
      <main class="p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import axios from 'axios'

const page = usePage()
const user = computed(() => {
  const sessionUser = page.props.auth?.user
  if (sessionUser) return sessionUser
  
  // Fallback to localStorage (Golang login)
  const localUser = localStorage.getItem('mbg_user')
  return localUser ? JSON.parse(localUser) : null
})

const systemStatus = ref({ osrm: false, ai: false })
const currentTime = ref('')
const globalSettings = ref({
  app_name: 'MBG Logistics',
  theme_color: '#3b82f6',
  enable_ai_menu: 'true'
})

// Role badge styling
const roleBadgeClass = computed(() => ({
  'bg-purple-500/20 text-purple-400': user.value?.role === 'admin',
  'bg-blue-500/20 text-blue-400': user.value?.role === 'guru',
  'bg-orange-500/20 text-orange-400': user.value?.role === 'dapur',
  'bg-green-500/20 text-green-400': user.value?.role === 'kurir',
}))

// User initials for avatar
const userInitials = computed(() => {
  const name = user.value?.name || 'U'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
})

// Navigation items (role-filtered in each page component)
const navItems = computed(() => {
  const role = user.value?.role
  const items = [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard', roles: ['admin', 'guru', 'dapur', 'kurir'] },
    { href: '/dashboard/map', icon: '🗺️', label: 'Peta Lokasi', roles: ['admin', 'guru'] },
    { href: '/dashboard/schedules', icon: '📅', label: 'Jadwal Produksi', roles: ['admin', 'dapur'] },
    { href: '/dashboard/deliveries', icon: '🚚', label: 'Pengiriman', roles: ['admin', 'kurir'] },
    { href: '/dashboard/schools', icon: '🏫', label: 'Daftar Sekolah', roles: ['admin', 'guru'] },
    { href: '/dashboard/ingredients', icon: '🥘', label: 'Stok Bahan', roles: ['admin', 'dapur'] },
  ]
  return items.filter(item => item.roles.includes(role))
})

// Clock update
let clockInterval
onMounted(() => {
  updateTime()
  clockInterval = setInterval(updateTime, 1000)
  checkSystemStatus()
  fetchGlobalSettings()
})
onUnmounted(() => clearInterval(clockInterval))

async function fetchGlobalSettings() {
  try {
    const res = await axios.get('/api/settings')
    globalSettings.value = res.data.data
    // Inject theme color into CSS
    document.documentElement.style.setProperty('--theme-primary', globalSettings.value.theme_color)
  } catch {}
}

function updateTime() {
  currentTime.value = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

async function checkSystemStatus() {
  try {
    const res = await axios.get('/api/health')
    systemStatus.value = {
      osrm: res.data.data.osrm === 'healthy',
      ai: res.data.data.ai !== 'unreachable',
    }
  } catch {}
}

function logout() {
  localStorage.removeItem('mbg_token')
  delete axios.defaults.headers.common['Authorization']
  window.location.href = '/login'
}
</script>
