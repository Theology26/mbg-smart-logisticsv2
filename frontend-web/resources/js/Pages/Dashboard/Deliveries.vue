<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex justify-between items-center">
         <h2 class="text-white text-xl font-bold">🚚 Status Pengiriman</h2>
         <!-- Optional: Add New Delivery Button here if needed -->
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-800 text-gray-400">
            <tr>
              <th class="px-6 py-4">Kurir</th>
              <th class="px-6 py-4">Menu (Schedule ID)</th>
              <th class="px-6 py-4 text-center">Status</th>
              <th class="px-6 py-4 text-right">Waktu</th>
              <th class="px-6 py-4 text-center" v-if="isAdmin">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800 text-gray-300">
            <tr v-for="d in deliveries" :key="d.id" class="hover:bg-gray-800/50 transition-colors">
              <td class="px-6 py-4 text-white font-bold">
                 {{ d.courier?.name || 'Belum Ada Kurir' }}
              </td>
              <td class="px-6 py-4 text-gray-400">
                 <div class="flex flex-col">
                    <span class="text-white">{{ d.schedule?.menu?.name || 'Menu Tidak Diketahui' }}</span>
                    <span class="text-xs text-gray-500">Jadwal #{{ d.schedule_id }} • {{ d.school?.name }}</span>
                 </div>
              </td>
              <td class="px-6 py-4 text-center">
                 <span :class="[
                   'px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider',
                   d.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                   d.status === 'in_transit' ? 'bg-blue-500/10 text-blue-400' :
                   d.status === 'delivered' ? 'bg-green-500/10 text-green-400' :
                   'bg-red-500/10 text-red-400'
                 ]">
                   {{ d.status.replace('_', ' ') }}
                 </span>
              </td>
              <td class="px-6 py-4 text-right text-gray-500">
                 {{ new Date(d.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) }}
              </td>
              <td class="px-6 py-4 text-center" v-if="isAdmin">
                 <div v-if="d.status === 'pending'" class="flex justify-center gap-2">
                    <select 
                      v-model="selectedCourier[d.id]"
                      class="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option disabled value="">Pilih Kurir...</option>
                      <option v-for="c in couriers" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                    <button 
                      @click="assignCourier(d.id)"
                      :disabled="!selectedCourier[d.id]"
                      class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-bold transition"
                    >
                      TUGASKAN
                    </button>
                 </div>
                 <div v-else>
                    <span class="text-xs text-gray-500 italic">Sudah Jalan</span>
                 </div>
              </td>
            </tr>
            <tr v-if="deliveries.length === 0">
              <td :colspan="isAdmin ? 5 : 4" class="px-6 py-10 text-center text-gray-500">Tidak ada data pengiriman.</td>
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
const couriers = ref([])
const isAdmin = ref(false)
const selectedCourier = ref({}) // track selected courier for each delivery row

async function fetchDeliveries() {
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const res = await axios.get(`${API_BASE_URL}/deliveries/`, { headers })
    deliveries.value = res.data.data || []
  } catch (e) { console.error(e) }
}

async function fetchCouriers() {
  if (!isAdmin.value) return
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const res = await axios.get(`${API_BASE_URL}/couriers/`, { headers })
    couriers.value = res.data.data || []
  } catch (e) { console.error(e) }
}

async function assignCourier(deliveryId) {
  const courierId = selectedCourier.value[deliveryId]
  if (!courierId) return

  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    await axios.put(`${API_BASE_URL}/deliveries/${deliveryId}/assign/`, {
      courier_id: courierId
    }, { headers })
    
    // Refresh data
    alert('Tugas berhasil diberikan ke kurir!')
    await fetchDeliveries()
  } catch (e) {
    alert('Gagal menugaskan kurir: ' + (e.response?.data?.message || e.message))
    console.error(e)
  }
}

onMounted(() => {
  const userRole = localStorage.getItem('mbg_role')
  isAdmin.value = userRole === 'admin'
  fetchDeliveries()
  fetchCouriers()
})
</script>
