<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white">Kustomisasi Template</h2>
          <p class="text-gray-400 text-sm">Atur tampilan dan identitas visual dashboard Anda.</p>
        </div>
      </div>

      <!-- Theme Customization Card -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Edit Form -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-xl">🎨</span>
            <h3 class="text-lg font-semibold text-white">Tema Visual</h3>
          </div>

          <div v-for="style in styles" :key="style.id" class="space-y-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
            <div class="flex items-center justify-between">
              <h4 class="text-white font-medium">{{ style.theme_name }}</h4>
              <span v-if="style.is_active" class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">AKTIF</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label class="text-xs text-gray-400">Warna Utama (Primary)</label>
                <div class="flex items-center gap-2">
                  <input type="color" v-model="style.primary_color" class="w-10 h-10 rounded bg-transparent border-none cursor-pointer" />
                  <input type="text" v-model="style.primary_color" class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div class="space-y-2">
                <label class="text-xs text-gray-400">Warna Sekunder</label>
                <div class="flex items-center gap-2">
                  <input type="color" v-model="style.secondary_color" class="w-10 h-10 rounded bg-transparent border-none cursor-pointer" />
                  <input type="text" v-model="style.secondary_color" class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
            </div>

            <div class="pt-2">
              <button @click="updateStyle(style)" 
                :disabled="saving"
                class="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all disabled:opacity-50">
                {{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Preview Card -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div class="flex items-center gap-2 mb-6">
            <span class="text-xl">👁️</span>
            <h3 class="text-lg font-semibold text-white">Preview Template</h3>
          </div>

          <div class="aspect-video rounded-xl border border-gray-800 bg-gray-950 overflow-hidden relative p-4 space-y-3">
             <!-- Fake Dashboard UI -->
             <div class="flex gap-2">
                <div class="w-12 h-3 rounded" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                <div class="w-8 h-3 rounded opacity-30" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
             </div>
             <div class="grid grid-cols-3 gap-2">
                <div class="h-16 rounded-lg bg-gray-900 border border-gray-800 p-2 space-y-2">
                   <div class="w-full h-1 rounded opacity-20" :style="{ backgroundColor: activeStyle?.secondary_color || '#3b82f6' }"></div>
                   <div class="w-2/3 h-2 rounded" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                </div>
                <div class="h-16 rounded-lg bg-gray-900 border border-gray-800 p-2 space-y-2">
                   <div class="w-full h-1 rounded opacity-20" :style="{ backgroundColor: activeStyle?.secondary_color || '#3b82f6' }"></div>
                   <div class="w-1/2 h-2 rounded" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                </div>
                <div class="h-16 rounded-lg bg-gray-900 border border-gray-800 p-2 space-y-2">
                   <div class="w-full h-1 rounded opacity-20" :style="{ backgroundColor: activeStyle?.secondary_color || '#3b82f6' }"></div>
                   <div class="w-3/4 h-2 rounded" :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }"></div>
                </div>
             </div>
             <div class="h-20 rounded-lg border border-dashed border-gray-800 flex items-center justify-center">
                <div class="text-[10px] text-gray-700 font-mono">LIVE PREVIEW AREA</div>
             </div>

             <div class="absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-lg"
                  :style="{ backgroundColor: activeStyle?.primary_color || '#22c55e' }">
               CONTOH TOMBOL
             </div>
          </div>
          
          <div class="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p class="text-blue-400 text-xs leading-relaxed">
              <strong>Info:</strong> Perubahan warna di sini akan disimpan ke <code>customized.db</code> (SQLite) dan akan mempengaruhi tampilan komponen frontend yang menggunakan variabel warna dinamis.
            </p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import AppLayout from '@/Layouts/AppLayout.vue'
import axios from 'axios'

const styles = ref([])
const loading = ref(true)
const saving = ref(false)

const activeStyle = computed(() => styles.value.find(s => s.is_active))

onMounted(fetchStyles)

async function fetchStyles() {
  try {
    const res = await axios.get('/api/customized/styles')
    styles.value = res.data.data
  } catch (err) {
    console.error('Gagal ambil style:', err)
  } finally {
    loading.value = false
  }
}

async function updateStyle(style) {
  saving.value = true
  try {
    const token = localStorage.getItem('mbg_token')
    await axios.put(`/api/customized/styles/${style.id}`, {
      primary_color: style.primary_color,
      secondary_color: style.secondary_color,
      is_active: style.is_active
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    alert('Tema berhasil diperbarui!')
    fetchStyles()
  } catch (err) {
    alert('Gagal memperbarui tema: ' + (err.response?.data?.message || err.message))
  } finally {
    saving.value = false
  }
}
</script>
