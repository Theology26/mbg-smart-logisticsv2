<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-white text-xl font-bold">🥘 Inventaris Bahan Baku</h2>
        <button @click="openModal()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold">Tambah Bahan</button>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-800 text-gray-400">
            <tr>
              <th class="px-6 py-4">Nama Bahan</th>
              <th class="px-6 py-4 text-center">Stok</th>
              <th class="px-6 py-4">Satuan</th>
              <th class="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800 text-gray-300">
            <tr v-for="item in ingredients" :key="item.id" class="hover:bg-gray-800/50">
              <td class="px-6 py-4 font-bold text-white">{{ item.name }}</td>
              <td class="px-6 py-4 text-center">
                 <span :class="item.quantity < 10 ? 'text-red-400' : 'text-emerald-400'">{{ item.quantity }}</span>
              </td>
              <td class="px-6 py-4">{{ item.unit }}</td>
              <td class="px-6 py-4 text-center">
                <button @click="deleteItem(item.id)" class="text-red-400 hover:underline">Hapus</button>
              </td>
            </tr>
            <tr v-if="ingredients.length === 0">
              <td colspan="4" class="px-6 py-10 text-center text-gray-500">Stok kosong atau data tidak terbaca.</td>
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

const ingredients = ref([])

async function fetchItems() {
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  try {
    const res = await axios.get(`${API_BASE_URL}/ingredients/`, { headers })
    ingredients.value = res.data.data || []
  } catch (e) { console.error(e) }
}

async function deleteItem(id) {
  if(!confirm('Hapus?')) return
  const headers = { Authorization: `Bearer ${localStorage.getItem('mbg_token')}` }
  await axios.delete(`${API_BASE_URL}/ingredients/${id}/`, { headers })
  fetchItems()
}

onMounted(fetchItems)
</script>
