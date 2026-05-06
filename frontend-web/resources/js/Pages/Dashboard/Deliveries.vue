<template>
  <AppLayout>
    <div class="space-y-6">
      <h2 class="text-white text-xl font-bold">🚚 Status Pengiriman</h2>

      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-800 text-gray-400">
            <tr>
              <th class="px-6 py-4">Kurir</th>
              <th class="px-6 py-4">Menu</th>
              <th class="px-6 py-4 text-center">Status</th>
              <th class="px-6 py-4 text-right">Waktu</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800 text-gray-300">
            <tr v-for="d in deliveries" :key="d.id" class="hover:bg-gray-800/50">
              <td class="px-6 py-4 text-white font-bold">{{ d.courier?.name || 'Kurir' }}</td>
              <td class="px-6 py-4 text-gray-400">#{{ d.schedule_id }}</td>
              <td class="px-6 py-4 text-center">
                 <span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] uppercase font-bold">{{ d.status }}</span>
              </td>
              <td class="px-6 py-4 text-right text-gray-500">{{ new Date(d.start_time).toLocaleTimeString('id-ID') }}</td>
            </tr>
            <tr v-if="deliveries.length === 0">
              <td colspan="4" class="px-6 py-10 text-center text-gray-500">Tidak ada pengiriman aktif.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'
import { API_BASE_URL } from '@/config'

const deliveries = ref([])

async function fetchDeliveries() {
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const res = await axios.get(`${API_BASE_URL}/deliveries/`, { headers })
    deliveries.value = res.data.data || []
  } catch (e) { console.error(e) }
}

onMounted(fetchDeliveries)
</script>
