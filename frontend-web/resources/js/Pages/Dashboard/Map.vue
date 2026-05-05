<template>
  <AppLayout>
    <div class="space-y-4">
      <!-- Header Bar -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-white text-xl font-bold">🗺️ Peta Pengiriman Real-Time</h2>
          <p class="text-gray-400 text-sm mt-0.5">
            <span v-if="isAdmin">Mode Admin — kontrol penuh aktif</span>
            <span v-else>Mode Guru — tampilan read-only</span>
          </p>
        </div>

        <!-- Controls (Admin only) -->
        <div v-if="isAdmin" class="flex items-center gap-2">
          <button @click="refreshData"
            :disabled="loading"
            class="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm hover:bg-green-500/20 transition-all disabled:opacity-50">
            <svg :class="loading ? 'animate-spin' : ''" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button @click="toggleAutoRefresh"
            :class="autoRefresh ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400'"
            class="px-3 py-1.5 border rounded-lg text-sm transition-all hover:opacity-80">
            {{ autoRefresh ? '⏸ Auto Pause' : '▶ Auto Refresh' }}
          </button>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-4 gap-3">
        <div v-for="stat in stats" :key="stat.label"
          class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-gray-500 text-xs">{{ stat.label }}</p>
          <p class="text-white text-2xl font-bold mt-1">{{ stat.value }}</p>
          <p :class="stat.color" class="text-xs mt-0.5">{{ stat.sub }}</p>
        </div>
      </div>

      <!-- Map + Sidebar -->
      <div class="grid grid-cols-[1fr_280px] gap-4">
        <!-- Leaflet Map -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden relative">
          <!-- Map Loading Overlay -->
          <div v-if="!mapReady"
            class="absolute inset-0 flex items-center justify-center z-[1000] bg-gray-900">
            <div class="text-center">
              <div class="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p class="text-gray-400 text-sm mt-3">Memuat peta Malang...</p>
            </div>
          </div>
          <!-- Map Container -->
          <div id="mbg-map" class="w-full" style="height: 540px;"></div>

          <!-- Map Legend -->
          <div class="absolute bottom-4 left-4 z-[999] bg-gray-900/90 backdrop-blur rounded-lg p-3 border border-gray-700 text-xs space-y-1.5">
            <p class="text-gray-300 font-medium mb-2">Legenda</p>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-blue-500"></span><span class="text-gray-400">Dapur (Depot)</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-500"></span><span class="text-gray-400">Sekolah</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-green-400"></span><span class="text-gray-400">Posisi Kurir</span></div>
            <div class="flex items-center gap-2"><span class="w-8 border-t-2 border-dashed border-orange-400"></span><span class="text-gray-400">Rute Aktif</span></div>
          </div>
        </div>

        <!-- Courier Sidebar -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
          <div class="px-4 py-3 border-b border-gray-800">
            <h3 class="text-white text-sm font-semibold">🚚 Status Kurir</h3>
            <p class="text-gray-500 text-xs mt-0.5">{{ couriers.length }} kurir aktif</p>
          </div>

          <div class="flex-1 overflow-y-auto divide-y divide-gray-800">
            <div v-if="couriers.length === 0" class="px-4 py-8 text-center">
              <p class="text-gray-600 text-sm">Tidak ada data kurir</p>
              <p class="text-gray-700 text-xs mt-1">Menunggu upload batch GPS...</p>
            </div>

            <div v-for="courier in couriers" :key="courier.id"
              @click="focusCourier(courier)"
              class="px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 text-xs font-bold">
                    {{ courier.initials }}
                  </div>
                  <div>
                    <p class="text-white text-xs font-medium">{{ courier.name }}</p>
                    <p class="text-gray-500 text-xs">{{ courier.pointsCount }} titik GPS</p>
                  </div>
                </div>
                <div class="text-right">
                  <p :class="expirationColor(courier.epsilonScore)" class="text-xs font-medium">
                    ε={{ courier.epsilonScore?.toFixed(2) }}
                  </p>
                  <p class="text-gray-600 text-xs">{{ courier.lastSeen }}</p>
                </div>
              </div>

              <!-- Mini epsilon bar -->
              <div class="mt-2 w-full bg-gray-700 rounded-full h-1">
                <div :class="expirationBarColor(courier.epsilonScore)"
                  class="h-1 rounded-full transition-all duration-500"
                  :style="{ width: `${(courier.epsilonScore || 0) * 100}%` }">
                </div>
              </div>
            </div>
          </div>

          <!-- Last Refresh -->
          <div class="px-4 py-3 border-t border-gray-800">
            <p class="text-gray-600 text-xs">Refresh terakhir: {{ lastRefresh }}</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'
import AppLayout from '@/Layouts/AppLayout.vue'

// ── Auth & Role ────────────────────────────────────────────────
const page = usePage()
const user = computed(() => page.props.auth?.user)
const isAdmin = computed(() => user.value?.role === 'admin')

// ── State ──────────────────────────────────────────────────────
const mapReady = ref(false)
const loading = ref(false)
const autoRefresh = ref(false)
const lastRefresh = ref('—')
const couriers = ref([])
const schools = ref([])
const trackingHistory = ref([])

// Depot coordinates (MBG Kitchen in Malang)
const DEPOT_LAT = -7.9666
const DEPOT_LNG = 112.6326

// ── Computed stats ─────────────────────────────────────────────
const stats = computed(() => [
  {
    label: 'Sekolah Aktif',
    value: schools.value.length,
    sub: 'tujuan pengiriman',
    color: 'text-blue-400',
  },
  {
    label: 'Kurir Aktif',
    value: couriers.value.length,
    sub: 'dalam perjalanan',
    color: 'text-green-400',
  },
  {
    label: 'Total GPS Points',
    value: trackingHistory.value.length,
    sub: 'batch terakhir',
    color: 'text-purple-400',
  },
  {
    label: 'Epsilon Rata-rata',
    value: couriers.value.length > 0
      ? (couriers.value.reduce((s, c) => s + (c.epsilonScore || 0), 0) / couriers.value.length).toFixed(2)
      : '—',
    sub: 'urgensi spoilage',
    color: 'text-orange-400',
  },
])

// ── Leaflet Map ────────────────────────────────────────────────
let map = null
let markers = { schools: [], couriers: [], trail: [] }
let autoRefreshInterval = null
let wsConnection = null

onMounted(async () => {
  await nextTick()
  await initMap()
  await fetchData()
  connectWebSocket()
})

onUnmounted(() => {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval)
  if (wsConnection) wsConnection.close()
  if (map) map.remove()
})

// ── Leaflet Initialization ─────────────────────────────────────
async function initMap() {
  // Dynamically import Leaflet to avoid SSR issues
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  map = L.map('mbg-map', {
    center: [DEPOT_LAT, DEPOT_LNG],
    zoom: 13,
    zoomControl: true,
  })

  // Dark tile layer (Stadia Maps dark theme)
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; Stadia Maps &copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  // Depot marker (kitchen)
  const depotIcon = L.divIcon({
    html: `<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px #3b82f6;"></div>`,
    className: '', iconAnchor: [7, 7],
  })
  L.marker([DEPOT_LAT, DEPOT_LNG], { icon: depotIcon })
    .addTo(map)
    .bindPopup('<b>🏭 Dapur MBG</b><br>Depot Utama')

  mapReady.value = true
}

// ── Data Fetching ──────────────────────────────────────────────
async function fetchData() {
  loading.value = true
  try {
    const token = localStorage.getItem('mbg_token')
    const headers = { Authorization: `Bearer ${token}` }

    const [schoolsRes, deliveriesRes] = await Promise.all([
      axios.get('/api/schools', { headers }),
      axios.get('/api/deliveries', { headers }),
    ])

    schools.value = schoolsRes.data.data || []

    // Build courier list from active deliveries
    const activeCouriers = {}
    for (const delivery of deliveriesRes.data.data || []) {
      if (delivery.status !== 'in_transit') continue
      const courier = delivery.courier
      if (!courier) continue

      if (!activeCouriers[courier.id]) {
        activeCouriers[courier.id] = {
          id: courier.id,
          name: courier.name,
          initials: courier.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          epsilonScore: delivery.schedule?.epsilon_score || 0,
          pointsCount: 0,
          lastSeen: '—',
          lat: null,
          lng: null,
        }
      }
    }

    // Fetch tracking history for each active courier
    const courierList = Object.values(activeCouriers)
    for (const c of courierList) {
      try {
        const trackRes = await axios.get(`/api/tracking/history/${c.id}`, { headers })
        const points = trackRes.data.data || []
        trackingHistory.value = [...trackingHistory.value, ...points]
        c.pointsCount = points.length
        if (points.length > 0) {
          const latest = points[0] // DESC order from API
          c.lat = latest.latitude
          c.lng = latest.longitude
          c.lastSeen = new Date(latest.recorded_at).toLocaleTimeString('id-ID')
        }
      } catch {}
    }
    couriers.value = courierList

    updateMapMarkers()
    lastRefresh.value = new Date().toLocaleTimeString('id-ID')
  } catch (err) {
    console.error('Failed to fetch data:', err)
  } finally {
    loading.value = false
  }
}

// ── Map Updates ────────────────────────────────────────────────
async function updateMapMarkers() {
  if (!map) return
  const L = await import('leaflet')

  // Clear old markers
  markers.schools.forEach(m => m.remove())
  markers.couriers.forEach(m => m.remove())
  markers.trail.forEach(m => m.remove())
  markers = { schools: [], couriers: [], trail: [] }

  // School markers
  for (const school of schools.value) {
    const icon = L.divIcon({
      html: `<div style="background:#ef4444;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px #ef4444;"></div>`,
      className: '', iconAnchor: [5, 5],
    })
    const m = L.marker([school.latitude, school.longitude], { icon })
      .addTo(map)
      .bindPopup(`<b>🏫 ${school.name}</b><br>Kebutuhan: ${school.demand_quantity} porsi`)
    markers.schools.push(m)
  }

  // Courier markers + GPS trails
  for (const courier of couriers.value) {
    if (!courier.lat || !courier.lng) continue

    const epsilonColor = courier.epsilonScore > 0.7 ? '#f97316'
      : courier.epsilonScore > 0.4 ? '#facc15' : '#4ade80'

    const icon = L.divIcon({
      html: `
        <div style="position:relative">
          <div style="background:${epsilonColor};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px ${epsilonColor};animation:pulse 2s infinite;"></div>
          <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;font-size:9px;padding:1px 4px;border-radius:3px;white-space:nowrap;">${courier.name}</div>
        </div>`,
      className: '', iconAnchor: [7, 7],
    })
    const m = L.marker([courier.lat, courier.lng], { icon })
      .addTo(map)
      .bindPopup(`<b>🚚 ${courier.name}</b><br>ε: ${courier.epsilonScore?.toFixed(2)}<br>${courier.pointsCount} GPS points`)
    markers.couriers.push(m)
  }

  // GPS trail polyline for each courier
  const courierPoints = {}
  for (const pt of trackingHistory.value.slice(0, 500)) {
    if (!courierPoints[pt.courier_id]) courierPoints[pt.courier_id] = []
    courierPoints[pt.courier_id].push([pt.latitude, pt.longitude])
  }

  for (const [courierId, pts] of Object.entries(courierPoints)) {
    if (pts.length < 2) continue
    const line = L.polyline(pts, {
      color: '#f97316',
      weight: 2,
      opacity: 0.6,
      dashArray: '6 4',
    }).addTo(map)
    markers.trail.push(line)
  }
}

// ── WebSocket (Dashboard Refresh on Batch Upload) ──────────────
function connectWebSocket() {
  const wsUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://') + '/ws/tracking'

  try {
    wsConnection = new WebSocket(wsUrl)
    wsConnection.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.event === 'tracking_update') {
        // New batch arrived from a courier — refresh data silently
        fetchData()
      }
    }
    wsConnection.onclose = () => {
      // Reconnect after 5s
      setTimeout(connectWebSocket, 5000)
    }
  } catch (e) {
    console.warn('WebSocket unavailable, polling fallback active')
  }
}

// ── Controls ───────────────────────────────────────────────────
async function refreshData() {
  await fetchData()
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    autoRefreshInterval = setInterval(fetchData, 30000) // Every 30s
  } else {
    clearInterval(autoRefreshInterval)
  }
}

async function focusCourier(courier) {
  if (!map || !courier.lat) return
  const L = await import('leaflet')
  map.flyTo([courier.lat, courier.lng], 15, { duration: 1.2 })
}

// ── Helpers ────────────────────────────────────────────────────
function expirationColor(epsilon) {
  if (epsilon >= 0.8) return 'text-red-400'
  if (epsilon >= 0.5) return 'text-orange-400'
  return 'text-green-400'
}

function expirationBarColor(epsilon) {
  if (epsilon >= 0.8) return 'bg-red-500'
  if (epsilon >= 0.5) return 'bg-orange-400'
  return 'bg-green-400'
}
</script>
