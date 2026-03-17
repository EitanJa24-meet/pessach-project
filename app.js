// =============================================
//  VOLUNTEER DASHBOARD — app.js
// =============================================

// ---- CONFIG ----
const HARDCODED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyr1T1jHOTis8BTTuC0bdYw58Ed-BZQ5qBfyLJ87BOUTSofl4wx0ajv8cALtKeuvkJs/exec';
const HARDCODED_SHEET      = 'DATABASE';

const CFG_KEY = 'vdash_cfg';
let cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
if (HARDCODED_SCRIPT_URL) { cfg.url = HARDCODED_SCRIPT_URL; cfg.sheet = HARDCODED_SHEET; }
const LIVE = !!cfg.url;

// ---- STATE ----
let allRows = [], filteredRows = [], currentRow = null;
let currentView = 'table', mapObj = null, mapMarkers = [];

// Column indices (0-based)
const C = { id:0,title:1,desc:2,address:3,area:4,name:5,phone:6,status:7,link:8,responsible:9,volNotes:10,internalNotes:11,sys1:12,sys2:13,created:14,updated:15 };

// ---- STATUS ----
const STATUS_BADGE = {
  'צריך מתנדבים דחוף': 'badge-urgent',
  'בטיפול':             'badge-inprogress',
  'בבדיקה עם מתנדבים': 'badge-checking',
  'טופל':               'badge-done',
  'לא רלוונטי':         'badge-none',
  '':                   'badge-none',
};
const STATUS_COLOR = {
  'צריך מתנדבים דחוף':'#b83232','בטיפול':'#2563a8',
  'בבדיקה עם מתנדבים':'#c4621a','טופל':'#4a7c59','לא רלוונטי':'#7a7468',''
:'#7a7468'};

function badgeHTML(status) {
  const cls = STATUS_BADGE[status] || 'badge-none';
  return `<span class="badge ${cls}">${status || 'ללא סטטוס'}</span>`;
}

// ---- AREA CLASSIFIER ----
const AREAS = {
  'ירושלים':['ירושלים','jerusalem','בית הכרם','מלחה','גילה','רמות','פסגת זאב','הר נוף','קטמון','בקעה','טלביה','רחביה','עין כרם'],
  'עמק יזרעאל':['עמק יזרעאל','עפולה','מגדל העמק','נוף הגליל','כפר יהושע','מרחביה','גבע','עין חרוד'],
  'גבעת שמואל + פתח תקווה':['גבעת שמואל','פתח תקווה','פ"ת','כפר סבא','הוד השרון'],
  'גבעתיים ורמת גן':['גבעתיים','רמת גן','בני ברק','קריית אונו'],
  'זכרון והסביבה':['זכרון','זכרון יעקב','בנימינה','פרדס חנה','כרכור','גבעת עדה'],
  'ראשון לציון':['ראשון לציון','ראשל"צ','נס ציונה','גן יבנה','יבנה'],
  'תל אביב':['תל אביב','ת"א','יפו','נווה צדק','פלורנטין'],
  'רעננה':['רעננה','הרצליה','כפר שמריהו'],
  'שפלה':['שפלה','לוד','רמלה','קריית גת','גדרה','רחובות'],
  'לב השרון עמק חפר והסביבה':['עמק חפר','לב השרון','נתניה','חדרה','קיסריה','קדימה','צורן','מכמורת'],
  'משגב והסביבה':['משגב','כרמיאל','עכו','נהריה','שלומי','מעלות','סח\'נין','טמרה'],
  'שומרון':['שומרון','אריאל','עלי','אלפי מנשה','קרני שומרון','ברקן','עופרה','בית אל','שילה'],
  'מודיעין':['מודיעין','מכבים','רעות','שוהם'],
  'חיפה':['חיפה','טירת כרמל','נשר','קריית אתא','קריית ביאליק','קריית מוצקין','קריית ים'],
  'מועצה איזורית גזר':['גזר','חשמונאים','כפר מעש','בן שמן','גינתון'],
  'גוש עציון':['גוש עציון','אפרת','אלעזר','כפר עציון','נווה דניאל','אלון שבות','תקוע'],
  'אשקלון':['אשקלון','שדרות','נתיבות','אופקים'],
  'באר שבע':['באר שבע','דימונה','ירוחם','מצפה רמון','ערד','להבים','עומר'],
  'בית שמש':['בית שמש','צרעה','זנוח'],
};

function classifyArea(address) {
  if (!address) return '';
  const low = address.toLowerCase();
  for (const [area, kws] of Object.entries(AREAS)) {
    for (const kw of kws) { if (low.includes(kw.toLowerCase())) return area; }
  }
  return '';
}

// ---- PHONE ----
function normPhone(p) {
  if (!p) return '';
  let s = String(p).replace(/\D/g,'');
  if (s.startsWith('0')) s = '972'+s.slice(1);
  if (!s.startsWith('972')) s = '972'+s;
  return s;
}

// ---- FETCH helper (GET only — avoids CORS preflight) ----
async function api(params) {
  const url = cfg.url + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---- LOAD DATA ----
async function loadData() {
  if (!LIVE) { allRows = demoData(); applyFilters(); updateCount(); return; }
  try {
    const j = await api({ action:'read', sheet: cfg.sheet||'DATABASE' });
    if (j.rows) { allRows = j.rows.slice(1); applyFilters(); updateCount(); }
    else showToast('שגיאה: ' + (j.error||''));
  } catch(e) { showToast('שגיאת חיבור'); console.error(e); }
}
function updateCount() { document.getElementById('countLabel').textContent = `${allRows.length} בקשות`; }

// ---- FILTERS ----
function applyFilters() {
  const area   = document.getElementById('filterArea').value;
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase().trim();

  filteredRows = allRows.filter(row => {
    if (area   && row[C.area]   !== area)   return false;
    if (status && row[C.status] !== status) return false;
    if (search) {
      const hay = [row[C.title],row[C.address],row[C.name],row[C.area]].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const fc = document.getElementById('filterCount');
  fc.textContent = filteredRows.length === allRows.length
    ? `${allRows.length} בקשות`
    : `${filteredRows.length} מתוך ${allRows.length}`;

  if (currentView==='table') renderTable();
  if (currentView==='map')   renderPins();
}

// ---- TABLE ----
function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!filteredRows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">לא נמצאו בקשות</td></tr>';
    return;
  }
  tbody.innerHTML = filteredRows.map((row, i) => {
    const ph    = row[C.phone] || '';
    const np    = normPhone(ph);
    const addr  = encodeURIComponent(row[C.address]||'');
    const bCls  = STATUS_BADGE[row[C.status]] || 'badge-none';
    const rowId = 'row-'+i;
    return `<tr id="${rowId}">
      <td><span class="cell-text"><strong>${esc(row[C.title])}</strong></span></td>
      <td><span class="cell-text muted">${esc(row[C.address])}</span></td>
      <td><span class="cell-text muted">${esc(row[C.area])}</span></td>
      <td><span class="cell-text">${esc(row[C.name])}</span></td>
      <td><span class="cell-text muted" style="direction:ltr;text-align:right">${esc(ph)}</span></td>
      <td>
        <select class="inline-select" onchange="inlineSave(${i},'status',this.value,this)" data-orig="${esc(row[C.status]||'')}">
          <option value="" ${!row[C.status]?'selected':''}>— ללא סטטוס —</option>
          ${['צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי'].map(s=>`<option value="${s}" ${row[C.status]===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <input class="inline-input" value="${esc(row[C.responsible]||'')}" placeholder="אחראי..." 
          onblur="inlineSave(${i},'responsible',this.value,this)"
          onkeydown="if(event.key==='Enter')this.blur()">
      </td>
      <td class="actions-cell">
        ${ph?`<button class="tbl-btn tbl-btn-copy" title="העתק טלפון" onclick="copyText('${ph}','טלפון הועתק')">📋</button>`:''}
        ${np?`<button class="tbl-btn tbl-btn-wa"   title="WhatsApp"    onclick="window.open('https://wa.me/${np}','_blank')">💬</button>`:''}
        ${row[C.address]?`<button class="tbl-btn tbl-btn-nav" title="ניווט" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${addr}','_blank')">🧭</button>`:''}
        <button class="tbl-btn tbl-btn-open" title="פתח פרטים" onclick="openModal(${i})">✎</button>
      </td>
    </tr>`;
  }).join('');
}

// ---- INLINE SAVE ----
async function inlineSave(idx, field, value, el) {
  const row = filteredRows[idx];
  if (!row) return;
  const oldVal = field==='status' ? row[C.status] : row[C.responsible];
  if (value === oldVal) return; // no change

  if (field==='status')      row[C.status]      = value;
  if (field==='responsible') row[C.responsible] = value;

  if (!LIVE) { flashRow(idx); return; }

  const rowIndex = allRows.indexOf(row) + 2;
  try {
    const params = {
      action:'update', sheet:cfg.sheet||'DATABASE', row:rowIndex,
      t: new Date().toLocaleString('he-IL'),
    };
    if (field==='status')      params.s = value;
    if (field==='responsible') params.r = value;
    const j = await api(params);
    if (j.success) { flashRow(idx); row[C.updated]=params.t; }
    else { showToast('שגיאה בשמירה'); row[C.status]=oldVal; row[C.responsible]=oldVal; renderTable(); }
  } catch(e) { showToast('שגיאת חיבור'); }
}

function flashRow(idx) {
  const el = document.getElementById('row-'+idx);
  if (el) { el.classList.remove('row-saved'); void el.offsetWidth; el.classList.add('row-saved'); }
}

// ---- MODAL ----
function openModal(idx) {
  const row = filteredRows[idx];
  if (!row) return;
  currentRow = { row, idx };

  setText('modalTitle',  row[C.title]);
  setText('d-desc',      row[C.desc]);
  setText('d-address',   row[C.address]);
  setText('d-area',      row[C.area]);
  setText('d-name',      row[C.name]);
  setText('d-phone',     row[C.phone]);
  setText('d-created',   row[C.created]);
  setText('d-internal',  row[C.internalNotes]);

  // Link
  const linkEl = document.getElementById('d-link');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  if (row[C.link]) {
    linkEl.innerHTML = `<a href="${esc(row[C.link])}" target="_blank" style="color:var(--green)">${esc(row[C.link]).slice(0,40)}${row[C.link].length>40?'…':''}</a>`;
    copyLinkBtn.style.display = 'inline-flex';
    copyLinkBtn.onclick = () => copyText(row[C.link], 'קישור הועתק');
  } else {
    linkEl.textContent = '—';
    copyLinkBtn.style.display = 'none';
  }

  // Status badge
  const badge = document.getElementById('modalStatusBadge');
  badge.className = 'badge ' + (STATUS_BADGE[row[C.status]]||'badge-none');
  badge.textContent = row[C.status] || 'ללא סטטוס';

  // Contact buttons
  const np = normPhone(row[C.phone]);
  document.getElementById('d-wa').onclick   = () => np ? window.open('https://wa.me/'+np,'_blank') : showToast('אין טלפון');
  document.getElementById('d-nav').onclick  = () => row[C.address] ? window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(row[C.address]),'_blank') : showToast('אין כתובת');
  document.getElementById('d-copy').onclick = () => copyText(row[C.phone],'טלפון הועתק');

  // Editable fields
  document.getElementById('e-status').value      = row[C.status]      || '';
  document.getElementById('e-responsible').value = row[C.responsible] || '';
  document.getElementById('e-notes').value        = row[C.volNotes]    || '';
  document.getElementById('saveMsg').textContent  = '';

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- MODAL SAVE ----
async function saveChanges() {
  if (!currentRow) return;
  const { row, idx } = currentRow;
  const btn   = document.getElementById('saveBtn');
  const msg   = document.getElementById('saveMsg');
  const ns    = document.getElementById('e-status').value;
  const nr    = document.getElementById('e-responsible').value;
  const nn    = document.getElementById('e-notes').value;

  btn.disabled = true; btn.textContent = 'שומר...';
  msg.textContent = ''; msg.className = 'save-msg';

  if (!LIVE) {
    row[C.status]=ns; row[C.responsible]=nr; row[C.volNotes]=nn;
    await sleep(300); renderTable();
    btn.disabled=false; btn.textContent='💾 שמור שינויים';
    msg.textContent='✓ נשמר (הדגמה)'; msg.className='save-msg save-ok';
    return;
  }

  try {
    const rowIndex = allRows.indexOf(row) + 2;
    const t = new Date().toLocaleString('he-IL');
    const j = await api({ action:'update', sheet:cfg.sheet||'DATABASE', row:rowIndex, s:ns, r:nr, n:nn, t });
    if (j.success) {
      row[C.status]=ns; row[C.responsible]=nr; row[C.volNotes]=nn; row[C.updated]=t;
      // Update badge
      const badge = document.getElementById('modalStatusBadge');
      badge.className='badge '+(STATUS_BADGE[ns]||'badge-none');
      badge.textContent=ns||'ללא סטטוס';
      renderTable(); flashRow(idx);
      msg.textContent='✓ נשמר בהצלחה'; msg.className='save-msg save-ok';
    } else throw new Error(j.error||'שגיאה');
  } catch(e) {
    msg.textContent='✗ '+e.message; msg.className='save-msg save-err';
  }
  btn.disabled=false; btn.textContent='💾 שמור שינויים';
}

// ---- IMPORT ----
function openImport() {
  document.getElementById('importOverlay').classList.remove('hidden');
  document.getElementById('importMsg').textContent = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('doImportBtn').style.display = 'none';
  document.getElementById('fileDropLabel').textContent = 'לחץ או גרור קובץ Excel לכאן';
  document.getElementById('importFile').value = '';
  window._importRows = null;
  document.body.style.overflow = 'hidden';
}
function closeImport() {
  document.getElementById('importOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// Wire up file input and drag-drop
document.addEventListener('DOMContentLoaded', () => {
  const drop  = document.getElementById('fileDrop');
  const input = document.getElementById('importFile');

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if(input.files[0]) processFile(input.files[0]); });

  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  });

  // Close buttons
  document.getElementById('modalCloseBtn').addEventListener('click',  closeModal);
  document.getElementById('importCloseBtn').addEventListener('click', closeImport);
  document.getElementById('configCloseBtn').addEventListener('click', closeConfig);

  // Import button in topbar
  document.getElementById('importBtn').addEventListener('click', openImport);

  // Overlay click to close
  document.getElementById('modalOverlay').addEventListener('click',  e => { if(e.target===e.currentTarget) closeModal(); });
  document.getElementById('importOverlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeImport(); });
  document.getElementById('configOverlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeConfig(); });

  // ESC
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeModal(); closeImport(); closeConfig(); document.body.style.overflow=''; }
  });

  loadData();
  setInterval(loadData, 60000);
  if (!LIVE) showToast('מצב הדגמה — לחץ ⚙️ לחיבור');
});

function processFile(file) {
  document.getElementById('fileDropLabel').textContent = '⏳ קורא קובץ...';
  document.getElementById('importMsg').textContent = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('doImportBtn').style.display = 'none';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      if (raw.length < 2) { showImportMsg('הקובץ ריק',''); return; }
      parseAndPreview(raw);
    } catch(err) {
      showImportMsg('שגיאה בקריאת הקובץ: '+err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseAndPreview(raw) {
  const headers = raw[0].map(h => String(h).trim());
  const dataRows = raw.slice(1).filter(r => r.some(c => c !== ''));

  // Find columns by Hebrew header name (flexible)
  function col(...names) {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  }

  const CI = {
    title:   col('כותרת'),
    desc:    col('תיאור'),
    loc:     col('מיקום'),
    notes:   col('הערות'),
    contact: col('פרטי איש קשר','פרטי מבקש'),
    link:    col('קישור למשימה'),
  };

  const mapped = dataRows.map(r => {
    const contactRaw = CI.contact>=0 ? String(r[CI.contact]||'') : '';
    const parts = contactRaw.split(',').map(s=>s.trim());
    let phone = parts[1]||'';
    phone = phone.replace(/[\s\-]/g,'');
    if (phone.startsWith('+972')) phone = '0'+phone.slice(4);
    const address = CI.loc>=0 ? String(r[CI.loc]||'') : '';
    return {
      id:          'IMP-'+Date.now()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),
      title:       CI.title>=0   ? String(r[CI.title]||'')   : '',
      desc:        CI.desc>=0    ? String(r[CI.desc]||'')    : '',
      address,
      area:        classifyArea(address),
      contactName: parts[0]||'',
      phone,
      status:      '',
      link:        CI.link>=0    ? String(r[CI.link]||'')    : '',
      responsible: '',
      volNotes:    CI.notes>=0   ? String(r[CI.notes]||'')   : '',
      internalNotes:'', sys1:'', sys2:'',
      created:     new Date().toLocaleDateString('he-IL'),
      updated:     '',
    };
  });

  // Dedup
  const existLinks = new Set(allRows.map(r=>r[C.link]).filter(Boolean));
  const existKeys  = new Set(allRows.map(r=>(String(r[C.title])+'|'+String(r[C.address])).toLowerCase().trim()));

  const newRows = mapped.filter(r => {
    if (r.link && existLinks.has(r.link)) return false;
    const k = (r.title+'|'+r.address).toLowerCase().trim();
    if (k && existKeys.has(k)) return false;
    return !!r.title; // skip blank rows
  });

  window._importRows = newRows;
  const dup = mapped.length - newRows.length;
  const noArea = newRows.filter(r=>!r.area).length;

  document.getElementById('fileDropLabel').textContent = `✓ ${mapped.length} שורות נקראו`;
  document.getElementById('importMsg').innerHTML =
    `<span style="color:var(--green)">✓ ${mapped.length} שורות בקובץ</span> &nbsp;·&nbsp; `+
    `<span style="color:var(--green)"><strong>${newRows.length} חדשות</strong></span> &nbsp;·&nbsp; `+
    `<span style="color:var(--text3)">${dup} כפולות (ידולגו)</span>`+
    (noArea?` &nbsp;·&nbsp; <span style="color:var(--orange)">${noArea} ללא אזור</span>`:'');

  if (newRows.length === 0) {
    document.getElementById('importPreview').innerHTML = '<p style="text-align:center;padding:20px;color:var(--green)">✓ אין בקשות חדשות — הכל כבר קיים!</p>';
    return;
  }

  const preview = newRows.slice(0,8);
  document.getElementById('importPreview').innerHTML =
    `<table class="requests-table" style="font-size:12px">
      <thead><tr><th>כותרת</th><th>כתובת</th><th>אזור</th><th>שם</th><th>טלפון</th></tr></thead>
      <tbody>${preview.map(r=>`<tr>
        <td><span class="cell-text">${esc(r.title)}</span></td>
        <td><span class="cell-text muted">${esc(r.address)}</span></td>
        <td><span class="cell-text">${r.area?`<span style="color:var(--green)">${esc(r.area)}</span>`:'<span style="color:var(--orange)">לא סווג</span>'}</span></td>
        <td><span class="cell-text">${esc(r.contactName)}</span></td>
        <td><span class="cell-text muted" style="direction:ltr">${esc(r.phone)}</span></td>
      </tr>`).join('')}</tbody>
    </table>`+
    (newRows.length>8?`<p style="font-size:12px;color:var(--text3);padding:8px 12px">...ועוד ${newRows.length-8} שורות</p>`:'');

  const btn = document.getElementById('doImportBtn');
  btn.style.display = 'block';
  btn.textContent = `📥 ייבא ${newRows.length} בקשות חדשות`;
}

async function doImport() {
  const rows = window._importRows;
  if (!rows||!rows.length) return;
  const btn = document.getElementById('doImportBtn');
  btn.disabled = true;

  if (!LIVE) {
    rows.forEach(r => allRows.push([r.id,r.title,r.desc,r.address,r.area,r.contactName,r.phone,r.status,r.link,r.responsible,r.volNotes,r.internalNotes,r.sys1,r.sys2,r.created,r.updated]));
    applyFilters(); updateCount();
    document.getElementById('importMsg').innerHTML = `<span style="color:var(--green)">✓ יובאו ${rows.length} בקשות (הדגמה)</span>`;
    btn.style.display='none'; return;
  }

  try {
    let done = 0;
    for (let i=0; i<rows.length; i+=50) {
      btn.textContent = `מייבא... ${done}/${rows.length}`;
      const batch = rows.slice(i,i+50).map(r=>[r.id,r.title,r.desc,r.address,r.area,r.contactName,r.phone,r.status,r.link,r.responsible,r.volNotes,r.internalNotes,r.sys1,r.sys2,r.created,r.updated]);
      const j = await api({ action:'import', sheet:cfg.sheet||'DATABASE', rows:JSON.stringify(batch) });
      if (!j.success) throw new Error(j.error||'שגיאה');
      done += batch.length;
    }
    document.getElementById('importMsg').innerHTML = `<span style="color:var(--green)">✓ יובאו ${done} בקשות בהצלחה!</span>`;
    btn.style.display='none';
    loadData();
  } catch(e) {
    document.getElementById('importMsg').innerHTML = `<span style="color:var(--red)">✗ ${e.message}</span>`;
    btn.disabled=false; btn.textContent='נסה שוב';
  }
}

// ---- MAP ----
function setView(v) {
  currentView = v;
  document.getElementById('tableView').classList.toggle('hidden', v!=='table');
  document.getElementById('mapView').classList.toggle('hidden',  v!=='map');
  document.getElementById('btnTable').classList.toggle('active', v==='table');
  document.getElementById('btnMap').classList.toggle('active',   v==='map');
  if (v==='map') initMap();
}

function initMap() {
  if (!document.getElementById('map')) return;
  const go = () => {
    if (!mapObj) {
      mapObj = L.map('map', {center:[31.8,35.0],zoom:8});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapObj);
    }
    renderPins();
  };
  if (typeof L!=='undefined') { go(); return; }
  const css=document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
  const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload=go; document.head.appendChild(s);
}

async function renderPins() {
  if (!mapObj) return;
  mapMarkers.forEach(m=>m.remove()); mapMarkers=[];
  for (const row of filteredRows) {
    if (!row[C.address]) continue;
    try {
      const g = await geocode(row[C.address]);
      if (!g) continue;
      const color = STATUS_COLOR[row[C.status]]||'#7a7468';
      const icon  = L.divIcon({className:'',html:`<div style="width:13px;height:13px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,.3)"></div>`,iconSize:[13,13],iconAnchor:[6,6]});
      const m = L.marker([g.lat,g.lon],{icon}).addTo(mapObj);
      const ri = filteredRows.indexOf(row);
      m.on('click',()=>openModal(ri));
      mapMarkers.push(m);
    } catch(e){}
  }
}
const gcCache={};
async function geocode(address) {
  if (gcCache[address]) return gcCache[address];
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address+', Israel')}&format=json&limit=1`);
  const d = await r.json();
  if (d&&d[0]) { gcCache[address]={lat:+d[0].lat,lon:+d[0].lon}; return gcCache[address]; }
  return null;
}

// ---- CONFIG ----
function openConfig() {
  document.getElementById('cfg-url').value   = cfg.url||'';
  document.getElementById('cfg-sheet').value = cfg.sheet||'DATABASE';
  document.getElementById('configOverlay').classList.remove('hidden');
}
function closeConfig() { document.getElementById('configOverlay').classList.add('hidden'); }
function saveConfig() {
  cfg.url   = document.getElementById('cfg-url').value.trim();
  cfg.sheet = document.getElementById('cfg-sheet').value.trim()||'DATABASE';
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  closeConfig();
  showToast('נשמר, מרענן...'); setTimeout(()=>location.reload(),600);
}

// ---- UTILS ----
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v||'—';}
function copyText(text,msg){if(!text){showToast('אין מה להעתיק');return;}navigator.clipboard.writeText(text).then(()=>showToast(msg||'הועתק'));}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ---- DEMO DATA ----
function demoData(){return[
  [1,'עזרה בקניות','קשישה לבד','הרצל 14, רעננה','רעננה','רחל כהן','052-1234567','צריך מתנדבים דחוף','https://example.com/1','','','','','','12/03/2024',''],
  [2,'תיקון ברז','ברז דולף','אלנבי 8, תל אביב','תל אביב','משה לוי','053-7654321','בטיפול','https://example.com/2','דניאל כהן','בדרך','','','','11/03/2024','12/03/2024'],
  [3,'הסעה לרופא','הסעה לקופ"ח','הנשיא 22, חיפה','חיפה','שרה גולד','054-1111222','בבדיקה עם מתנדבים','','','','','','','10/03/2024',''],
  [4,'תרופות דחופות','חולה, צריך תרופות','בן גוריון 5, ירושלים','ירושלים','יוסף אביב','050-9876543','צריך מתנדבים דחוף','','','','','','','13/03/2024',''],
  [5,'עזרה עם ילדים','אמא חד הורית','שד הציונות 40, גבעתיים','גבעתיים ורמת גן','מיכל בר','052-3334455','טופל','https://example.com/5','נועה כץ','טופל','','','','09/03/2024','11/03/2024'],
];}
