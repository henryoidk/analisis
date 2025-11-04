// Variable global para almacenar los datos del dashboard
let dashboardData = null;

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando Panel de Administración');
  
  // Cargar selector de meses primero, luego el dashboard
  await loadVisibleMonthsSelector();
  
  // Cargar datos iniciales
  loadDashboard().catch(err => {
    console.error('Error al cargar el dashboard:', err);
    alert('Error al cargar los datos del dashboard');
  });
});

function money(n) {
  return n.toLocaleString('es-PE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function drawBarFallback(canvas, labels, values) {
  const wrap = canvas.parentElement;
  const w = Math.max(wrap.clientWidth || 800, 400);
  const h = Math.max(wrap.clientHeight || 360, 240);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);

  const padding = { top: 24, right: 24, bottom: 40, left: 48 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const max = Math.max(...values, 1);
  const barW = innerW / labels.length * 0.6;
  const gap = innerW / labels.length * 0.4;

  // background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i=0;i<=ticks;i++){
    const y = padding.top + (innerH/ticks)*i;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
  }

  const colors = ['#60a5fa','#34d399','#fbbf24','#f472b6'];
  const x = (i) => padding.left + i * (barW + gap) + gap/2;
  const y = (v) => padding.top + innerH - (v/max) * innerH;

  // bars
  values.forEach((val, i) => {
    const bx = x(i);
    const by = y(val);
    const bh = padding.top + innerH - by;
    const color = colors[i % colors.length];
    // bar fill
    ctx.fillStyle = color + '99';
    const radius = 10;
    const bw = barW;
    // rounded rect
    ctx.beginPath();
    ctx.moveTo(bx, by + radius);
    ctx.arcTo(bx, by, bx + radius, by, radius);
    ctx.lineTo(bx + bw - radius, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + radius, radius);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx, by + bh);
    ctx.closePath();
    ctx.fill();
    // bar stroke
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    // value label
    ctx.fillStyle = '#9aa3b2'; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(val.toLocaleString('es-PE'), bx + bw/2, by - 6);
  });

  // x labels
  ctx.fillStyle = '#9aa3b2'; ctx.font = '13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    ctx.fillText(label, x(i) + barW/2, h - 14);
  });
}

async function loadDashboard() {
  try {
    console.log('Cargando datos del dashboard...');
    
    // Obtener el mes seleccionado del selector (o usar el actual por defecto)
    const monthSelector = document.getElementById('monthSelector');
    let selectedMonth = monthSelector?.value;
    
    // Si no hay mes seleccionado, usar el actual
    if (!selectedMonth) {
      const now = new Date();
      selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    console.log('Mes seleccionado:', selectedMonth);
    
    const r = await fetch(`/api/dashboard?month=${selectedMonth}`);
    console.log('Estado de la respuesta:', r.status);
    if (!r.ok) {
      const errorText = await r.text();
      console.error('Error en la respuesta:', errorText);
      throw new Error(`HTTP error! status: ${r.status}`);
    }
    const d = await r.json();
    console.log('Datos recibidos:', d);
    
    // Guardar datos en variable global para generar PDF
    dashboardData = d;

    const periodo = document.getElementById('periodo');
    periodo.textContent = `Resumen general de ventas • ${d.period.month} ${d.period.year} • ${d.period.week}`;

    // Actualizar KPIs con datos reales de la base de datos
    document.getElementById('kpiTotal').textContent = money(d.totals.monthly);
    document.getElementById('kpiPromedio').textContent = money(d.totals.perSellerAvg);

    const tbody = document.getElementById('tablaVendedores');
    tbody.innerHTML = '';
    
    // Calcular totales por semana
    let totalS1 = 0, totalS2 = 0, totalS3 = 0, totalS4 = 0, totalGeneral = 0;
    
    d.performance.forEach((p, index) => {
      const tr = document.createElement('tr');
      
      // Acumular totales
      totalS1 += p.s1 || 0;
      totalS2 += p.s2 || 0;
      totalS3 += p.s3 || 0;
      totalS4 += p.s4 || 0;
      totalGeneral += p.total || 0;
      
      // Función helper para formatear números con estilo
      const formatNum = (val) => {
        if (!val || val === 0) return '—';
        return val.toLocaleString('es-PE');
      };
      
      // Agregar clase especial al mejor vendedor
      const isTopSeller = index === 0;
      if (isTopSeller) tr.classList.add('top-seller');
      
      tr.innerHTML = `
        <td class="vendor-name">
          ${isTopSeller ? '<i class="fa-solid fa-crown" style="color: #fbbf24; margin-right: 6px;"></i>' : ''}
          ${p.name}
        </td>
        <td class="num">${formatNum(p.s1)}</td>
        <td class="num">${formatNum(p.s2)}</td>
        <td class="num">${formatNum(p.s3)}</td>
        <td class="num">${formatNum(p.s4)}</td>
        <td class="num total-col"><strong>${formatNum(p.total)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
    
    // Agregar fila de totales
    const trTotal = document.createElement('tr');
    trTotal.classList.add('total-row');
    trTotal.innerHTML = `
      <td class="vendor-name"><strong>TOTAL INGRESOS</strong></td>
      <td class="num"><strong>${totalS1.toLocaleString('es-PE')}</strong></td>
      <td class="num"><strong>${totalS2.toLocaleString('es-PE')}</strong></td>
      <td class="num"><strong>${totalS3.toLocaleString('es-PE')}</strong></td>
      <td class="num"><strong>${totalS4.toLocaleString('es-PE')}</strong></td>
      <td class="num total-col"><strong>${totalGeneral.toLocaleString('es-PE')}</strong></td>
    `;
    tbody.appendChild(trTotal);

    // Chart: evolución semanal (sumatoria de todos los vendedores)
    // Usar los totales ya calculados arriba
    const weeksToShow = [];
    const totalsToShow = [];
    
    // Agregar semanas que tengan datos (> 0)
    if (totalS1 > 0) { weeksToShow.push('S1'); totalsToShow.push(totalS1); }
    if (totalS2 > 0) { weeksToShow.push('S2'); totalsToShow.push(totalS2); }
    if (totalS3 > 0) { weeksToShow.push('S3'); totalsToShow.push(totalS3); }
    if (totalS4 > 0) { weeksToShow.push('S4'); totalsToShow.push(totalS4); }
    
    // Si no hay semanas, mostrar al menos S1 con 0
    if (weeksToShow.length === 0) {
      weeksToShow.push('S1');
      totalsToShow.push(0);
    }
    
    const canvas = document.getElementById('chartSemanal');
    const colors = ['#60a5fa','#34d399','#fbbf24','#f472b6'];

    if (window.Chart) {
      try {
        if (window.chartSemanal && typeof window.chartSemanal.destroy === 'function') {
          window.chartSemanal.destroy();
        }
        window.chartSemanal = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: weeksToShow,
            datasets: [{
              label: 'Total',
              data: totalsToShow,
              backgroundColor: colors.slice(0, weeksToShow.length).map(c => c + '99'),
              borderColor: colors.slice(0, weeksToShow.length),
              borderWidth: 1.5,
              borderRadius: 10,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,.06)' },
                ticks: { color:'#9aa3b2' }
              },
              x: {
                grid: { display:false },
                ticks: { color:'#9aa3b2' }
              }
            },
            plugins: {
              legend: { labels: { color:'#9aa3b2' } },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('es-PE')}`
                }
              }
            }
          }
        });
      } catch (e) {
        console.warn('Fallo Chart.js; uso fallback canvas', e);
        window.chartSemanal = null;
        drawBarFallback(canvas, weeksToShow, totalsToShow);
      }
    } else {
      drawBarFallback(canvas, weeksToShow, totalsToShow);
    }
  } catch (e) {
    console.error(e);
  }
}

// Cargar meses visibles en el selector
async function loadVisibleMonthsSelector() {
  try {
    console.log('📅 Cargando meses visibles para selector...');
    
    const response = await fetch('/api/months-status?year=' + new Date().getFullYear());
    if (!response.ok) {
      throw new Error('Error al cargar meses visibles');
    }
    
    const months = await response.json();
    const visibleMonths = months.filter(m => m.isVisible);
    
    console.log('Meses visibles:', visibleMonths);
    
    const monthSelector = document.getElementById('monthSelector');
    if (!monthSelector) return;
    
    const monthNames = {
      '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
      '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
      '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
    };
    
    // Limpiar selector
    monthSelector.innerHTML = '';
    
    // Agregar opciones de meses visibles
    visibleMonths.forEach(monthData => {
      const [year, month] = monthData.yearMonth.split('-');
      const option = document.createElement('option');
      option.value = monthData.yearMonth;
      option.textContent = `${monthNames[month]} ${year}`;
      monthSelector.appendChild(option);
    });
    
    // Seleccionar el mes actual por defecto
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (visibleMonths.some(m => m.yearMonth === currentMonth)) {
      monthSelector.value = currentMonth;
    }
    
    // Event listener para cambio de mes
    monthSelector.addEventListener('change', () => {
      console.log('Mes cambiado a:', monthSelector.value);
      loadDashboard();
    });
    
  } catch (err) {
    console.error('❌ Error al cargar meses visibles:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Verificar si el usuario es vendedor o admin
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const isVendor = userInfo.role && userInfo.role.toLowerCase().includes('vendedor');
  
  console.log('👤 Usuario detectado:', { username: userInfo.username, role: userInfo.role, isVendor });
  
  // Ocultar Ajustes si es vendedor
  const ajustesMenuItem = document.querySelector('.menu .item[data-section="ajustes"]');
  if (isVendor && ajustesMenuItem) {
    ajustesMenuItem.style.display = 'none';
    console.log('🔒 Sección Ajustes ocultada para vendedor');
    
    // Cambiar el título del sidebar
    const brandElement = document.querySelector('.sidebar .brand');
    if (brandElement) {
      brandElement.innerHTML = 'Ventas<span>Vendor</span>';
    }
  }
  
  // Navigation between sections
  const menuItems = document.querySelectorAll('.menu .item[data-section]');
  const sections = {
    resumen: document.getElementById('section-resumen'),
    ajustes: document.getElementById('section-ajustes'),
  };

  function setActive(section) {
    // Si es vendedor y intenta acceder a ajustes, redirigir a resumen
    if (isVendor && section === 'ajustes') {
      console.log('⚠️ Vendedor intentó acceder a Ajustes, redirigiendo a Resumen');
      section = 'resumen';
    }
    
    menuItems.forEach(el => el.classList.toggle('active', el.dataset.section === section));
    Object.keys(sections).forEach(k => sections[k]?.classList.toggle('hidden', k !== section));
    if (section === 'resumen') loadDashboard();
    if (section === 'ajustes' && !isVendor) loadAjustes();
  }

  menuItems.forEach(el => {
    el.addEventListener('click', () => setActive(el.dataset.section));
  });

  // Default view
  setActive('resumen');

  // Logout functionality
  const logoutLinks = document.querySelectorAll('.menu .item[href="login.html"]');
  logoutLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear(); // Limpiar todo el localStorage
      console.log('🚪 Sesión cerrada');
      window.location.href = 'login.html';
    });
  });

  document.getElementById('btnPeriodo')?.addEventListener('click', () => {
    alert('Aquí podrás definir el período y semanas.');
  });
  
  // Generar PDF del reporte
  document.getElementById('btnReport')?.addEventListener('click', async () => {
    await generarPDFReporte();
  });
});

// Variable global para almacenar los cambios pendientes
let pendingPermissions = {};

async function loadAjustes() {
  try {
    console.log('📋 Cargando ajustes...');
    
    // Cargar vendedores con permisos
    const response = await fetch('/api/vendors-permissions');
    if (!response.ok) {
      throw new Error('Error al cargar vendedores');
    }
    
    const vendors = await response.json();
    console.log('✅ Vendedores cargados:', vendors);
    
    const tbody = document.getElementById('usuariosBody');
    tbody.innerHTML = '';
    
    vendors.forEach(vendor => {
      const tr = document.createElement('tr');
      tr.dataset.userId = vendor.userId;
      
      const permissionOptions = [
        { value: 'datos_personales', label: 'Datos personales' },
        { value: 'todos_vendedores', label: 'Todos los vendedores' }
      ];
      
      tr.innerHTML = `
        <td>${vendor.username}</td>
        <td>${vendor.role}</td>
        <td>
          <select class="select permission-select" data-user-id="${vendor.userId}">
            ${permissionOptions.map(opt => `
              <option value="${opt.value}" ${vendor.permission === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        </td>
      `;
      
      tbody.appendChild(tr);
    });
    
    // Limpiar cambios pendientes
    pendingPermissions = {};
    
    // Event listener para los selects
    document.querySelectorAll('.permission-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const userId = parseInt(e.target.dataset.userId);
        const newPermission = e.target.value;
        pendingPermissions[userId] = newPermission;
        console.log('Cambio pendiente:', { userId, newPermission });
      });
    });
    
    // Buscar usuarios
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
          const username = row.children[0].textContent.toLowerCase();
          row.style.display = username.includes(query) ? '' : 'none';
        });
      });
    }
    
    // Guardar cambios
    const saveBtn = document.getElementById('saveAll');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const changes = Object.keys(pendingPermissions);
        if (changes.length === 0) {
          alert('No hay cambios pendientes');
          return;
        }
        
        console.log('💾 Guardando cambios:', pendingPermissions);
        
        try {
          let savedCount = 0;
          for (const userId of changes) {
            const permission = pendingPermissions[userId];
            const response = await fetch('/api/update-permission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: parseInt(userId), permission })
            });
            
            if (response.ok) {
              savedCount++;
            } else {
              console.error('Error al guardar permiso para userId:', userId);
            }
          }
          
          alert(`✅ ${savedCount} cambio(s) guardado(s) exitosamente`);
          pendingPermissions = {};
          
          // Recargar la tabla
          loadAjustes();
        } catch (err) {
          console.error('Error al guardar:', err);
          alert('Error al guardar los cambios');
        }
      };
    }
    
    // Cargar meses visibles
    loadMonthsGrid();
    
  } catch (err) {
    console.error('❌ Error al cargar ajustes:', err);
    alert('Error al cargar los ajustes');
  }
}

async function loadMonthsGrid() {
  try {
    console.log('📅 Cargando estado de meses...');
    
    const year = new Date().getFullYear();
    const response = await fetch(`/api/months-status?year=${year}`);
    
    if (!response.ok) {
      throw new Error('Error al cargar meses');
    }
    
    const months = await response.json();
    console.log('✅ Meses cargados:', months);
    
    const monthsGrid = document.getElementById('monthsGrid');
    if (!monthsGrid) return;
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    monthsGrid.innerHTML = '';
    
    // Objeto para rastrear cambios pendientes
    const pendingChanges = {};
    
    months.forEach((monthData, index) => {
      const isVisible = monthData.isVisible;
      const yearMonth = monthData.yearMonth;
      const monthName = monthNames[index];
      
      const monthBtn = document.createElement('button');
      monthBtn.className = `month ${isVisible ? 'active' : ''}`;
      monthBtn.dataset.yearMonth = yearMonth;
      monthBtn.innerHTML = `${monthName} ${year} <span>${isVisible ? 'Visible' : 'Oculto'}</span>`;
      
      monthBtn.onclick = () => {
        const currentlyVisible = monthBtn.classList.contains('active');
        const newVisibility = !currentlyVisible;
        
        // Actualizar UI
        monthBtn.classList.toggle('active');
        monthBtn.querySelector('span').textContent = newVisibility ? 'Visible' : 'Oculto';
        
        // Guardar en pendientes
        pendingChanges[yearMonth] = newVisibility;
        console.log('Cambio pendiente:', yearMonth, newVisibility);
      };
      
      monthsGrid.appendChild(monthBtn);
    });
    
    // Botón guardar
    const btnSave = document.getElementById('btnSavePeriods');
    if (btnSave) {
      btnSave.onclick = async () => {
        const changes = Object.keys(pendingChanges);
        if (changes.length === 0) {
          alert('No hay cambios pendientes');
          return;
        }
        
        console.log('💾 Guardando cambios de meses:', pendingChanges);
        
        try {
          let savedCount = 0;
          for (const yearMonth of changes) {
            const isVisible = pendingChanges[yearMonth];
            const response = await fetch('/api/update-month-visibility', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ yearMonth, isVisible })
            });
            
            if (response.ok) {
              savedCount++;
            } else {
              console.error('Error al guardar mes:', yearMonth);
            }
          }
          
          alert(`✅ ${savedCount} cambio(s) guardado(s) exitosamente`);
          
          // Limpiar cambios pendientes
          Object.keys(pendingChanges).forEach(key => delete pendingChanges[key]);
          
        } catch (err) {
          console.error('Error al guardar:', err);
          alert('Error al guardar los cambios');
        }
      };
    }
    
  } catch (err) {
    console.error('❌ Error al cargar meses:', err);
    alert('Error al cargar los meses');
  }
}

async function loadVendedores(){
  try{
    const uRes = await fetch('/api/users');
    const users = await uRes.json();

    const cont = document.getElementById('section-vendedores');
    cont.innerHTML = `
      <section class="card users">
        <div class="card-title">Visibilidad por usuario</div>
        <div class="users-controls">
          <input id="userSearch" class="input" type="text" placeholder="Buscar usuario..." />
          <div class="spacer"></div>
          <button id="saveAll" class="btn primary">Guardar cambios</button>
        </div>
        <div id="usersList" class="user-list"></div>
      </section>`;

    const usersList = document.getElementById('usersList');
    let model = users.map(u => ({ ...u, pending: null }));

    function render(list){
      usersList.innerHTML = '';
      list.forEach(u => {
        const initials = (u.username || '?').substring(0,2).toUpperCase();
        const mode = (u.visibility === 'todo' || u.visibility === 'todos') ? 'todos' : 'personal';
        const el = document.createElement('div');
        el.className = 'user-item';
        el.innerHTML = `
          <div class="user-left">
            <div class="avatar">${initials}</div>
            <div class="name">${u.username}</div>
          </div>
          <div class="user-right">
            <div class="seg" role="tablist" aria-label="Visibilidad">
              <button class="opt-personal ${mode==='personal'?'active':''}" role="tab">Datos personales</button>
              <button class="opt-todos ${mode==='todos'?'active':''}" role="tab">Todos los vendedores</button>
            </div>
            <span class="status" aria-live="polite"></span>
          </div>`;
        const btnPersonal = el.querySelector('.opt-personal');
        const btnTodos = el.querySelector('.opt-todos');
        const status = el.querySelector('.status');
        function setMode(m){
          btnPersonal.classList.toggle('active', m==='personal');
          btnTodos.classList.toggle('active', m==='todos');
          u.pending = m;
          status.textContent = 'Pendiente…';
        }
        btnPersonal.addEventListener('click', ()=> setMode('personal'));
        btnTodos.addEventListener('click', ()=> setMode('todos'));
        usersList.appendChild(el);
      });
    }

    render(model);

    // Search
    const search = document.getElementById('userSearch');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const filtered = model.filter(u => u.username.toLowerCase().includes(q));
      render(filtered);
    });

    // Save all (sequential mock POSTs)
    document.getElementById('saveAll').addEventListener('click', async () => {
      const items = usersList.querySelectorAll('.user-item');
      for (let i = 0; i < model.length; i++){
        const u = model[i];
        if (!u.pending) continue;
        const st = items[i].querySelector('.status');
        try{
          await fetch(`/api/users/${u.id}/visibility`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mode: u.pending }) });
          st.textContent = 'Guardado';
          u.visibility = u.pending;
          u.pending = null;
        }catch{
          st.textContent = 'Error';
        }
      }
    });
  }catch(e){ console.error(e); }
}

// ---------- Periodos ----------
function ymToLabel(ym){
  const [y,m] = ym.split('-').map(Number);
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${nombres[m-1]} ${y}`;
}

function listMonthsForYear(year){
  return Array.from({length:12}, (_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);
}

function generateWeeks(ym){
  const [y,m]=ym.split('-').map(Number);
  const start = new Date(Date.UTC(y,m-1,1));
  const end = new Date(Date.UTC(y,m,0)); // last day of month
  // Split into 4-5 chunks by day count
  const days = end.getUTCDate();
  const size = Math.ceil(days/4.5); // approx 5 weeks max
  const weeks=[];
  let cur=1;
  for(let i=1;i<=5;i++){
    const from = cur;
    const to = Math.min(cur + size - 1, days);
    weeks.push({ name: `S${i}`, from: `${ym}-${String(from).padStart(2,'0')}`, to: `${ym}-${String(to).padStart(2,'0')}` });
    cur = to + 1;
    if (cur>days) break;
  }
  return weeks;
}

async function loadPeriodos(){
  const res = await fetch('/api/periods');
  let state;
  try{
    const ct = res.headers.get('content-type')||'';
    state = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());
  }catch(e){
    console.error('No se pudo leer /api/periods como JSON:', e);
    alert('Error cargando periodos. Revisa el servidor.');
    return;
  }

  const monthsGrid = document.getElementById('monthsGrid');

  const year = new Date().getUTCFullYear();

  function renderMonths(){
    const months = listMonthsForYear(Number(year));
    monthsGrid.innerHTML = months.map(ym => {
      const active = state.allowed.includes(ym);
      return `<button class="month ${active?'active':''}" data-ym="${ym}">${ymToLabel(ym)} <span>${active?'Visible':'Oculto'}</span></button>`;
    }).join('');
    monthsGrid.querySelectorAll('.month').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const ym = btn.getAttribute('data-ym');
        const idx = state.allowed.indexOf(ym);
        if (idx>=0) state.allowed.splice(idx,1); else state.allowed.push(ym);
        // Ensure at least current month remains selected
        if (!state.allowed.length){
          const currentYM = `${year}-${String(new Date().getUTCMonth()+1).padStart(2,'0')}`;
          state.allowed = [currentYM];
        }
        // Keep default within allowed; if not, reset to current or first allowed
        if (!state.allowed.includes(state.default)){
          const currentYM = `${year}-${String(new Date().getUTCMonth()+1).padStart(2,'0')}`;
          state.default = state.allowed.includes(currentYM) ? currentYM : state.allowed[0];
        }
        renderMonths();
      });
    });
  }

  document.getElementById('btnSavePeriods').addEventListener('click', async ()=>{
    try{
      localStorage.setItem('periodsStateUI', JSON.stringify({ allowed: state.allowed }));
      alert('Meses visibles guardados');
    }catch{
      alert('No se pudo guardar localmente');
    }
  });

  // initial
  // Ensure current month is allowed by default
  const currentYM = `${year}-${String(new Date().getUTCMonth()+1).padStart(2,'0')}`;
  if (!state.allowed || !state.allowed.length) state.allowed = [currentYM];
  if (!state.allowed.includes(currentYM)) state.allowed.push(currentYM);
  if (!state.default) state.default = currentYM;

  renderMonths();
}

// ========== GENERAR PDF DEL REPORTE ==========
async function generarPDFReporte() {
  if (!dashboardData) {
    alert('No hay datos disponibles para generar el reporte');
    return;
  }

  try {
    console.log('📄 Generando PDF del reporte...');
    
    // Acceder a jsPDF del objeto global window
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    
    // ===== ENCABEZADO =====
    // Logo/Título
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235); // Color azul
    doc.setFont('helvetica', 'bold');
    doc.text('VentasAdmin', 20, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Ventas', 20, yPos + 6);
    
    // Fecha de generación
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const fechaGeneracion = new Date().toLocaleString('es-PE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${fechaGeneracion}`, pageWidth - 20, yPos, { align: 'right' });
    
    // Línea separadora
    yPos += 12;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;
    
    // ===== PERÍODO =====
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(`${dashboardData.period.month} ${dashboardData.period.year}`, 20, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Semana actual: ${dashboardData.period.week}`, 20, yPos + 6);
    yPos += 15;
    
    // ===== MÉTRICAS PRINCIPALES =====
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Ejecutivo', 20, yPos);
    yPos += 8;
    
    // Cajas de métricas
    const boxWidth = (pageWidth - 50) / 2;
    const boxHeight = 25;
    
    // Caja 1: Total Mensual
    doc.setFillColor(37, 99, 235); // Azul
    doc.roundedRect(20, yPos, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Mensual', 25, yPos + 8);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`USD ${dashboardData.totals.monthly.toLocaleString('es-PE')}`, 25, yPos + 18);
    
    // Caja 2: Promedio por Vendedor
    doc.setFillColor(5, 150, 105); // Verde
    doc.roundedRect(30 + boxWidth, yPos, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Promedio por Vendedor', 35 + boxWidth, yPos + 8);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`USD ${dashboardData.totals.perSellerAvg.toLocaleString('es-PE')}`, 35 + boxWidth, yPos + 18);
    
    yPos += boxHeight + 15;
    
    // ===== TABLA DE DESEMPEÑO POR VENDEDOR =====
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Desempeño por Vendedor', 20, yPos);
    yPos += 5;
    
    // Preparar datos de la tabla
    const tableData = dashboardData.performance.map((p, index) => {
      const row = [
        index === 0 ? '👑 ' + p.name : p.name,
        `$${p.s1.toLocaleString('es-PE')}`,
        `$${p.s2.toLocaleString('es-PE')}`,
        `$${p.s3.toLocaleString('es-PE')}`,
        `$${p.s4.toLocaleString('es-PE')}`,
        `$${p.s5.toLocaleString('es-PE')}`,
        `$${p.total.toLocaleString('es-PE')}`
      ];
      return row;
    });
    
    // Calcular totales
    const totals = dashboardData.performance.reduce((acc, p) => ({
      s1: acc.s1 + p.s1,
      s2: acc.s2 + p.s2,
      s3: acc.s3 + p.s3,
      s4: acc.s4 + p.s4,
      s5: acc.s5 + p.s5,
      total: acc.total + p.total
    }), { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, total: 0 });
    
    tableData.push([
      'TOTAL INGRESOS',
      `$${totals.s1.toLocaleString('es-PE')}`,
      `$${totals.s2.toLocaleString('es-PE')}`,
      `$${totals.s3.toLocaleString('es-PE')}`,
      `$${totals.s4.toLocaleString('es-PE')}`,
      `$${totals.s5.toLocaleString('es-PE')}`,
      `$${totals.total.toLocaleString('es-PE')}`
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['Vendedor', 'S1', 'S2', 'S3', 'S4', 'S5', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { 
        fontSize: 9,
        textColor: [30, 30, 30]
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        // Resaltar la última fila (totales)
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [37, 99, 235];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 20, right: 20 }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
    
    // ===== GRÁFICA =====
    // Capturar la gráfica como imagen
    const chartCanvas = document.getElementById('chartSemanal');
    if (chartCanvas && yPos < pageHeight - 80) {
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text('Evolución Semanal (Total)', 20, yPos);
      yPos += 5;
      
      try {
        // Obtener el contexto del canvas para capturar la gráfica
        const chartContainer = chartCanvas.parentElement;
        
        const canvas = await html2canvas(chartContainer, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Si no cabe en la página actual, agregar nueva página
        if (yPos + imgHeight > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
          doc.setFontSize(12);
          doc.setTextColor(30, 30, 30);
          doc.setFont('helvetica', 'bold');
          doc.text('Evolución Semanal (Total)', 20, yPos);
          yPos += 5;
        }
        
        doc.addImage(imgData, 'PNG', 20, yPos, imgWidth, imgHeight);
        console.log('✅ Gráfica capturada exitosamente');
      } catch (err) {
        console.error('❌ Error al capturar gráfica:', err);
        // Continuar sin la gráfica
      }
    }
    
    // ===== PIE DE PÁGINA =====
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.text(
        'VentasAdmin - Módulo de Análisis de Ventas',
        pageWidth - 20,
        pageHeight - 10,
        { align: 'right' }
      );
    }
    
    // Guardar PDF
    const filename = `Reporte_Ventas_${dashboardData.period.month}_${dashboardData.period.year}.pdf`;
    doc.save(filename);
    
    console.log('✅ PDF generado exitosamente:', filename);
    
  } catch (err) {
    console.error('❌ Error al generar PDF:', err);
    alert('Error al generar el reporte PDF: ' + err.message);
  }
}

// ========== TEMA OSCURO/CLARO ==========
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  const htmlElement = document.documentElement;
  const icon = themeToggle?.querySelector('i');
  
  // Cargar tema guardado o usar 'light' por defecto
  const savedTheme = localStorage.getItem('theme') || 'light';
  htmlElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  
  // Event listener para cambiar tema
  themeToggle?.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    console.log('🎨 Tema cambiado a:', newTheme);
  });
  
  function updateThemeIcon(theme) {
    if (!icon) return;
    
    if (theme === 'dark') {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  }
});
