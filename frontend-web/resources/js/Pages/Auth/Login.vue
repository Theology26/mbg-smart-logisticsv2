<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900">
    <div class="max-w-md w-full p-10 bg-white rounded-[40px] shadow-2xl shadow-blue-500/10 border border-slate-200">
      <div class="text-center mb-10">
        <h1 class="text-3xl font-black text-slate-900 mb-2 tracking-tight">MBG <span class="text-blue-600">Smart Logistics</span></h1>
        <p class="text-slate-500 text-sm font-medium">Sparkling Cleaners Distribution Portal</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Access</label>
          <input 
            v-model="form.email" 
            type="email" 
            required
            class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-slate-900 placeholder-slate-300 outline-none transition-all"
            placeholder="admin@mbg.com"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Secure Password</label>
          <input 
            v-model="form.password" 
            type="password" 
            required
            class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-slate-900 placeholder-slate-300 outline-none transition-all"
            placeholder="••••••••"
          />
        </div>

        <div v-if="errorMsg" class="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center">
          {{ errorMsg }}
        </div>

        <button 
          type="submit" 
          :disabled="isLoading"
          class="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] flex justify-center items-center uppercase tracking-widest text-xs"
          :class="{'opacity-50 cursor-not-allowed': isLoading}"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoading ? 'Memproses...' : 'Masuk (Login)' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'

const form = ref({
  email: '',
  password: ''
})

const isLoading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  isLoading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    
    const data = await res.json()
    
    if (res.ok) {
      // Store JWT token and user info
      localStorage.setItem('mbg_token', data.data.token)
      localStorage.setItem('mbg_user', JSON.stringify(data.data.user))
      localStorage.setItem('mbg_role', data.data.user.role)
      
      // Use Inertia to navigate to dashboard
      router.visit('/dashboard')
    } else {
      errorMsg.value = data.message || 'Login gagal. Periksa kembali email dan password Anda.'
    }
  } catch (err) {
    errorMsg.value = 'Tidak dapat terhubung ke server backend API.'
  } finally {
    isLoading.value = false
  }
}
</script>
