<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-white text-xl font-bold">🏫 Manajemen Sekolah</h2>
          <p class="text-gray-400 text-sm">Kelola data sekolah penerima manfaat MBG</p>
        </div>
        <button @click="openModal()" 
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2">
          <span>➕</span> Tambah Sekolah
        </button>
      </div>

      <!-- Table -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden text-sm">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-800/50 text-gray-400 font-medium">
              <th class="px-6 py-4">ID</th>
              <th class="px-6 py-4">Nama Sekolah</th>
              <th class="px-6 py-4">Alamat</th>
              <th class="px-6 py-4 text-center">Porsi</th>
              <th class="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr v-if="loading" v-for="i in 3" :key="i" class="animate-pulse">
              <td colspan="5" class="px-6 py-4 bg-gray-800/20 h-12"></td>
            </tr>
            <tr v-else v-for="school in schools" :key="school.id" class="hover:bg-gray-800/30 transition-colors">
              <td class="px-6 py-4 text-gray-500">#{{ school.id }}</td>
              <td class="px-6 py-4">
                <div class="font-semibold text-white">{{ school.name }}</div>
                <div class="text-xs text-gray-500">Lat: {{ school.latitude }}, Lng: {{ school.longitude }}</div>
              </td>
              <td class="px-6 py-4 text-gray-400">{{ school.address }}</td>
              <td class="px-6 py-4 text-center">
                <span class="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg font-bold">
                  {{ school.demand_quantity }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openModal(school)" class="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors">✏️</button>
                  <button @click="deleteSchool(school.id)" class="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && schools.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                Data tidak ditemukan di database.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form (Hidden for brevity, but same as before) -->
    <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
       <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6">
          <h3 class="text-white font-bold mb-4">Form Sekolah</h3>
          <div class="space-y-3">
             <input v-model="form.name" placeholder="Nama Sekolah" class="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700" />
             <input v-model="form.address" placeholder="Alamat" class="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700" />
             <div class="grid grid-cols-2 gap-2">
                <input v-model.number="form.latitude" placeholder="Lat" class="p-2 bg-gray-800 text-white rounded-lg border border-gray-700" />
                <input v-model.number="form.longitude" placeholder="Lng" class="p-2 bg-gray-800 text-white rounded-lg border border-gray-700" />
             </div>
             <input v-model.number="form.demand_quantity" placeholder="Jumlah Porsi" class="w-full p-2 bg-gray-800 text-white rounded-lg border border-gray-700" />
          </div>
          <div class="mt-6 flex gap-2">
             <button @click="showModal = false" class="flex-1 p-2 bg-gray-800 text-white rounded-lg">Batal</button>
             <button @click="saveSchool" class="flex-1 p-2 bg-emerald-600 text-white rounded-lg">Simpan</button>
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
const loading = ref(true)
const showModal = ref(false)
const editingId = ref(null)
const form = ref({ name: '', address: '', latitude: 0, longitude: 0, demand_quantity: 0 })

const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('mbg_token')}` })

async function fetchSchools() {
  loading.value = true
  try {
    const res = await axios.get(`${API_BASE_URL}/schools/`, { headers: getHeaders() })
    schools.value = res.data.data || []
  } catch (err) {
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

async function saveSchool() {
  try {
    const url = editingId.value ? `${API_BASE_URL}/schools/${editingId.value}/` : `${API_BASE_URL}/schools/`
    const method = editingId.value ? 'put' : 'post'
    await axios[method](url, form.value, { headers: getHeaders() })
    await fetchSchools()
    showModal.value = false
  } catch (err) { alert('Gagal simpan') }
}

async function deleteSchool(id) {
  if (!confirm('Hapus?')) return
  try {
    await axios.delete(`${API_BASE_URL}/schools/${id}/`, { headers: getHeaders() })
    await fetchSchools()
  } catch (err) { alert('Gagal hapus') }
}

function openModal(school = null) {
  if (school) { editingId.value = school.id; form.value = { ...school } }
  else { editingId.value = null; form.value = { name: '', address: '', latitude: -7.9, longitude: 112.6, demand_quantity: 0 } }
  showModal.value = true
}

onMounted(fetchSchools)
</script>
