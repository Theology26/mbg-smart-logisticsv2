<template>
  <AppLayout>
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-white text-xl font-bold">🗺️ Monitoring Rute Real-Time</h2>
        <div class="flex gap-2">
           <button @click="fetchData" class="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs">🔄 Refresh Manual</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-4 gap-4">
        <div v-for="s in stats" :key="s.label" class="bg-gray-900 border border-gray-800 p-4 rounded-xl">
          <p class="text-gray-500 text-[10px] uppercase font-bold">{{ s.label }}</p>
          <p :class="s.color" class="text-xl font-black">{{ s.value }}</p>
        </div>
      </div>

      <!-- Map Container -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden h-[600px] relative">
        <div id="mbg-map" class="w-full h-full z-10"></div>
        <div v-if="loading" class="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center">
           <div class="text-white font-bold animate-pulse">MEMUAT DATA PETA...</div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'
import { API_BASE_URL } from '@/config'

const schools = ref([])
const couriers = ref([])
const loading = ref(false)

const stats = computed(() => [
  { label: 'Sekolah', value: schools.value.length, color: 'text-blue-400' },
  { label: 'Kurir Aktif', value: couriers.value.filter(c => c.lat).length, color: 'text-emerald-400' },
  { label: 'Porsi Delivery', value: schools.value.reduce((a, b) => a + (b.demand_quantity || 0), 0), color: 'text-orange-400' },
  { label: 'Sistem AI', value: 'Ready', color: 'text-purple-400' }
])

let map = null
const DEPOT = [-7.9666, 112.6326]

async function initMap() {
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  if (map) return
  map = L.map('mbg-map').setView(DEPOT, 13)
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png').addTo(map)
  L.marker(DEPOT).addTo(map).bindPopup('🏭 Dapur MBG')
}

async function fetchData() {
  loading.value = true
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const [sRes, dRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/schools/`, { headers }),
      axios.get(`${API_BASE_URL}/deliveries/`, { headers })
    ])
    schools.value = sRes.data.data || []
    
    // Process map markers
    const L = await import('leaflet')
    schools.value.forEach(s => {
       if (s.latitude && s.longitude) {
         L.circleMarker([s.latitude, s.longitude], { color: '#3b82f6', radius: 6 }).addTo(map).bindPopup(`🏫 ${s.name}`)
       }
    })
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(async () => {
  await nextTick()
  await initMap()
  await fetchData()
})
</script>
