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
    const r = await fetch('/api/dashboard');
    const d = await r.json();

    const periodo = document.getElementById('periodo');
    periodo.textContent = `Resumen general de ventas • ${d.period.month.toUpperCase()} ${d.period.year} • Semana ${d.period.week}`;

    document.getElementById('kpiTotal').textContent = money(d.totals.monthly);
    document.getElementById('kpiSemana').textContent = d.period.week;
    document.getElementById('kpiPromedio').textContent = money(d.totals.perSellerAvg);

    const tbody = document.getElementById('tablaVendedores');
    tbody.innerHTML = '';
    d.performance.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.seller}</td>
        <td class="num">${p.s1.toLocaleString('es-PE')}</td>
        <td class="num">${p.s2.toLocaleString('es-PE')}</td>
        <td class="num">${p.s3.toLocaleString('es-PE')}</td>
        <td class="num">${p.s4.toLocaleString('es-PE')}</td>
        <td class="num">${p.total.toLocaleString('es-PE')}</td>
      `;
      tbody.appendChild(tr);
    });

    // Chart: evolución semanal (sumatoria de todos los vendedores)
    const weeks = ['S1','S2','S3','S4'];
    const totalsByWeek = [
      d.performance.reduce((s,p)=>s+p.s1,0),
      d.performance.reduce((s,p)=>s+p.s2,0),
      d.performance.reduce((s,p)=>s+p.s3,0),
      d.performance.reduce((s,p)=>s+p.s4,0),
    ];
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
            labels: weeks,
            datasets: [{
              label: 'Total',
              data: totalsByWeek,
              backgroundColor: colors.map(c => c + '99'),
              borderColor: colors,
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
        drawBarFallback(canvas, weeks, totalsByWeek);
      }
    } else {
      drawBarFallback(canvas, weeks, totalsByWeek);
    }
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Navigation between sections
  const menuItems = document.querySelectorAll('.menu .item[data-section]');
  const sections = {
    resumen: document.getElementById('section-resumen'),
    vendedores: document.getElementById('section-vendedores'),
    periodos: document.getElementById('section-periodos'),
  };

  function setActive(section) {
    menuItems.forEach(el => el.classList.toggle('active', el.dataset.section === section));
    Object.keys(sections).forEach(k => sections[k]?.classList.toggle('hidden', k !== section));
    if (section === 'resumen') loadDashboard();
    if (section === 'vendedores') loadVendedores();
    if (section === 'periodos') loadPeriodos();
  }

  menuItems.forEach(el => {
    el.addEventListener('click', () => setActive(el.dataset.section));
  });

  // Default view
  setActive('resumen');

  document.getElementById('btnPeriodo')?.addEventListener('click', () => {
    alert('Aquí podrás definir el período y semanas.');
  });
  document.getElementById('btnReporte')?.addEventListener('click', () => {
    alert('Se generará el reporte consolidado.');
  });
});

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
