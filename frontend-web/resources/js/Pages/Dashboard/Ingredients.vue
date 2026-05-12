<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-slate-900 text-2xl font-black tracking-tight">🥘 Inventaris Bahan Baku</h2>
        <div class="flex gap-2">
          <!-- Hidden File Input for Scan -->
          <input type="file" accept="image/*" class="hidden" ref="fileInput" @change="handleScan" />
          
          <button @click="$refs.fileInput.click()" :disabled="isScanning"
             class="px-6 py-3 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 active:scale-95 transition-all disabled:opacity-50">
            {{ isScanning ? 'Membaca Nota...' : 'Scan Nota (Llama)' }}
          </button>
          
          <button @click="openModal()" class="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
            Input Manual
          </button>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-400 border-b border-slate-100">
            <tr>
              <th class="px-6 py-4">Nama Bahan</th>
              <th class="px-6 py-4 text-center">Stok</th>
              <th class="px-6 py-4">Satuan</th>
              <th class="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-slate-600">
            <tr v-for="item in ingredients" :key="item.id" class="hover:bg-blue-50/30 transition-all">
              <td class="px-6 py-5 font-bold text-slate-900">{{ item.name }}</td>
              <td class="px-6 py-5 text-center">
                 <span :class="item.quantity < 10 ? 'text-red-500 font-black' : 'text-emerald-600 font-bold'">{{ item.quantity }}</span>
              </td>
              <td class="px-6 py-5 text-slate-400 font-medium">{{ item.unit }}</td>
              <td class="px-6 py-5 text-center">
                <button @click="deleteItem(item.id)" class="text-red-400 hover:text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors">Hapus</button>
              </td>
            </tr>
            <tr v-if="ingredients.length === 0">
              <td colspan="4" class="px-6 py-10 text-center text-gray-500">Stok kosong atau data tidak terbaca.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Modal Input Manual -->
    <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
       <div class="bg-white rounded-2xl w-full max-w-lg p-6">
          <h3 class="text-slate-900 font-bold mb-4">Input Manual Bahan Baku</h3>
          <div class="space-y-3">
             <input v-model="form.name" placeholder="Nama Bahan" class="w-full p-2 bg-slate-50 text-slate-900 rounded-lg border border-slate-200" />
             <div class="grid grid-cols-2 gap-2">
                <input type="number" v-model.number="form.quantity" placeholder="Kuantitas" class="p-2 bg-slate-50 text-slate-900 rounded-lg border border-slate-200" />
                <input v-model="form.unit" placeholder="Satuan (kg, liter, dll)" class="p-2 bg-slate-50 text-slate-900 rounded-lg border border-slate-200" />
             </div>
          </div>
          <div class="mt-6 flex gap-2">
             <button @click="showModal = false" class="flex-1 p-2 bg-slate-200 text-slate-700 rounded-lg font-bold">Batal</button>
             <button @click="saveManualItem" class="flex-1 p-2 bg-blue-600 text-white rounded-lg font-bold">Simpan</button>
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

const ingredients = ref([])
const showModal = ref(false)
const form = ref({ name: '', quantity: 0, unit: 'kg' })
const isScanning = ref(false)

const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('mbg_token')}` })

async function fetchItems() {
  try {
    const res = await axios.get(`${API_BASE_URL}/ingredients`, { headers: getHeaders() })
    ingredients.value = res.data.data || []
  } catch (e) { console.error(e) }
}

function openModal() {
  form.value = { name: '', quantity: 0, unit: 'kg' }
  showModal.value = true
}

async function saveManualItem() {
  try {
    await axios.post(`${API_BASE_URL}/ingredients`, form.value, { headers: getHeaders() })
    showModal.value = false
    await fetchItems()
  } catch (e) {
    alert("Gagal menyimpan bahan.")
  }
}

async function handleScan(event) {
  const file = event.target.files[0]
  if (!file) return

  isScanning.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    // 1. Scan via Llama Vision (FastAPI)
    const visionRes = await axios.post('http://localhost:9000/vision/analyze/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    const parsedIngredients = visionRes.data.ingredients || []
    
    // 2. Simpan ke database via Golang Backend
    for (const item of parsedIngredients) {
      // Parse "1 kg" -> 1 (quantity), "kg" (unit)
      let qty = 1
      let unit = "kg"
      
      const qtyStr = String(item.quantity).trim().toLowerCase()
      const match = qtyStr.match(/([\d\.,]+)\s*([a-z]+)/)
      
      if (match) {
         qty = parseFloat(match[1].replace(',', '.'))
         unit = match[2]
      } else {
         qty = parseFloat(qtyStr) || 1
      }
      
      await axios.post(`${API_BASE_URL}/ingredients`, {
        name: item.name,
        quantity: qty,
        unit: unit
      }, { headers: getHeaders() })
    }
    
    alert(`Berhasil mengekstrak dan menyimpan ${parsedIngredients.length} bahan dari nota.`)
    await fetchItems()
  } catch (e) {
    console.error(e)
    alert("Gagal menscan nota. Pastikan AI Service menyala.")
  } finally {
    isScanning.value = false
    event.target.value = '' // reset file input
  }
}

// NOTE: Handler doesn't have DELETE endpoint for ingredients yet, so deleting might fail.
async function deleteItem(id) {
  if(!confirm('Hapus?')) return
  try {
    // Assume DELETE endpoint exists or will be added
    await axios.delete(`${API_BASE_URL}/ingredients/${id}`, { headers: getHeaders() })
    await fetchItems()
  } catch (e) {
    alert('Hapus gagal')
  }
}

onMounted(fetchItems)
</script>
