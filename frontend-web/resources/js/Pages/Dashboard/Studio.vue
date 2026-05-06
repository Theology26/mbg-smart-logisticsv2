<template>
  <div class="min-h-screen bg-gray-950 text-white font-sans selection:bg-green-500/30 overflow-hidden flex flex-col">
    <!-- Topbar Studio -->
    <header class="h-16 border-b border-white/10 px-8 flex items-center justify-between bg-gray-900/50 backdrop-blur-xl z-50">
      <div class="flex items-center gap-4">
        <button @click="goBack" class="p-2 hover:bg-white/5 rounded-full transition-all text-gray-400">
            <span class="text-xl">←</span>
        </button>
        <div>
            <h1 class="font-bold text-sm tracking-tight">MBG MASTER STUDIO <span class="text-[10px] bg-indigo-600 px-1.5 py-0.5 rounded ml-2">ULTIMATE</span></h1>
            <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Universal Platform Controller</p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
            <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span class="text-[10px] font-bold text-gray-400 uppercase">Live Engine Active</span>
        </div>
        <div class="h-8 w-[1px] bg-white/10 mx-2"></div>
        <button @click="saveChanges" :disabled="saving" class="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all shadow-lg shadow-indigo-900/40 flex items-center gap-2">
            <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full w-3 h-3"></span>
            {{ saving ? 'SYNCING DATABASE...' : 'PUBLISH CHANGES' }}
        </button>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
        <!-- Left Panel: The Controller -->
        <aside class="w-96 border-r border-white/10 bg-gray-900/40 backdrop-blur-md flex flex-col overflow-hidden">
            <!-- Sidebar Tabs -->
            <div class="flex border-b border-white/5 bg-black/20">
                <button v-for="t in tabs" :key="t.id" 
                    @click="activeTab = t.id"
                    :class="['flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2', activeTab === t.id ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-gray-500 hover:text-gray-300']">
                    {{ t.icon }}
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scroll">
                
                <!-- TAB: APPEARANCE -->
                <div v-if="activeTab === 'appearance'" class="space-y-8 animate-in fade-in slide-in-from-left-4">
                    <div class="space-y-4">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <span>🎨</span> Brand Visual Palette
                        </label>
                        <div class="grid grid-cols-1 gap-4">
                            <div class="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-medium text-gray-300">Primary Color</span>
                                    <input type="color" v-model="activeStyle.primary_color" class="w-8 h-8 rounded bg-transparent border-none cursor-pointer" />
                                </div>
                                <input v-model="activeStyle.primary_color" type="text" class="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono" />
                            </div>
                            <div class="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-medium text-gray-300">Secondary Color</span>
                                    <input type="color" v-model="activeStyle.secondary_color" class="w-8 h-8 rounded bg-transparent border-none cursor-pointer" />
                                </div>
                                <input v-model="activeStyle.secondary_color" type="text" class="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB: IDENTITY -->
                <div v-if="activeTab === 'identity'" class="space-y-6 animate-in fade-in slide-in-from-left-4">
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">🏢 Platform Branding</label>
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-[10px] text-gray-600 font-bold">INDUSTRY NAME</label>
                            <input v-model="config.industry_name" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] text-gray-600 font-bold">SUPPORT EMAIL</label>
                            <input v-model="config.company_email" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                </div>

                <!-- TAB: LABELS -->
                <div v-if="activeTab === 'labels'" class="space-y-6 animate-in fade-in slide-in-from-left-4">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">🏷️ Custom Labeling</label>
                        <button @click="addNewLabel" class="text-indigo-400 text-[10px] font-bold hover:underline">+ ADD NEW</button>
                    </div>
                    <div class="space-y-4">
                        <div v-for="(l, i) in customLabels" :key="i" class="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 relative group">
                            <button @click="removeLabel(i)" class="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                            <input v-model="l.label_key" type="text" class="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-500" placeholder="KEY_NAME" />
                            <input v-model="l.label_value" type="text" class="w-full bg-transparent border-b border-white/10 px-0 py-1 text-sm outline-none focus:border-indigo-500" placeholder="Display Text" />
                        </div>
                    </div>
                </div>

                <!-- TAB: AI RULES -->
                <div v-if="activeTab === 'ai'" class="space-y-6 animate-in fade-in slide-in-from-left-4">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">🧠 AI Rule Engine</label>
                        <button @click="addNewRule" class="text-indigo-400 text-[10px] font-bold hover:underline">+ NEW RULE</button>
                    </div>
                    <div v-for="(rule, i) in rules" :key="i" class="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-4 relative group">
                        <button @click="removeRule(i)" class="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                        <input v-model="rule.category_name" type="text" class="bg-transparent border-none p-0 text-sm font-bold w-full outline-none" placeholder="Category Name" />
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] text-gray-600 font-bold uppercase">Urgency</label>
                                <input v-model="rule.urgency_factor" type="number" step="0.1" class="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-xs" />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] text-gray-600 font-bold uppercase">Hours</label>
                                <input v-model="rule.expiry_hours" type="number" class="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-xs" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </aside>

        <!-- Center Panel: The Live Tablet Preview -->
        <section class="flex-1 bg-black p-12 flex items-center justify-center relative overflow-hidden">
            <!-- Background Gradients -->
            <div class="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600 rounded-full blur-[120px]"></div>
                <div class="absolute bottom-1/4 right-1/4 w-96 h-96 :style="{backgroundColor: activeStyle.primary_color}" class="rounded-full blur-[120px]"></div>
            </div>

            <div class="absolute top-6 left-6 flex items-center gap-6">
                <div class="text-[10px] text-gray-600 font-mono uppercase tracking-[0.4em]">Live System Simulation</div>
                <div class="flex gap-1">
                    <div class="w-1 h-1 rounded-full bg-gray-800"></div>
                    <div class="w-1 h-1 rounded-full bg-gray-800"></div>
                    <div class="w-1 h-1 rounded-full bg-gray-800"></div>
                </div>
            </div>
            
            <!-- Tablet Preview -->
            <div class="w-full max-w-5xl aspect-[16/10] bg-gray-900 rounded-[3rem] border-[14px] border-gray-800 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative scale-90">
                <!-- Inner UI Mockup -->
                <nav class="h-14 border-b border-white/5 px-8 flex items-center justify-between bg-black/20">
                    <div class="flex items-center gap-3">
                        <div class="w-4 h-4 rounded-lg rotate-12" :style="{backgroundColor: activeStyle.primary_color}"></div>
                        <span class="text-xs font-black tracking-tighter uppercase">{{ config.industry_name }}</span>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="flex gap-4">
                             <div v-for="i in 3" :key="i" class="w-10 h-1.5 rounded-full bg-white/5"></div>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-white/10 border border-white/10"></div>
                    </div>
                </nav>
                <div class="flex-1 flex">
                    <!-- Sidebar Mockup -->
                    <div class="w-24 border-r border-white/5 p-6 space-y-6 bg-black/10">
                        <div v-for="i in 6" :key="i" class="w-full aspect-square rounded-2xl flex items-center justify-center transition-all" 
                             :style="i === 1 ? {backgroundColor: activeStyle.primary_color + '20', border: '1px solid ' + activeStyle.primary_color + '40'} : {backgroundColor: 'rgba(255,255,255,0.03)'}">
                             <div class="w-4 h-4 rounded" :style="i === 1 ? {backgroundColor: activeStyle.primary_color} : {backgroundColor: 'rgba(255,255,255,0.1)'}"></div>
                        </div>
                    </div>
                    <!-- Content Mockup -->
                    <div class="flex-1 p-10 space-y-8 bg-gray-950/50">
                        <div class="flex items-center justify-between">
                            <div class="space-y-2">
                                <div class="h-6 w-48 rounded-lg bg-white/5"></div>
                                <div class="h-3 w-32 rounded-lg bg-white/5 opacity-50"></div>
                            </div>
                            <div class="h-12 w-40 rounded-2xl shadow-xl flex items-center justify-center text-[10px] font-black tracking-widest text-white" :style="{backgroundColor: activeStyle.primary_color}">
                                NEW DELIVERY
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-4 gap-6">
                            <div v-for="i in 4" :key="i" class="h-32 rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 space-y-4">
                                <div class="w-8 h-8 rounded-xl bg-white/5"></div>
                                <div class="w-full h-2 rounded-full" :style="{backgroundColor: activeStyle.secondary_color, opacity: 0.1}"></div>
                                <div class="w-2/3 h-4 rounded-lg" :style="{backgroundColor: activeStyle.primary_color}"></div>
                            </div>
                        </div>

                        <div class="grid grid-cols-12 gap-6">
                            <div class="col-span-8 h-48 rounded-[2.5rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 p-8">
                                <div class="flex justify-between items-start mb-8">
                                    <div class="h-4 w-32 rounded bg-white/10"></div>
                                    <div class="flex gap-2">
                                        <div class="w-2 h-2 rounded-full" :style="{backgroundColor: activeStyle.primary_color}"></div>
                                        <div class="w-2 h-2 rounded-full bg-white/10"></div>
                                    </div>
                                </div>
                                <div class="flex items-end gap-3 h-20">
                                    <div v-for="i in 12" :key="i" class="flex-1 rounded-t-lg bg-white/5" :style="{height: (Math.random() * 100) + '%', backgroundColor: i % 3 === 0 ? activeStyle.primary_color : 'rgba(255,255,255,0.05)'}"></div>
                                </div>
                            </div>
                            <div class="col-span-4 h-48 rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center justify-center space-y-3">
                                <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl">📍</div>
                                <span class="text-[10px] text-gray-600 font-bold uppercase tracking-widest">MAP PREVIEW</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const activeTab = ref('appearance')
const tabs = [
    { id: 'appearance', icon: '🎨' },
    { id: 'identity', icon: '🏢' },
    { id: 'labels', icon: '🏷️' },
    { id: 'ai', icon: '🧠' },
]

const styles = ref([])
const config = ref({})
const customLabels = ref([])
const rules = ref([])
const activeStyle = ref({ primary_color: '#6366f1', secondary_color: '#a855f7' })
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
    try {
        const [resStyles, resConfig, resLabels, resRules] = await Promise.all([
            axios.get('/api/customized/styles'),
            axios.get('/api/customized/config'),
            axios.get('/api/customized/labels'),
            axios.get('/api/customized/rules')
        ])
        styles.value = resStyles.data.data
        config.value = resConfig.data.data
        customLabels.value = resLabels.data.data
        rules.value = resRules.data.data
        
        if (styles.value.length > 0) {
            activeStyle.value = styles.value.find(s => s.is_active) || styles.value[0]
        }
    } catch (err) {
        console.error(err)
    } finally {
        loading.value = false
    }
})

function goBack() { window.location.href = '/dashboard' }

function addNewLabel() { customLabels.value.push({ label_key: '', label_value: '', category: 'General' }) }
function removeLabel(index) { customLabels.value.splice(index, 1) }

function addNewRule() { rules.value.push({ category_name: '', urgency_factor: 0.5, expiry_hours: 6, description: '' }) }
function removeRule(index) { rules.value.splice(index, 1) }

async function saveChanges() {
    saving.value = true
    try {
        await Promise.all([
            axios.put(`/api/customized/styles/${activeStyle.value.id}`, activeStyle.value),
            axios.put('/api/customized/config', config.value),
            ...customLabels.value.map(l => axios.put('/api/customized/labels', l)),
            ...rules.value.map(r => r.id ? axios.put(`/api/customized/rules/${r.id}`, r) : Promise.resolve())
        ])
        alert('ALL SYSTEMS SYNCED SUCCESSFULLY!')
        window.location.reload()
    } catch (err) {
        alert('SYNC FAILED')
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
.animate-in { animation-duration: 0.4s; }
</style>
