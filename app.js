// =============================================
//  VOLUNTEER COORDINATION DASHBOARD
//  app.js — full client logic
// =============================================

// ---- CONFIG ----
// setup.sh will replace YOUR_SCRIPT_URL_HERE with your real URL automatically.
// You can also just edit this line manually.
const HARDCODED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyr1T1jHOTis8BTTuC0bdYw58Ed-BZQ5qBfyLJ87BOUTSofl4wx0ajv8cALtKeuvkJs/exec';
const HARDCODED_SHEET_NAME = 'DATABASE';

const CONFIG_KEY = 'vol_dashboard_config';
let config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');

// Use hardcoded URL if set, otherwise fall back to saved config
if (HARDCODED_SCRIPT_URL && HARDCODED_SCRIPT_URL !== 'YOUR_SCRIPT_URL_HERE') {
  config.scriptUrl  = HARDCODED_SCRIPT_URL;
  config.sheetName  = HARDCODED_SHEET_NAME;
}

// Demo mode = no URL set anywhere
const DEMO_MODE = !config.scriptUrl;

// ---- STATE ----
let allRows = [];
let filteredRows = [];
let currentRow = null;
let currentView = 'table';
let map = null;
let markers = [];
let activePills = new Set(['צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי']);

// ---- COLUMN INDICES (1-based per spec, 0-based in array) ----
const COL = {
  id: 0,
  title: 1,
  desc: 2,
  address: 3,
  area: 4,
  contactName: 5,
  phone: 6,
  status: 7,
  link: 8,
  responsible: 9,
  volNotes: 10,
  internalNotes: 11,
  sysNotes1: 12,
  sysNotes2: 13,
  created: 14,
  lastUpdate: 15
};

// ---- STATUS HELPERS ----
const STATUS_CLASS = {
  'צריך מתנדבים דחוף': 'status-urgent',
  'בטיפול':             'status-inprogress',
  'בבדיקה עם מתנדבים': 'status-checking',
  'טופל':               'status-done',
  'לא רלוונטי':         'status-irrelevant'
};
const STATUS_MAP_COLOR = {
  'צריך מתנדבים דחוף': '#f04040',
  'בטיפול':             '#4f8ef7',
  'בבדיקה עם מתנדבים': '#f59e0b',
  'טופל':               '#22c55e',
  'לא רלוונטי':         '#6b7280'
};

function statusBadgeHTML(status) {
  const cls = STATUS_CLASS[status] || 'status-irrelevant';
  return `<span class="status-badge ${cls}">${status || '—'}</span>`;
}

// ---- PHONE NORMALIZE ----
function normalizePhone(phone) {
  if (!phone) return '';
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  if (!p.startsWith('972')) p = '972' + p;
  return p;
}

// ---- DATA LOADING ----
async function loadData() {
  if (DEMO_MODE) {
    renderTable(getDemoData());
    updateCount(getDemoData().length);
    return;
  }
  try {
    const url = `${config.scriptUrl}?action=read&sheet=${encodeURIComponent(config.sheetName || 'DATABASE')}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.rows) {
      allRows = json.rows.slice(1); // skip header
      applyFilters();
      updateCount(allRows.length);
    } else {
      showToast('שגיאה בטעינת נתונים: ' + (json.error || 'לא ידוע'));
    }
  } catch (e) {
    showToast('שגיאת חיבור. בדוק את הגדרות ה-Script.');
    console.error(e);
  }
}

function updateCount(n) {
  document.getElementById('countLabel').textContent = `${n} בקשות פעילות`;
}

// ---- FILTERS ----
function applyFilters() {
  const area   = document.getElementById('filterArea').value;
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase().trim();

  const rows = DEMO_MODE ? getDemoData() : allRows;

  filteredRows = rows.filter(row => {
    if (area   && row[COL.area]   !== area)   return false;
    if (status && row[COL.status] !== status) return false;
    if (!activePills.has(row[COL.status]) && row[COL.status]) return false;
    if (search) {
      const hay = [row[COL.title], row[COL.address], row[COL.contactName], row[COL.area]]
                    .join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  document.getElementById('filterCount').textContent =
    filteredRows.length === rows.length
      ? `${rows.length} בקשות`
      : `מוצגות ${filteredRows.length} מתוך ${rows.length}`;

  if (currentView === 'table') renderTable(filteredRows);
  if (currentView === 'map')   renderMapPins(filteredRows);
}

function pillFilter(status, el) {
  el.classList.toggle('active');
  if (activePills.has(status)) activePills.delete(status);
  else activePills.add(status);
  applyFilters();
}

// ---- TABLE RENDER ----
function renderTable(rows) {
  const tbody = document.getElementById('tableBody');
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">לא נמצאו בקשות</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, i) => {
    const phone = row[COL.phone] || '';
    const normPhone = normalizePhone(phone);
    const address = encodeURIComponent(row[COL.address] || '');
    const statusClass = STATUS_CLASS[row[COL.status]] || 'status-irrelevant';

    return `<tr onclick="openModal(filteredRows[${i}])" style="animation-delay:${Math.min(i*0.02,0.3)}s">
      <td><strong>${esc(row[COL.title])}</strong></td>
      <td class="muted">${esc(row[COL.address])}</td>
      <td class="muted">${esc(row[COL.area])}</td>
      <td>${esc(row[COL.contactName])}</td>
      <td class="phone-cell">${esc(phone)}</td>
      <td>${statusBadgeHTML(row[COL.status])}</td>
      <td class="muted">${esc(row[COL.responsible])}</td>
      <td class="actions-cell" onclick="event.stopPropagation()">
        <button class="btn-copy" title="העתק טלפון" onclick="copyPhone('${phone}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        ${normPhone ? `<button class="btn-wa" title="WhatsApp" onclick="openWA('${normPhone}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>` : ''}
        ${row[COL.address] ? `<button class="btn-nav" title="ניווט" onclick="openNav('${address}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        </button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// ---- MODAL ----
function openModal(row) {
  currentRow = row;
  const modal = document.getElementById('requestModal');
  const overlay = document.getElementById('modalOverlay');

  // Populate read-only fields
  document.getElementById('modalTitle').textContent = row[COL.title] || '—';
  document.getElementById('modalDesc').textContent = row[COL.desc] || '—';
  document.getElementById('modalAddress').textContent = row[COL.address] || '—';
  document.getElementById('modalArea').textContent = row[COL.area] || '—';
  document.getElementById('modalContactName').textContent = row[COL.contactName] || '—';
  document.getElementById('modalPhone').textContent = row[COL.phone] || '—';
  document.getElementById('modalCreated').textContent = row[COL.created] || '—';
  document.getElementById('modalUpdated').textContent = row[COL.lastUpdate] || '—';
  document.getElementById('modalInternalNotes').textContent = row[COL.internalNotes] || '—';
  document.getElementById('modalSysNotes1').textContent = row[COL.sysNotes1] || '—';
  document.getElementById('modalSysNotes2').textContent = row[COL.sysNotes2] || '—';
  document.getElementById('modalVolNotes').textContent = row[COL.volNotes] || '—';

  // Link
  const linkEl = document.getElementById('modalLink');
  if (row[COL.link]) {
    linkEl.innerHTML = `<a href="${esc(row[COL.link])}" target="_blank" style="color:var(--accent)">פתח קישור</a>`;
  } else { linkEl.textContent = '—'; }

  // Status badge
  document.getElementById('modalStatusBadge').className = 'status-badge ' + (STATUS_CLASS[row[COL.status]] || 'status-irrelevant');
  document.getElementById('modalStatusBadge').textContent = row[COL.status] || '—';

  // Editable fields
  document.getElementById('editStatus').value = row[COL.status] || '';
  document.getElementById('editResponsible').value = row[COL.responsible] || '';
  document.getElementById('editVolunteerNotes').value = row[COL.volNotes] || '';

  // Action buttons
  const normPhone = normalizePhone(row[COL.phone]);
  document.getElementById('modalWaBtn').onclick = () => openWA(normPhone);
  document.getElementById('modalNavBtn').onclick = () => openNav(encodeURIComponent(row[COL.address]));
  document.getElementById('modalCopyBtn').onclick = () => copyPhone(row[COL.phone]);

  // Save status clear
  document.getElementById('saveStatus').textContent = '';

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- SAVE CHANGES ----
async function saveChanges() {
  if (!currentRow) return;
  const btn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('saveStatus');

  const newStatus  = document.getElementById('editStatus').value;
  const newResp    = document.getElementById('editResponsible').value;
  const newNotes   = document.getElementById('editVolunteerNotes').value;

  btn.disabled = true;
  btn.textContent = 'שומר...';
  statusEl.textContent = '';
  statusEl.className = 'save-status';

  if (DEMO_MODE) {
    // Demo: just update local state
    currentRow[COL.status]      = newStatus;
    currentRow[COL.responsible] = newResp;
    currentRow[COL.volNotes]    = newNotes;
    await sleep(600);
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> שמור שינויים';
    statusEl.textContent = '✓ נשמר בהצלחה (מצב הדגמה)';
    statusEl.className = 'save-status save-ok';
    applyFilters();
    return;
  }

  try {
    const rowIndex = allRows.indexOf(currentRow) + 2; // +1 header, +1 1-based
    const res = await fetch(config.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        sheet: config.sheetName || 'DATABASE',
        row: rowIndex,
        data: {
          [COL.status + 1]:      newStatus,
          [COL.responsible + 1]: newResp,
          [COL.volNotes + 1]:    newNotes,
          [COL.lastUpdate + 1]:  new Date().toLocaleString('he-IL')
        }
      })
    });
    const json = await res.json();
    if (json.success) {
      currentRow[COL.status]      = newStatus;
      currentRow[COL.responsible] = newResp;
      currentRow[COL.volNotes]    = newNotes;
      currentRow[COL.lastUpdate]  = new Date().toLocaleString('he-IL');
      statusEl.textContent = '✓ נשמר בהצלחה';
      statusEl.className = 'save-status save-ok';
      applyFilters();
      // update modal status badge live
      document.getElementById('modalStatusBadge').className = 'status-badge ' + (STATUS_CLASS[newStatus] || '');
      document.getElementById('modalStatusBadge').textContent = newStatus;
    } else {
      throw new Error(json.error || 'שגיאה לא ידועה');
    }
  } catch (e) {
    statusEl.textContent = '✗ שגיאה: ' + e.message;
    statusEl.className = 'save-status save-err';
  }

  btn.disabled = false;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> שמור שינויים';
}

// ---- ACTIONS ----
function copyPhone(phone) {
  if (!phone) return;
  navigator.clipboard.writeText(phone).then(() => showToast('הטלפון הועתק: ' + phone));
}
function openWA(normPhone) {
  if (!normPhone) { showToast('אין מספר טלפון'); return; }
  window.open('https://wa.me/' + normPhone, '_blank');
}
function openNav(encodedAddress) {
  if (!encodedAddress) return;
  window.open('https://www.google.com/maps/search/?api=1&query=' + encodedAddress, '_blank');
}

// ---- VIEW SWITCHING ----
function setView(v) {
  currentView = v;
  document.getElementById('tableView').classList.toggle('hidden', v !== 'table');
  document.getElementById('mapView').classList.toggle('hidden', v !== 'map');
  document.getElementById('btnTable').classList.toggle('active', v === 'table');
  document.getElementById('btnMap').classList.toggle('active', v === 'map');

  if (v === 'map') initMap();
}

// ---- MAP ----
function initMap() {
  if (map) { renderMapPins(filteredRows); return; }
  // Leaflet (loaded from CDN)
  if (typeof L === 'undefined') {
    loadLeaflet(() => {
      map = L.map('map', { center: [31.8, 35.0], zoom: 8 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
      renderMapPins(filteredRows);
    });
    return;
  }
  map = L.map('map', { center: [31.8, 35.0], zoom: 8 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  renderMapPins(filteredRows);
}

function loadLeaflet(cb) {
  // Load leaflet CSS
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  // Load leaflet JS
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = cb;
  document.head.appendChild(script);
}

async function renderMapPins(rows) {
  if (!map) return;
  // Clear old markers
  markers.forEach(m => m.remove());
  markers = [];

  for (const row of rows) {
    const address = row[COL.address];
    if (!address) continue;
    // Geocode via Nominatim
    try {
      const geo = await geocode(address);
      if (!geo) continue;
      const color = STATUS_MAP_COLOR[row[COL.status]] || '#6b7280';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      const marker = L.marker([geo.lat, geo.lon], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:Heebo,sans-serif;direction:rtl;min-width:180px">
          <strong>${row[COL.title]}</strong><br>
          <small>${row[COL.address]}</small><br>
          <span style="color:${color}">${row[COL.status]}</span>
        </div>
      `);
      marker.on('click', () => openModal(row));
      markers.push(marker);
    } catch(e) { /* skip */ }
  }
}

const geocodeCache = {};
async function geocode(address) {
  if (geocodeCache[address]) return geocodeCache[address];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Israel')}&format=json&limit=1`);
    const data = await res.json();
    if (data && data[0]) {
      geocodeCache[address] = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      return geocodeCache[address];
    }
  } catch(e) {}
  return null;
}

// ---- CONFIG ----
function openConfig() {
  document.getElementById('configOverlay').classList.remove('hidden');
  if (config.sheetId)   document.getElementById('sheetIdInput').value = config.sheetId;
  if (config.sheetName) document.getElementById('sheetNameInput').value = config.sheetName;
  if (config.scriptUrl) document.getElementById('scriptUrlInput').value = config.scriptUrl;
}
function closeConfig(e) {
  if (e && e.target !== document.getElementById('configOverlay')) return;
  document.getElementById('configOverlay').classList.add('hidden');
}
function saveConfig() {
  config.sheetId   = document.getElementById('sheetIdInput').value.trim();
  config.sheetName = document.getElementById('sheetNameInput').value.trim() || 'DATABASE';
  config.scriptUrl = document.getElementById('scriptUrlInput').value.trim();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  document.getElementById('configOverlay').classList.add('hidden');
  showToast('הגדרות נשמרו. טוען נתונים...');
  location.reload();
}

// ---- UTILS ----
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- DEMO DATA ----
function getDemoData() {
  return [
    [1,'עזרה בקניות - קשישה','קשישה לבד זקוקה לעזרה בקניות שבועיות','הרצל 14, רעננה','רעננה','רחל כהן','0521234567','צריך מתנדבים דחוף','','','','','','','12/03/2024',''],
    [2,'תיקון ברז דולף','ברז דולף בשירותים, אין כסף לשרברב','אלנבי 8, תל אביב','תל אביב','משה לוי','0537654321','בטיפול','','דניאל כהן','בדרך אליו היום','','','','11/03/2024','12/03/2024'],
    [3,'הסעה לרופא','זקוקה להסעה לקופ"ח ביום שני','הנשיא 22, חיפה','חיפה','שרה גולד','0541111222','בבדיקה עם מתנדבים','','','','','','','10/03/2024',''],
    [4,'תרופות דחופות','חולה ולא יכול לצאת, צריך תרופות מבית מרקחת','בן גוריון 5, ירושלים','ירושלים','יוסף אביב','0509876543','צריך מתנדבים דחוף','','','','','','','13/03/2024',''],
    [5,'עזרה עם ילדים','אמא חד הורית, צריכה עזרה עם ילדים בערב','שד׳ הציונות 40, גבעתיים ורמת גן','גבעתיים ורמת גן','מיכל בר','0523334455','טופל','','נועה כץ','טופל בהצלחה','','','','09/03/2024','11/03/2024'],
    [6,'ניקיון בית','קשיש עם קושי בניידות צריך עזרה בניקיון','ביאליק 3, ראשון לציון','ראשון לציון','אברהם נחום','0545556677','לא רלוונטי','','','בסוף ביטל','','','','08/03/2024','12/03/2024'],
    [7,'עזרה בחינוך מיוחד','ילד עם צרכים מיוחדים צריך ליווי','הרב קוק 17, מודיעין','מודיעין','לאה שפירא','0526667788','בטיפול','','אלון מזרחי','','','','','12/03/2024',''],
    [8,'הסעה לטיפול רפואי','טיפולים כימותרפיים פעמיים בשבוע','סמולנסקין 9, באר שבע','באר שבע','דוד ברקוביץ','0538889900','צריך מתנדבים דחוף','','','','','','','13/03/2024',''],
  ];
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Auto-refresh every 60 seconds
  setInterval(loadData, 60000);

  if (DEMO_MODE) {
    showToast('מצב הדגמה — לחץ ⚙️ להגדרת חיבור לגיליון');
  }

  // Keyboard: ESC closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('modalOverlay').classList.add('hidden');
      document.getElementById('configOverlay').classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
});
