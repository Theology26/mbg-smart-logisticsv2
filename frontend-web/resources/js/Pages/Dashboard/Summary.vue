<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-white text-xl font-bold">📊 Dashboard Summary</h2>
        <div class="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-1 rounded">API: CONNECTED</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div v-for="stat in stats" :key="stat.label" class="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <p class="text-gray-500 text-xs uppercase font-bold">{{ stat.label }}</p>
          <p class="text-white text-3xl font-black mt-1">{{ stat.value }}</p>
        </div>
      </div>
      
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
         <h3 class="text-white font-bold mb-4">🏫 Daftar Sekolah Aktif</h3>
         <div v-if="loading" class="text-gray-500 italic text-sm">Loading data dari database...</div>
         <div v-else class="space-y-2">
            <div v-for="s in schools" :key="s.id" class="p-3 bg-gray-800 rounded-xl flex justify-between">
               <span class="text-white">{{ s.name }}</span>
               <span class="text-gray-500 text-xs">{{ s.address }}</span>
            </div>
            <div v-if="schools.length === 0" class="text-red-400 text-sm">Database kosong atau tidak terbaca.</div>
         </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'
import { API_BASE_URL } from '@/config'

const schools = ref([])
const stats = ref([
  { label: 'Sekolah', value: 0 },
  { label: 'Bahan Baku', value: 0 },
  { label: 'Jadwal', value: 0 },
  { label: 'Kurir', value: 0 }
])
const loading = ref(true)

async function fetchData() {
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const [s, i, sc, d] = await Promise.all([
      axios.get(`${API_BASE_URL}/schools/`, { headers }),
      axios.get(`${API_BASE_URL}/ingredients/`, { headers }),
      axios.get(`${API_BASE_URL}/schedules/`, { headers }),
      axios.get(`${API_BASE_URL}/deliveries/`, { headers }),
    ])
    schools.value = s.data.data || []
    stats.value[0].value = schools.value.length
    stats.value[1].value = (i.data.data || []).length
    stats.value[2].value = (sc.data.data || []).length
    stats.value[3].value = (d.data.data || []).filter(x => x.status === 'in_transit').length
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>
