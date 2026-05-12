<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex justify-between items-center">
         <h2 class="text-slate-900 text-2xl font-black tracking-tight">🚚 Status Pengiriman</h2>
      </div>

      <div class="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-400 border-b border-slate-100">
            <tr>
              <th class="px-6 py-4">Kurir</th>
              <th class="px-6 py-4">Menu (Schedule ID)</th>
              <th class="px-6 py-4 text-center">Status</th>
              <th class="px-6 py-4 text-right">Waktu</th>
              <th class="px-6 py-4 text-center" v-if="isAdmin">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="d in deliveries" :key="d.id" class="hover:bg-blue-50/30 transition-all">
              <td class="px-6 py-5 text-slate-900 font-bold">
                 {{ d.courier?.name || 'Belum Ada Kurir' }}
              </td>
              <td class="px-6 py-5 text-slate-500">
                 <div class="flex flex-col">
                    <span class="text-slate-900 font-bold">{{ d.schedule?.menu?.name || 'Menu Tidak Diketahui' }}</span>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Jadwal #{{ d.schedule_id }} • {{ d.school?.name }}</span>
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
              <td class="px-6 py-5 text-right text-slate-400 font-medium">
                 {{ new Date(d.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) }}
              </td>
              <td class="px-6 py-5 text-center" v-if="isAdmin">
                 <div v-if="d.status === 'pending'" class="flex justify-center gap-2">
                    <select 
                      v-model="selectedCourier[d.id]"
                      class="bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-bold rounded-xl px-3 py-1.5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    >
                      <option disabled value="">Pilih Kurir...</option>
                      <option v-for="c in couriers" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>

                    <button 
                      @click="assignCourier(d.id)"
                      :disabled="!selectedCourier[d.id]"
                      class="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                      Tugaskan
                    </button>
                 </div>
                 <div v-else>
                    <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Sudah Jalan</span>
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
    const res = await axios.get(`${API_BASE_URL}/couriers`, { headers })
    couriers.value = res.data.data || []
  } catch (e) { console.error(e) }
}

async function assignCourier(deliveryId) {
  const courierId = selectedCourier.value[deliveryId]
  if (!courierId) return

  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    await axios.put(`${API_BASE_URL}/deliveries/${deliveryId}/assign`, {
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
