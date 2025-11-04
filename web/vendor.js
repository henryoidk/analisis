// vendor.js - Dashboard del vendedor
console.log('🚀 Vendor dashboard iniciado');

// Variable global para almacenar los datos del vendedor
let vendorDashboardData = null;

// Obtener información del usuario del localStorage
const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
console.log('👤 Usuario cargado:', userInfo);

if (!userInfo.userId || !userInfo.username) {
  console.warn('⚠️ No hay sesión activa');
  window.location.href = 'login.html';
}

// Verificar permisos del usuario
async function checkPermissionsAndRedirect() {
  try {
    const response = await fetch(`/api/vendor-dashboard?userId=${userInfo.userId}`);
    const data = await response.json();
    
    if (response.ok && data.permission === 'todos_vendedores') {
      console.log('🔄 Usuario tiene permiso elevado, redirigiendo a vista de administrador...');
      window.location.href = 'admin.html';
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error al verificar permisos:', err);
    return false;
  }
}

// Cargar datos del dashboard
async function loadVendorDashboard() {
  try {
    // Verificar permisos primero
    const shouldRedirect = await checkPermissionsAndRedirect();
    if (shouldRedirect) return;
    
    console.log('📊 Cargando dashboard del vendedor...');
    
    // Obtener mes seleccionado
    const monthSelector = document.getElementById('monthSelector');
    const selectedMonth = monthSelector?.value;
    
    // Si no hay mes seleccionado o es el placeholder, usar mes actual
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthParam = (selectedMonth && !selectedMonth.includes('Cargando')) ? selectedMonth : currentMonth;
    
    const response = await fetch(`/api/vendor-dashboard?userId=${userInfo.userId}&month=${monthParam}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al cargar datos');
    }

    console.log('✅ Datos recibidos:', data);
    
    // Guardar datos en variable global para generar PDF
    vendorDashboardData = data;

    // Actualizar período en el header
    const periodoEl = document.querySelector('.periodo');
    if (periodoEl) {
      periodoEl.textContent = `Resumen personal`;
    }

    // Actualizar tarjetas KPI
    updateKPICards(data);

    // Actualizar tabla de resumen
    updateWeeklySummary(data);

    // Actualizar gráfica
    updateChart(data);

  } catch (err) {
    console.error('❌ Error al cargar dashboard:', err);
    alert('Error al cargar los datos del dashboard: ' + err.message);
  }
}

function updateKPICards(data) {
  // Semana actual
  const semanaActualValue = document.querySelector('.metrics-row .card:nth-child(1) .kpi-value');
  if (semanaActualValue) {
    semanaActualValue.textContent = data.period.week;
  }

  // Total personal
  const totalPersonalValue = document.querySelector('.metrics-row .card:nth-child(2) .kpi-value');
  if (totalPersonalValue) {
    totalPersonalValue.textContent = `Q${data.totals.personal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function updateWeeklySummary(data) {
  const statsContainer = document.querySelector('.v-table .stats');
  if (!statsContainer) return;

  // Limpiar contenido actual
  statsContainer.innerHTML = '';

  let total = 0;

  // Agregar cada semana
  data.weeks.forEach(week => {
    total += week.amount;
    
    const row = document.createElement('div');
    row.className = 'stats-row';
    row.innerHTML = `
      <span class="label">S${week.week}</span>
      <span class="value">Q${week.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    `;
    statsContainer.appendChild(row);
  });

  // Agregar divisor
  const divider = document.createElement('div');
  divider.className = 'divider';
  statsContainer.appendChild(divider);

  // Agregar total
  const totalRow = document.createElement('div');
  totalRow.className = 'stats-row total';
  totalRow.innerHTML = `
    <span class="label">TOTAL</span>
    <span class="value">Q${total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  `;
  statsContainer.appendChild(totalRow);
}

function updateChart(data) {
  const chartBars = document.querySelector('.chart-bars');
  if (!chartBars) return;

  // Limpiar barras actuales
  chartBars.innerHTML = '';

  // Encontrar el máximo para calcular alturas
  const maxAmount = Math.max(...data.weeks.map(w => w.amount), 1);

  // Crear barras para cada semana
  data.weeks.forEach(week => {
    const height = (week.amount / maxAmount) * 100;
    
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${height}%`;
    bar.innerHTML = `
      <div class="bar-label">S${week.week}</div>
      <div class="bar-value">${week.amount.toLocaleString('es-PE')}</div>
    `;
    chartBars.appendChild(bar);
  });
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
      loadVendorDashboard();
    });
    
  } catch (err) {
    console.error('❌ Error al cargar meses visibles:', err);
  }
}

// Manejar logout
const logoutBtn = document.querySelector('.menu .item[href="login.html"]');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });
}

// Cargar dashboard al iniciar
(async () => {
  await loadVisibleMonthsSelector();
  loadVendorDashboard();
})();

// ========== TEMA OSCURO/CLARO ==========
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

// ========== GENERAR PDF DEL REPORTE ==========
const btnReport = document.getElementById('btnReport');
btnReport?.addEventListener('click', async () => {
  await generarPDFReporteVendedor();
});

async function generarPDFReporteVendedor() {
  if (!vendorDashboardData) {
    alert('No hay datos disponibles para generar el reporte');
    return;
  }

  try {
    console.log('📄 Generando PDF del reporte de vendedor...');
    
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
    doc.text('Reporte Personal de Ventas', 20, yPos + 6);
    
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
    
    // ===== VENDEDOR =====
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(`Vendedor: ${userInfo.username}`, 20, yPos);
    yPos += 8;
    
    // ===== PERÍODO =====
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`${vendorDashboardData.period.month} ${vendorDashboardData.period.year} • Semana actual: ${vendorDashboardData.period.week}`, 20, yPos);
    yPos += 15;
    
    // ===== MÉTRICAS PRINCIPALES =====
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Personal', 20, yPos);
    yPos += 8;
    
    // Caja: Total Personal
    const boxWidth = pageWidth - 40;
    const boxHeight = 25;
    
    doc.setFillColor(37, 99, 235); // Azul
    doc.roundedRect(20, yPos, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Personal del Mes', 25, yPos + 8);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Q${vendorDashboardData.totals.personal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 25, yPos + 18);
    
    yPos += boxHeight + 15;
    
    // ===== TABLA DE DESEMPEÑO SEMANAL =====
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('Desempeño Semanal', 20, yPos);
    yPos += 5;
    
    // Preparar datos de la tabla
    const tableData = vendorDashboardData.weeks.map(w => {
      return [
        `Semana ${w.week}`,
        `Q${w.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ];
    });
    
    // Agregar fila de total
    tableData.push([
      'TOTAL',
      `Q${vendorDashboardData.totals.personal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['Período', 'Ventas']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 11
      },
      bodyStyles: { 
        fontSize: 10,
        textColor: [30, 30, 30]
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        // Resaltar la última fila (total)
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [37, 99, 235];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 12;
        }
      },
      margin: { left: 20, right: 20 }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
    
    // ===== GRÁFICA =====
    // Capturar la gráfica como imagen
    const chartBars = document.querySelector('.chart-bars');
    if (chartBars && yPos < pageHeight - 80) {
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text('Evolución Semanal', 20, yPos);
      yPos += 5;
      
      try {
        const canvas = await html2canvas(chartBars, {
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
          doc.text('Evolución Semanal', 20, yPos);
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
        'VentasAdmin - Reporte Personal',
        pageWidth - 20,
        pageHeight - 10,
        { align: 'right' }
      );
    }
    
    // Guardar PDF
    const filename = `Reporte_Personal_${userInfo.username}_${vendorDashboardData.period.month}_${vendorDashboardData.period.year}.pdf`;
    doc.save(filename);
    
    console.log('✅ PDF generado exitosamente:', filename);
    
  } catch (err) {
    console.error('❌ Error al generar PDF:', err);
    alert('Error al generar el reporte PDF: ' + err.message);
  }
}
