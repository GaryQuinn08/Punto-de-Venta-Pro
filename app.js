/* ============================================================
   Refaccionaria San Lorenzo — POS | app.js
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────
let productos = [];
let cart      = {};
let sales     = [];
let activeCategory = 'Todos';

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderCategories();
  filterProducts();
  updateClock();
  setInterval(updateClock, 1000);
});

// ── Data Loading ──────────────────────────────────────────────
async function loadData() {
  try {
    const raw = localStorage.getItem('slz_sales');
    if (raw) sales = JSON.parse(raw);
  } catch (e) { sales = []; }

  try {
    const inv = localStorage.getItem('slz_inventory');
    if (inv) { productos = JSON.parse(inv); return; }
  } catch (e) { /* fall through */ }

  try {
    const res = await fetch('productos.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    productos = await res.json();
  } catch (e) {
    console.error('No se pudo cargar productos.json:', e);
    productos = [];
    showToast('Error al cargar productos.json');
  }
}

function saveInventory() {
  try { localStorage.setItem('slz_inventory', JSON.stringify(productos)); } catch (e) {}
}
function saveSales() {
  try { localStorage.setItem('slz_sales', JSON.stringify(sales)); } catch (e) {}
}

// ── Page Navigation ───────────────────────────────────────────
function showPage(pageKey) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById('page-' + pageKey);
  const tabEl  = document.getElementById('tab-'  + pageKey);
  if (pageEl) pageEl.classList.add('active');
  if (tabEl)  tabEl.classList.add('active');
  if (pageKey === 'hist') renderHistory();
  if (pageKey === 'inv')  { renderInventory(); loadSheetJS(); }
}

// ── Clock ─────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  el.textContent =
    now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' ' +
    now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Categories ────────────────────────────────────────────────
function getCategories() {
  const cats = [...new Set(productos.map(p => p.cat))].sort((a, b) => a.localeCompare(b));
  return ['Todos', ...cats];
}

function renderCategories() {
  const el = document.getElementById('cats');
  if (!el) return;
  el.innerHTML = getCategories().map(c =>
    `<button class="cat-btn${c === activeCategory ? ' active' : ''}" onclick="setCategory('${c}')">${c}</button>`
  ).join('');
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategories();
  filterProducts();
}

// ── Products ──────────────────────────────────────────────────
function filterProducts() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let list = productos;
  if (activeCategory !== 'Todos') list = list.filter(p => p.cat === activeCategory);
  if (q) list = list.filter(p =>
    p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q)
  );
  renderProducts(list);
}

function renderProducts(list) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="no-results">🔍 Sin resultados para esa búsqueda</div>';
    return;
  }
  grid.innerHTML = list.map(p => {
    const inCart  = cart[p.id] ? ' in-cart' : '';
    const stClass = p.stock <= 0 ? 'out' : p.stock <= 3 ? 'low' : 'ok';
    const stLabel = p.stock <= 0 ? 'Sin stock' : p.stock + ' pza';
    return `<div class="product-card${inCart}" onclick="addToCart(${p.id})">
      <div class="prod-name">${p.name}</div>
      <div class="prod-footer">
        <span class="prod-price">$${p.price.toFixed(2)}</span>
        <span class="prod-stock ${stClass}">${stLabel}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Cart ──────────────────────────────────────────────────────
function addToCart(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  if (p.stock <= 0) { showToast('Sin stock disponible'); return; }
  if (cart[id]) {
    if (cart[id].qty >= p.stock) { showToast('Stock máximo alcanzado'); return; }
    cart[id].qty++;
  } else {
    cart[id] = { id: p.id, name: p.name, price: p.price, cat: p.cat, stock: p.stock, qty: 1 };
  }
  updateCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  if (delta > 0) {
    const p = productos.find(x => x.id === id);
    if (p && cart[id].qty >= p.stock) { showToast('Stock máximo'); return; }
  }
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  updateCart();
}

function clearCart() {
  cart = {};
  const inp = document.getElementById('payInput');
  if (inp) inp.value = '';
  updateCart();
}

function updateCart() {
  const items = Object.values(cart);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  const badgeEl = document.getElementById('cartCount');
  const countEl = document.getElementById('itemsCount');
  const totalEl = document.getElementById('totalAmount');
  const itemsEl = document.getElementById('cartItems');

  if (badgeEl) badgeEl.textContent = items.length;
  if (countEl) countEl.textContent = count + ' pza';
  if (totalEl) totalEl.textContent = '$' + total.toFixed(2);

  if (itemsEl) {
    if (!items.length) {
      itemsEl.innerHTML =
        `<div class="cart-empty">
          <span class="cart-empty-icon">🛒</span>
          <span>Selecciona productos del catálogo</span>
        </div>`;
    } else {
      itemsEl.innerHTML = items.map(i =>
        `<div class="cart-item">
          <div class="ci-info">
            <div class="ci-name">${i.name}</div>
            <div class="ci-unit">$${i.price.toFixed(2)} c/u</div>
          </div>
          <div class="ci-controls">
            <button class="qty-btn minus" onclick="changeQty(${i.id}, -1)">−</button>
            <span class="qty-num">${i.qty}</span>
            <button class="qty-btn plus"  onclick="changeQty(${i.id},  1)">+</button>
          </div>
          <div class="ci-total">$${(i.price * i.qty).toFixed(2)}</div>
        </div>`
      ).join('');
    }
  }
  calcChange();
  filterProducts();
}

// ── Change Calculator ─────────────────────────────────────────
function calcChange() {
  const items  = Object.values(cart);
  const total  = items.reduce((s, i) => s + i.price * i.qty, 0);
  const pay    = parseFloat(document.getElementById('payInput')?.value) || 0;
  const change = pay - total;
  const changeEl  = document.getElementById('changeAmount');
  const cobrarBtn = document.getElementById('btnCobrar');
  if (!changeEl || !cobrarBtn) return;
  if (!items.length || pay <= 0) {
    changeEl.textContent = '—'; changeEl.className = 'change-amount'; cobrarBtn.disabled = true; return;
  }
  if (change < 0) {
    changeEl.textContent = '-$' + Math.abs(change).toFixed(2);
    changeEl.className   = 'change-amount low';
    cobrarBtn.disabled   = true;
  } else {
    changeEl.textContent = '$' + change.toFixed(2);
    changeEl.className   = 'change-amount ok';
    cobrarBtn.disabled   = false;
  }
}

// ── Cobrar ────────────────────────────────────────────────────
function cobrar() {
  const items = Object.values(cart);
  if (!items.length) return;
  const total  = items.reduce((s, i) => s + i.price * i.qty, 0);
  const pay    = parseFloat(document.getElementById('payInput')?.value) || 0;
  const change = pay - total;
  const now    = new Date();
  const sale = {
    id:    'V' + String(sales.length + 1).padStart(4, '0'),
    date:  now.toLocaleDateString('es-MX'),
    time:  now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    total, pay, change
  };
  sales.unshift(sale);
  saveSales();
  items.forEach(i => {
    const p = productos.find(x => x.id === i.id);
    if (p) p.stock = Math.max(0, p.stock - i.qty);
  });
  saveInventory();
  showTicketModal(sale);
}

// ── Ticket Modal ──────────────────────────────────────────────
function showTicketModal(sale) {
  const rows = sale.items.map(i => {
    const n = i.name.length > 32 ? i.name.substring(0, 32) + '…' : i.name;
    return `<div class="ticket-row"><span>${n} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`;
  }).join('');
  const modalEl = document.getElementById('ticketModal');
  if (!modalEl) return;
  modalEl.innerHTML = `
    <div class="ticket-shop">🏍️ REFACCIONARIA SAN LORENZO</div>
    <div class="ticket-sub">Refaccionaria para motos</div>
    <div class="ticket-sub">${sale.date} — ${sale.time} &nbsp;|&nbsp; ${sale.id}</div>
    <hr class="ticket-divider">
    ${rows}
    <hr class="ticket-divider">
    <div class="ticket-total-row"><span>TOTAL</span><span>$${sale.total.toFixed(2)}</span></div>
    <div class="ticket-row"><span>Efectivo</span><span>$${sale.pay.toFixed(2)}</span></div>
    <div class="ticket-change">Cambio: $${sale.change.toFixed(2)}</div>
    <div class="ticket-thanks">¡Gracias por su compra! 🏍️</div>
    <div class="print-warn">⚠️ Verifica que la impresora tenga papel antes de imprimir.</div>
    <div class="modal-actions">
      <button class="btn-modal green"     onclick="printTicket()">🖨 Imprimir</button>
      <button class="btn-modal primary"   onclick="skipPrint()">✓ Sin imprimir</button>
      <button class="btn-modal secondary" onclick="closeModal()">Cerrar</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('show');
}

function printTicket()  { window.print(); startNewSale(); }
function skipPrint()    { showToast('Venta registrada sin imprimir ✓'); startNewSale(); }
function startNewSale() { closeModal(); clearCart(); }
function closeModal()   { document.getElementById('modalOverlay')?.classList.remove('show'); }
function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ── Historial ─────────────────────────────────────────────────
function renderHistory() {
  const hoy          = new Date().toLocaleDateString('es-MX');
  const totalVentas  = sales.length;
  const totalIngresos = sales.reduce((s, v) => s + v.total, 0);
  const ventasHoy    = sales.filter(v => v.date === hoy).length;
  const ingresosHoy  = sales.filter(v => v.date === hoy).reduce((s, v) => s + v.total, 0);
  const statsEl = document.getElementById('statCards');
  if (statsEl) {
    statsEl.innerHTML = [
      ['Ventas totales',   totalVentas],
      ['Ingresos totales', '$' + totalIngresos.toFixed(2)],
      ['Ventas hoy',       ventasHoy],
      ['Ingresos hoy',     '$' + ingresosHoy.toFixed(2)]
    ].map(([lbl, val]) =>
      `<div class="stat-card"><div class="stat-val">${val}</div><div class="stat-lbl">${lbl}</div></div>`
    ).join('');
  }
  const listEl = document.getElementById('histList');
  if (!listEl) return;
  if (!sales.length) {
    listEl.innerHTML = '<div class="empty-state">📋 Aún no hay ventas registradas</div>';
    return;
  }
  listEl.innerHTML = sales.map((s, idx) =>
    `<div class="sale-row" onclick="toggleSaleDetail(${idx})">
      <div class="sale-row-top">
        <span class="sale-id">${s.id}</span>
        <span class="sale-total">$${s.total.toFixed(2)}</span>
      </div>
      <div class="sale-date">${s.date} ${s.time}</div>
      <div class="sale-items-summary">${s.items.length} producto(s) &nbsp;•&nbsp; Pagó $${s.pay.toFixed(2)} &nbsp;•&nbsp; Cambio $${s.change.toFixed(2)}</div>
      <div class="sale-detail" id="detail-${idx}">
        ${s.items.map(i =>
          `<div class="detail-row"><span>${i.name} x${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`
        ).join('')}
        <div class="detail-row" style="margin-top:6px;font-weight:700">
          <span>TOTAL</span><span>$${s.total.toFixed(2)}</span>
        </div>
      </div>
    </div>`
  ).join('');
}

function toggleSaleDetail(idx) {
  document.getElementById('detail-' + idx)?.classList.toggle('open');
}

function clearHistory() {
  if (!confirm('¿Borrar todo el historial de ventas? Esta acción no se puede deshacer.')) return;
  sales = [];
  saveSales();
  renderHistory();
  showToast('Historial borrado');
}

// ── Inventario ────────────────────────────────────────────────
function renderInventory() {
  const q = (document.getElementById('invSearch')?.value || '').toLowerCase().trim();
  const list = q
    ? productos.filter(p => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q))
    : productos;
  const countEl = document.getElementById('invCount');
  if (countEl) countEl.textContent = `${list.length} de ${productos.length} productos`;
  const tbody = document.getElementById('invBody');
  if (!tbody) return;
  tbody.innerHTML = list.map(p => {
    const stClass = p.stock <= 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : 'stock-ok';
    return `<tr id="inv-row-${p.id}">
      <td class="col-sku">${p.id}</td>
      <td class="col-name">${p.name}</td>
      <td><span class="cat-badge">${p.cat}</span></td>
      <td>
        <span class="price-disp" id="price-disp-${p.id}">$${p.price.toFixed(2)}</span>
        <input type="number" class="price-input" id="price-inp-${p.id}" value="${p.price}" min="0" step="0.50" style="display:none">
      </td>
      <td>
        <span class="stock-disp ${stClass}" id="stock-disp-${p.id}">${p.stock}</span>
        <input type="number" class="stock-input" id="stock-inp-${p.id}" value="${p.stock}" min="0" style="display:none">
      </td>
      <td>
        <button class="btn-edit" id="btn-inv-${p.id}" onclick="toggleEditRow(${p.id})">✏️ Editar</button>
      </td>
    </tr>`;
  }).join('');
}

function toggleEditRow(id) {
  const btn       = document.getElementById('btn-inv-' + id);
  const row       = document.getElementById('inv-row-' + id);
  const priceDisp = document.getElementById('price-disp-' + id);
  const priceInp  = document.getElementById('price-inp-'  + id);
  const stockDisp = document.getElementById('stock-disp-' + id);
  const stockInp  = document.getElementById('stock-inp-'  + id);
  if (!btn || !row) return;
  if (btn.classList.contains('save')) {
    const newPrice = Math.max(0, parseFloat(priceInp.value) || 0);
    const newStock = Math.max(0, parseInt(stockInp.value)   || 0);
    const p = productos.find(x => x.id === id);
    if (p) { p.price = newPrice; p.stock = newStock; }
    saveInventory();
    priceDisp.textContent = '$' + newPrice.toFixed(2);
    const stClass = newStock <= 0 ? 'stock-out' : newStock <= 3 ? 'stock-low' : 'stock-ok';
    stockDisp.textContent = newStock;
    stockDisp.className   = 'stock-disp ' + stClass;
    priceDisp.style.display = ''; priceInp.style.display = 'none';
    stockDisp.style.display = ''; stockInp.style.display = 'none';
    row.classList.remove('editing');
    btn.className = 'btn-edit'; btn.textContent = '✏️ Editar';
    showToast('Guardado ✓');
  } else {
    priceDisp.style.display = 'none'; priceInp.style.display  = 'inline-block';
    stockDisp.style.display = 'none'; stockInp.style.display  = 'inline-block';
    row.classList.add('editing');
    btn.className = 'btn-edit save'; btn.textContent = '💾 Guardar';
  }
}

// ══════════════════════════════════════════════════════════════
//  SHEETJS  (carga única; reutilizado por export e import)
// ══════════════════════════════════════════════════════════════
function loadSheetJS(cb) {
  if (typeof XLSX !== 'undefined') { if (cb) cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = () => { if (cb) cb(); };
  document.head.appendChild(s);
}

// ══════════════════════════════════════════════════════════════
//  EXPORTAR A EXCEL  (usa SheetJS CDN — no requiere servidor)
// ══════════════════════════════════════════════════════════════
function exportExcel() {
  if (typeof XLSX === 'undefined') { showToast('Cargando…'); loadSheetJS(_doExport); }
  else _doExport();
}

function _doExport() {
  const wb  = XLSX.utils.book_new();

  // ── Hoja de datos ────────────────────────────────────────────
  const header = [['SKU', 'Producto', 'Categoria', 'Precio', 'Stock']];
  const rows   = productos.map(p => [p.id, p.name, p.cat, p.price, p.stock]);
  const ws     = XLSX.utils.aoa_to_sheet([...header, ...rows]);

  // Column widths
  ws['!cols'] = [{ wch: 7 }, { wch: 45 }, { wch: 22 }, { wch: 12 }, { wch: 10 }];

  // Style header row (bold + orange bg)
  const headerStyle = {
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill:      { fgColor: { rgb: 'F97316' }, patternType: 'solid' },
    alignment: { horizontal: 'center' }
  };
  ['A1','B1','C1','D1','E1'].forEach(ref => {
    if (!ws[ref]) return;
    ws[ref].s = headerStyle;
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

  // ── Hoja de instrucciones ────────────────────────────────────
  const instrData = [
    ['INSTRUCCIONES DE IMPORTACIÓN'],
    [''],
    ['Para importar este archivo al POS:'],
    ['1. Modifica los valores de Precio y/o Stock en la hoja Inventario.'],
    ['2. NO cambies los encabezados ni el SKU de productos existentes.'],
    ['3. Puedes agregar filas nuevas al final (SKU debe ser único).'],
    ['4. Guarda el archivo como .xlsx'],
    ['5. En el POS → Inventario → botón Importar Excel → selecciona el archivo.'],
    [''],
    ['COLUMNAS REQUERIDAS:'],
    ['SKU        → Número único (no repetir)'],
    ['Producto   → Nombre del producto'],
    ['Categoria  → Categoría (texto libre)'],
    ['Precio     → Número sin símbolo $'],
    ['Stock      → Número entero'],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instrData);
  wsI['!cols'] = [{ wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsI, 'Instrucciones');

  // ── Descargar ────────────────────────────────────────────────
  const fecha = new Date().toLocaleDateString('es-MX').replace(/\//g, '-');
  XLSX.writeFile(wb, `inventario_san_lorenzo_${fecha}.xlsx`);
  showToast('📥 Exportado correctamente');
}

// ══════════════════════════════════════════════════════════════
//  IMPORTAR DESDE EXCEL
// ══════════════════════════════════════════════════════════════
function importExcel() {
  if (typeof XLSX === 'undefined') { showToast('Cargando…'); loadSheetJS(_triggerImport); }
  else _triggerImport();
}

function _triggerImport() {
  const input = document.getElementById('xlsxImportInput');
  if (input) input.click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // reset so same file can be re-imported

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb    = XLSX.read(ev.target.result, { type: 'array' });
      const wsName = wb.SheetNames.find(n => n.toLowerCase().includes('inventario')) || wb.SheetNames[0];
      const ws    = wb.Sheets[wsName];
      const rows  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!rows.length) { showToast('Archivo vacío'); return; }

      // Find header row (look for SKU column)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        if (rows[i].some(c => String(c).toLowerCase().trim() === 'sku')) {
          headerIdx = i; break;
        }
      }

      const headers = rows[headerIdx].map(h => String(h).toLowerCase().trim());
      const iSKU   = headers.findIndex(h => h === 'sku');
      const iName  = headers.findIndex(h => h.includes('product') || h === 'producto' || h === 'nombre');
      const iCat   = headers.findIndex(h => h.includes('categ') || h === 'categoria');
      const iPrice = headers.findIndex(h => h.includes('prec') || h === 'precio');
      const iStock = headers.findIndex(h => h.includes('stock') || h === 'existencia' || h === 'cantidad');

      if (iSKU < 0 || iPrice < 0 || iStock < 0) {
        showToast('❌ No se encontraron columnas SKU, Precio o Stock');
        return;
      }

      let updated = 0, added = 0, errors = 0;
      const newProductos = [...productos]; // clone

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(c => c === '' || c === null || c === undefined)) continue; // skip empty

        const sku   = parseInt(row[iSKU]);
        const price = parseFloat(row[iPrice]);
        const stock = parseInt(row[iStock]);

        if (isNaN(sku) || isNaN(price) || isNaN(stock)) { errors++; continue; }

        const existing = newProductos.find(p => p.id === sku);
        if (existing) {
          // Update existing product
          existing.price = Math.max(0, price);
          existing.stock = Math.max(0, stock);
          if (iName  >= 0 && row[iName])  existing.name = String(row[iName]).trim();
          if (iCat   >= 0 && row[iCat])   existing.cat  = String(row[iCat]).trim();
          updated++;
        } else {
          // Add new product
          const name = iName >= 0 ? String(row[iName] || '').trim() : 'Nuevo producto ' + sku;
          const cat  = iCat  >= 0 ? String(row[iCat]  || '').trim() : 'Otros';
          if (!name) { errors++; continue; }
          newProductos.push({ id: sku, name, cat, price: Math.max(0, price), stock: Math.max(0, stock) });
          added++;
        }
      }

      if (updated === 0 && added === 0) {
        showToast(errors > 0 ? `❌ ${errors} filas con errores, ninguna importada` : 'No se encontraron datos válidos');
        return;
      }

      productos = newProductos;
      saveInventory();
      renderInventory();
      renderCategories();
      filterProducts();

      let msg = `✅ ${updated} actualizados`;
      if (added  > 0) msg += `, ${added} nuevos`;
      if (errors > 0) msg += `, ⚠️ ${errors} filas con error`;
      showToast(msg);

      // Show persistent result banner
      const banner = document.getElementById('importResult');
      if (banner) {
        banner.textContent = msg;
        banner.className = 'import-result show';
        setTimeout(() => banner.classList.remove('show'), 6000);
      }

    } catch (err) {
      console.error('Import error:', err);
      showToast('❌ Error al leer el archivo');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
