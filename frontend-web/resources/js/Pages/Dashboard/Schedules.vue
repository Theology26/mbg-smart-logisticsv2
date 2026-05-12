<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-white text-xl font-bold">📅 Jadwal Produksi Dapur</h2>
        <div class="flex gap-2">
          <button @click="showForm = !showForm"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all">
            + Buat Jadwal
          </button>
          <button @click="mintaSaranAI" :disabled="aiLoading"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50">
            <span v-if="aiLoading" class="animate-spin">🔄</span>
            <span v-else>✨</span>
            Minta Saran AI
          </button>
        </div>
      </div>

      <div v-if="showForm" class="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
        <h3 class="text-white font-bold mb-4">Buat Jadwal Masak Baru</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="col-span-1 md:col-span-2">
            <label class="text-gray-400 text-xs uppercase font-bold">Pilih Menu (atau Ketik Manual)</label>
            <div class="flex gap-2 mt-1">
              <select v-model="form.menu_id" class="w-1/2 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white">
                <option value="">-- Pilih Menu Database --</option>
                <option v-for="m in menus" :key="m.id" :value="m.id">{{ m.name }} ({{ m.category }})</option>
              </select>
              <input v-model="form.manual_menu" placeholder="Atau ketik menu baru (Nemotron akan hitung)..." class="w-1/2 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
            </div>
          </div>
          <div class="col-span-1 md:col-span-2 mt-2">
            <label class="text-gray-400 text-xs uppercase font-bold">Sekolah Tujuan (Bisa Pilih Banyak)</label>
            <div class="grid grid-cols-2 mt-2 gap-2 max-h-40 overflow-y-auto pr-2">
              <label v-for="s in schools" :key="s.id" class="flex items-center gap-2 text-white bg-gray-800 p-2 rounded cursor-pointer">
                <input type="checkbox" :value="s.id" v-model="form.school_ids" class="accent-emerald-500 rounded" />
                <span class="text-sm">{{ s.name }} ({{ s.demand_quantity }})</span>
              </label>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button @click="submitSchedule(false)" class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-all">Simpan (Persiapan)</button>
          <button @click="submitSchedule(true)" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all">Selesai Masak & Mulai AI Routing</button>
        </div>
      </div>

      <!-- Nemotron AI Suggestion Card -->
      <div v-if="aiSuggestion" class="bg-purple-900/30 border border-purple-500/50 p-6 rounded-2xl relative overflow-hidden">
        <div class="absolute top-0 right-0 p-4 opacity-10 text-6xl">🤖</div>
        <h3 class="text-purple-300 font-bold mb-2">Saran Menu Optimal:</h3>
        <p class="text-white text-xl font-black mb-4">{{ aiSuggestion.suggested_menu }}</p>
        <div class="bg-gray-900/50 p-4 rounded-xl">
          <p class="text-gray-300 text-sm italic">"{{ aiSuggestion.reasoning }}"</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="sc in schedules" :key="sc.id" class="bg-gray-900 border border-gray-800 p-5 rounded-2xl">
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-emerald-400 text-[10px] font-bold uppercase">Menu #{{ sc.id }}</p>
              <h3 class="text-white font-bold text-lg">{{ sc.menu?.name || 'Nasi Kotak MBG' }}</h3>
            </div>
            <div class="text-right">
              <p class="text-gray-500 text-[10px] uppercase">Epsilon</p>
              <p class="text-white font-black">{{ (sc.epsilon_score || 0).toFixed(2) }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">Status</span>
              <span :class="sc.is_cooked ? 'text-emerald-400' : 'text-yellow-400'" class="font-bold uppercase">{{ sc.is_cooked ? 'Selesai Masak' : 'Persiapan' }}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">Kuantitas</span>
              <span class="text-white font-bold">{{ sc.total_quantity }} Porsi</span>
            </div>
          </div>
          
          <div v-if="!sc.is_cooked" class="mt-4 pt-4 border-t border-gray-800">
            <button @click="markAsCooked(sc.id, sc.menu?.category || 'Basah', sc.epsilon_score)" class="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/50 rounded-lg text-xs font-bold transition-all uppercase tracking-wider">
              Tandai Selesai Masak
            </button>
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
const menus = ref([])
const schools = ref([])
const aiSuggestion = ref(null)
const aiLoading = ref(false)
const showForm = ref(false)

const form = ref({
  menu_id: '',
  manual_menu: '',
  school_ids: []
})

const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('mbg_token')}` })

async function fetchSchedules() {
  try {
    const res = await axios.get(`${API_BASE_URL}/schedules`, { headers: getHeaders() })
    schedules.value = res.data.data || []
    
    const menuRes = await axios.get(`${API_BASE_URL}/menus`, { headers: getHeaders() })
    menus.value = menuRes.data.data || []

    const schoolRes = await axios.get(`${API_BASE_URL}/schools`, { headers: getHeaders() })
    schools.value = schoolRes.data.data || []
  } catch (e) { console.error(e) }
}

async function submitSchedule(isCooked) {
  if (!form.value.menu_id && !form.value.manual_menu) return alert('Pilih menu atau ketik manual!');
  if (form.value.school_ids.length === 0) return alert('Pilih minimal 1 sekolah tujuan!');

  try {
    let finalMenuId = form.value.menu_id;
    let category = "Basah";
    let epsilon = 0.5;

    // Handle Nemotron AI calculation for manual menu
    if (form.value.manual_menu) {
      alert("Menghubungi AI Nemotron untuk mengklasifikasi " + form.value.manual_menu + "...");
      const nemotronRes = await axios.post(`http://localhost:9000/decision/calculate-epsilon`, {
        menu_name: form.value.manual_menu
      });
      category = nemotronRes.data.category;
      epsilon = nemotronRes.data.epsilon_score;
      alert(`AI Nemotron: Kategori ${category}, Epsilon ${epsilon}\nAlasan: ${nemotronRes.data.reasoning}`);
      
      // Save Menu to DB
      const newMenuRes = await axios.post(`${API_BASE_URL}/menus`, {
        name: form.value.manual_menu,
        category: category,
        ingredients_required: ""
      }, { headers: getHeaders() });
      finalMenuId = newMenuRes.data.data.id;
    } else {
      const selectedMenu = menus.value.find(m => m.id === form.value.menu_id);
      category = selectedMenu.category;
    }

    const cookTime = isCooked ? new Date().toISOString() : null;
    
    // First calculate expiration based on cook time (or placeholder if not cooked)
    const expRes = await axios.post(`${API_BASE_URL}/expiration/calculate`, {
      category: category,
      cook_time: cookTime || new Date().toISOString(),
      temperature: 28.0
    }, { headers: getHeaders() });
    
    const expirationData = expRes.data.data;
    
    const schedRes = await axios.post(`${API_BASE_URL}/schedules`, {
      menu_id: finalMenuId,
      cooking_completion_time: cookTime,
      expiration_time: isCooked ? expirationData.expiration_time : null,
      epsilon_score: form.value.manual_menu ? epsilon : expirationData.epsilon_score,
      is_cooked: isCooked
    }, { headers: getHeaders() });
    
    const newSchedule = schedRes.data.data.schedule;

    // Create Delivery for multiple schools
    for (const s_id of form.value.school_ids) {
      await axios.post(`${API_BASE_URL}/deliveries`, {
        schedule_id: newSchedule.id,
        school_id: s_id,
        status: 'pending'
      }, { headers: getHeaders() });
    }
    
    alert(isCooked ? 'Selesai Masak! Routing kurir akan memperhitungkan titik nol kesegaran mulai sekarang.' : 'Jadwal persiapan disimpan!');
    showForm.value = false;
    form.value.menu_id = '';
    form.value.manual_menu = '';
    form.value.school_ids = [];
    fetchSchedules();
  } catch (e) {
    alert('Gagal membuat jadwal.');
    console.error(e);
  }
}

async function markAsCooked(scheduleId, category, epsilonScore) {
  if (!confirm("Apakah masakan sudah benar-benar matang? AI akan mulai menghitung masa kedaluwarsa dari sekarang.")) return;
  
  try {
    const cookTime = new Date().toISOString();
    
    // Calculate new expiration time
    const expRes = await axios.post(`${API_BASE_URL}/expiration/calculate`, {
      category: category,
      cook_time: cookTime,
      temperature: 28.0
    }, { headers: getHeaders() });
    
    const expirationData = expRes.data.data;
    
    // Update schedule
    await axios.put(`${API_BASE_URL}/schedules/${scheduleId}`, {
      is_cooked: true,
      cooking_completion_time: cookTime,
      expiration_time: expirationData.expiration_time,
      epsilon_score: epsilonScore || expirationData.epsilon_score
    }, { headers: getHeaders() });
    
    alert("Berhasil! Masakan ditandai matang dan rute Kurir akan disesuaikan oleh AI berdasarkan waktu kesegaran ini.");
    fetchSchedules();
  } catch (e) {
    console.error(e);
    alert("Gagal memperbarui status masakan.");
  }
}

async function mintaSaranAI() {
  aiLoading.value = true;
  aiSuggestion.value = null;
  try {
    // 1. Ambil data ingredients dari Golang backend
    const ingRes = await axios.get(`${API_BASE_URL}/ingredients/`, { headers: getHeaders() });
    const ingredients = ingRes.data.data || [];
    
    if (ingredients.length === 0) {
      alert("Stok bahan kosong! Scan nota terlebih dahulu.");
      aiLoading.value = false;
      return;
    }
    
    // 2. Kirim ke Nemotron (FastAPI)
    // Asumsi risk_level digenerate mockup jika tidak ada, karena backend DB tidak simpan risk_level.
    const mappedIngredients = ingredients.map(i => ({
      name: i.name,
      quantity: `${i.quantity} ${i.unit}`,
      risk_level: i.name.toLowerCase().includes("santan") || i.name.toLowerCase().includes("daging") ? "tinggi" : "rendah"
    }));
    
    const nemotronRes = await axios.post("http://localhost:9000/decision/suggest-menu", {
      ingredients: mappedIngredients
    });
    
    aiSuggestion.value = nemotronRes.data;
  } catch (e) {
    console.error("AI Error:", e);
    const detail = e.response?.data?.detail || e.message;
    alert(`Gagal mendapatkan saran AI: ${detail}`);
  } finally {
    aiLoading.value = false;
  }
}

onMounted(fetchSchedules)
</script>
