const API_BASE = 'http://localhost:8080/api';
const dynamicContainer = document.getElementById('dynamicSections');
const statusEl = document.getElementById('apiStatus');
const form = document.getElementById('configForm');

// Logical grouping of keys
const GROUPS = [
    {
        id: 'branding',
        title: 'Branding & Identity',
        icon: '🎨',
        keys: ['app_name', 'theme_color', 'company_logo_url', 'currency_symbol', 'contact_email']
    },
    {
        id: 'logistics',
        title: 'Logistics & Map Parameters',
        icon: '🚚',
        keys: ['map_center_lat', 'map_center_lng', 'delivery_radius_km', 'max_courier_load_kg', 'strict_expiration_mode']
    },
    {
        id: 'ai',
        title: 'AI & System Modules',
        icon: '✨',
        keys: ['enable_ai_menu']
    }
];

let allSettings = {};

async function init() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (!response.ok) throw new Error();
        const result = await response.json();
        allSettings = result.data;
        renderUI();
        updateStatus(true);
    } catch (err) {
        updateStatus(false);
        dynamicContainer.innerHTML = `
            <div class="bg-red-50 border border-red-100 rounded-3xl p-12 text-center">
                <p class="text-red-600 font-bold mb-2">API Connection Failed</p>
                <p class="text-red-400 text-sm">Please ensure the Golang backend is running on port 8080.</p>
            </div>
        `;
    }
}

function updateStatus(connected) {
    if (connected) {
        statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> API ONLINE';
        statusEl.className = 'flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold';
    } else {
        statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> API OFFLINE';
        statusEl.className = 'flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold';
    }
}

function renderUI() {
    dynamicContainer.innerHTML = '';
    const groupedKeys = GROUPS.flatMap(g => g.keys);
    const customKeys = Object.keys(allSettings).filter(k => !groupedKeys.includes(k));

    GROUPS.forEach(group => {
        dynamicContainer.appendChild(createSection(group.title, group.icon, group.keys));
    });

    if (customKeys.length > 0) {
        dynamicContainer.appendChild(createSection('Custom Parameters', '🔧', customKeys));
    }
}

function createSection(title, icon, keys) {
    const section = document.createElement('section');
    section.className = 'space-y-6';
    section.innerHTML = `
        <div class="flex items-center gap-3 ml-1">
            <span class="text-xl">${icon}</span>
            <h2 class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">${title}</h2>
        </div>
        <div class="studio-card rounded-[32px] overflow-hidden divide-y divide-slate-100">
            ${keys.map(key => renderRow(key, allSettings[key])).join('')}
        </div>
    `;
    return section;
}

function renderRow(key, value) {
    const isBoolean = value === 'true' || value === 'false';
    const isColor = key.includes('color');
    
    return `
        <div class="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 group hover:bg-slate-50/50 transition-all">
            <div class="space-y-1">
                <label class="text-sm font-bold text-slate-700 block">${formatLabel(key)}</label>
                <code class="text-[10px] text-blue-500 font-bold uppercase tracking-wider">${key}</code>
            </div>
            
            <div class="w-full lg:w-96">
                ${isBoolean ? `
                    <div class="flex items-center justify-end">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="${key}" class="sr-only peer" ${value === 'true' ? 'checked' : ''}>
                            <div class="w-14 h-8 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>
                ` : `
                    <div class="relative flex items-center">
                        <input type="text" name="${key}" value="${value}" 
                            class="w-full input-field rounded-2xl px-6 py-4 text-sm font-medium outline-none transition-all">
                        ${isColor ? `<div class="absolute right-4 w-6 h-6 rounded-lg border-2 border-white shadow-sm" style="background: ${value}"></div>` : ''}
                    </div>
                `}
            </div>
        </div>
    `;
}

function formatLabel(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

document.getElementById('addParamBtn').addEventListener('click', () => {
    const key = document.getElementById('newKey').value.trim();
    const val = document.getElementById('newValue').value.trim();
    if (!key || !val) return;
    allSettings[key] = val;
    document.getElementById('newKey').value = '';
    document.getElementById('newValue').value = '';
    renderUI();
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerText;
    
    saveBtn.disabled = true;
    saveBtn.innerText = 'DEPLOYING...';

    const inputs = form.querySelectorAll('input[name]');
    const updatedSettings = { ...allSettings };
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            updatedSettings[input.name] = input.checked ? 'true' : 'false';
        } else {
            updatedSettings[input.name] = input.value;
        }
    });

    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedSettings)
        });
        if (!response.ok) throw new Error();
        document.getElementById('successModal').classList.remove('hidden');
    } catch (err) {
        alert('Deployment Failed. Check API.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
    }
});

init();
