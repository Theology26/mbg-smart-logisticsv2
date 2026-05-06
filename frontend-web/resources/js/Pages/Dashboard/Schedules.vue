<template>
  <AppLayout>
    <div class="space-y-6">
      <h2 class="text-white text-xl font-bold">📅 Jadwal Produksi Dapur</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="sc in schedules" :key="sc.id" class="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-emerald-400 text-[10px] font-bold uppercase">Menu #{{ sc.id }}</p>
              <h3 class="text-white font-bold text-lg">{{ sc.menu_name || 'Nasi Kotak MBG' }}</h3>
            </div>
            <div class="text-right">
              <p class="text-gray-500 text-[10px] uppercase">Epsilon</p>
              <p class="text-white font-black">{{ (sc.epsilon_score || 0).toFixed(2) }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">Status</span>
              <span class="text-emerald-400 font-bold uppercase">{{ sc.status }}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">Kuantitas</span>
              <span class="text-white font-bold">{{ sc.total_quantity }} Porsi</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="schedules.length === 0" class="text-center py-20 text-gray-600 italic">Belum ada jadwal masak.</div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'
import { API_BASE_URL } from '@/config'

const schedules = ref([])

async function fetchSchedules() {
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const res = await axios.get(`${API_BASE_URL}/schedules/`, { headers })
    schedules.value = res.data.data || []
  } catch (e) { console.error(e) }
}

onMounted(fetchSchedules)
</script>
