<template>
  <div class="min-h-screen bg-gray-950 font-sans">
    <!-- Sidebar Navigation -->
    <aside class="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <div>
          <p class="text-white font-semibold text-sm leading-tight">MBG Logistics</p>
          <p class="text-gray-400 text-xs">Smart Distribution</p>
        </div>
      </div>

      <!-- User Info -->
      <div class="px-4 py-3 border-b border-gray-800">
        <div class="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-800">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {{ userInitials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white text-xs font-medium truncate">{{ user?.name }}</p>
            <span :class="roleBadgeClass" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium">
              {{ user?.role }}
            </span>
          </div>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-3 py-4 space-y-1">
        <Link v-for="item in navItems" :key="item.href" :href="item.href"
          :class="[
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            $page.url === item.href
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          ]">
          <span class="text-base">{{ item.icon }}</span>
          {{ item.label }}
        </Link>
      </nav>

      <!-- Logout -->
      <div class="px-3 py-4 border-t border-gray-800">
        <button @click="logout"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150">
          <span>🚪</span> Keluar
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="pl-64">
      <!-- Top Bar -->
      <header class="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 class="text-white font-semibold">{{ $page.props.pageTitle || 'Dashboard' }}</h1>
        <div class="flex items-center gap-3">
          <!-- OSRM Status -->
          <div class="flex items-center gap-1.5 text-xs text-gray-400">
            <span :class="systemStatus.osrm ? 'bg-green-400' : 'bg-red-400'"
              class="w-2 h-2 rounded-full animate-pulse"></span>
            OSRM
          </div>
          <!-- AI Status -->
          <div class="flex items-center gap-1.5 text-xs text-gray-400">
            <span :class="systemStatus.ai ? 'bg-green-400' : 'bg-red-400'"
              class="w-2 h-2 rounded-full animate-pulse"></span>
            AI
          </div>
          <span class="text-gray-600">|</span>
          <span class="text-gray-400 text-xs">{{ currentTime }}</span>
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
    { href: '/dashboard/map', icon: '🗺️', label: 'Peta Pengiriman', roles: ['admin', 'guru'] },
    { href: '/dashboard/schedules', icon: '📅', label: 'Jadwal Masak', roles: ['admin', 'dapur'] },
    { href: '/dashboard/deliveries', icon: '🚚', label: 'Pengiriman', roles: ['admin', 'kurir'] },
    { href: '/dashboard/schools', icon: '🏫', label: 'Sekolah', roles: ['admin', 'guru'] },
    { href: '/dashboard/ingredients', icon: '🥘', label: 'Inventaris', roles: ['admin', 'dapur'] },
    { href: '/dashboard/customization', icon: '🎨', label: 'Kustomisasi', roles: ['admin'] },
  ]
  return items.filter(item => item.roles.includes(role))
})

// Clock update
let clockInterval
onMounted(() => {
  updateTime()
  clockInterval = setInterval(updateTime, 1000)
  checkSystemStatus()
})
onUnmounted(() => clearInterval(clockInterval))

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
