// =============================================
//  VOLUNTEER COORDINATION DASHBOARD — app.js
// =============================================

// ---- CONFIG ----
const HARDCODED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyr1T1jHOTis8BTTuC0bdYw58Ed-BZQ5qBfyLJ87BOUTSofl4wx0ajv8cALtKeuvkJs/exec';
const HARDCODED_SHEET_NAME = 'DATABASE';

const CONFIG_KEY = 'vol_dashboard_config';
let config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
// Always prefer the hardcoded URL if it's been set (not the placeholder)
if (HARDCODED_SCRIPT_URL && HARDCODED_SCRIPT_URL !== 'YOUR_SCRIPT_URL_HERE') {
  config.scriptUrl = HARDCODED_SCRIPT_URL;
  config.sheetName = HARDCODED_SHEET_NAME;
}
const DEMO_MODE = !config.scriptUrl;

// ---- STATE ----
let allRows = [], filteredRows = [], currentRow = null;
let currentView = 'table', map = null, markers = [];
let activePills = new Set(['צריך מתנדבים דחוף','בטיפול','בבדיקה עם מתנדבים','טופל','לא רלוונטי','']);

const COL = { id:0,title:1,desc:2,address:3,area:4,contactName:5,phone:6,status:7,link:8,responsible:9,volNotes:10,internalNotes:11,sysNotes1:12,sysNotes2:13,created:14,lastUpdate:15 };

const STATUS_CLASS = {
  'צריך מתנדבים דחוף':'status-urgent','בטיפול':'status-inprogress',
  'בבדיקה עם מתנדבים':'status-checking','טופל':'status-done','לא רלוונטי':'status-irrelevant'
};
const STATUS_MAP_COLOR = {
  'צריך מתנדבים דחוף':'#f04040','בטיפול':'#4f8ef7',
  'בבדיקה עם מתנדבים':'#f59e0b','טופל':'#22c55e','לא רלוונטי':'#6b7280'
};

function statusBadgeHTML(status) {
  if (!status) return '<span class="status-badge status-irrelevant">ללא סטטוס</span>';
  const cls = STATUS_CLASS[status] || 'status-irrelevant';
  return `<span class="status-badge ${cls}">${status}</span>`;
}

function normalizePhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/\D/g,'');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  if (!p.startsWith('972')) p = '972' + p;
  return p;
}

// ---- AREA CLASSIFIER ----
const AREA_KEYWORDS = {
  'ירושלים':['ירושלים','jerusalem','בית הכרם','מלחה','גילה','רמות','פסגת זאב','הר נוף','קטמון','בקעה','טלביה','רחביה','עין כרם'],
  'עמק יזרעאל':['עמק יזרעאל','עפולה','מגדל העמק','נוף הגליל','כפר יהושע','מרחביה','גבע','עין חרוד'],
  'גבעת שמואל + פתח תקווה':['גבעת שמואל','פתח תקווה','פ"ת','כפר סבא','הוד השרון'],
  'גבעתיים ורמת גן':['גבעתיים','רמת גן','בני ברק','קריית אונו'],
  'זכרון והסביבה':['זכרון','זכרון יעקב','בנימינה','פרדס חנה','כרכור','גבעת עדה'],
  'ראשון לציון':['ראשון לציון','ראשל"צ','נס ציונה','גן יבנה','יבנה'],
  'תל אביב':['תל אביב','ת"א','יפו','נווה צדק','פלורנטין'],
  'רעננה':['רעננה','הרצליה','כפר שמריהו'],
  'שפלה':['שפלה','לוד','רמלה','קריית גת','קריית מלאכי','גדרה','רחובות'],
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
  const lower = address.toLowerCase();
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return area;
    }
  }
  return '';
}

// ---- DATA LOADING ----
async function loadData() {
  if (DEMO_MODE) { allRows = getDemoData(); applyFilters(); updateCount(allRows.length); return; }
  try {
    const res  = await fetch(`${config.scriptUrl}?action=read&sheet=${encodeURIComponent(config.sheetName||'DATABASE')}`);
    const json = await res.json();
    if (json.rows) { allRows = json.rows.slice(1); applyFilters(); updateCount(allRows.length); }
    else showToast('שגיאה: ' + (json.error||'לא ידוע'));
  } catch(e) { showToast('שגיאת חיבור לגיליון'); console.error(e); }
}
function updateCount(n) { document.getElementById('countLabel').textContent = `${n} בקשות`; }

// ---- FILTERS ----
function applyFilters() {
  const area   = document.getElementById('filterArea').value;
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase().trim();

  filteredRows = allRows.filter(row => {
    if (area   && row[COL.area]   !== area)   return false;
    if (status && row[COL.status] !== status) return false;
    if (search) {
      const hay = [row[COL.title],row[COL.address],row[COL.contactName],row[COL.area]].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  document.getElementById('filterCount').textContent =
    filteredRows.length === allRows.length ? `${allRows.length} בקשות`
    : `מוצגות ${filteredRows.length} מתוך ${allRows.length}`;

  if (currentView === 'table') renderTable(filteredRows);
  if (currentView === 'map')   renderMapPins(filteredRows);
}

function pillFilter(status, el) {
  el.classList.toggle('active');
  if (activePills.has(status)) activePills.delete(status); else activePills.add(status);
  applyFilters();
}

// ---- TABLE ----
function renderTable(rows) {
  const tbody = document.getElementById('tableBody');
  if (!rows||rows.length===0) { tbody.innerHTML='<tr class="empty-row"><td colspan="8">לא נמצאו בקשות</td></tr>'; return; }
  tbody.innerHTML = rows.map((row,i) => {
    const phone = row[COL.phone]||'';
    const normPhone = normalizePhone(phone);
    const address = encodeURIComponent(row[COL.address]||'');
    return `<tr onclick="openModal(filteredRows[${i}])" style="animation-delay:${Math.min(i*0.02,0.3)}s">
      <td><strong>${esc(row[COL.title])}</strong></td>
      <td class="muted">${esc(row[COL.address])}</td>
      <td class="muted">${esc(row[COL.area])}</td>
      <td>${esc(row[COL.contactName])}</td>
      <td class="phone-cell">${esc(phone)}</td>
      <td>${statusBadgeHTML(row[COL.status])}</td>
      <td class="muted">${esc(row[COL.responsible])}</td>
      <td class="actions-cell" onclick="event.stopPropagation()">
        <button class="btn-copy" title="העתק טלפון" onclick="copyPhone('${phone}')">📋</button>
        ${normPhone?`<button class="btn-wa" title="WhatsApp" onclick="openWA('${normPhone}')">💬</button>`:''}
        ${row[COL.address]?`<button class="btn-nav" title="ניווט" onclick="openNav('${address}')">🧭</button>`:''}
      </td>
    </tr>`;
  }).join('');
}

// ---- MODAL ----
function openModal(row) {
  currentRow = row;
  document.getElementById('modalTitle').textContent        = row[COL.title]||'—';
  document.getElementById('modalDesc').textContent         = row[COL.desc]||'—';
  document.getElementById('modalAddress').textContent      = row[COL.address]||'—';
  document.getElementById('modalArea').textContent         = row[COL.area]||'—';
  document.getElementById('modalContactName').textContent  = row[COL.contactName]||'—';
  document.getElementById('modalPhone').textContent        = row[COL.phone]||'—';
  document.getElementById('modalCreated').textContent      = row[COL.created]||'—';
  document.getElementById('modalUpdated').textContent      = row[COL.lastUpdate]||'—';
  document.getElementById('modalInternalNotes').textContent= row[COL.internalNotes]||'—';
  document.getElementById('modalSysNotes1').textContent    = row[COL.sysNotes1]||'—';
  document.getElementById('modalSysNotes2').textContent    = row[COL.sysNotes2]||'—';
  document.getElementById('modalVolNotes').textContent     = row[COL.volNotes]||'—';

  const linkEl = document.getElementById('modalLink');
  linkEl.innerHTML = row[COL.link] ? `<a href="${esc(row[COL.link])}" target="_blank" style="color:var(--accent)">פתח קישור</a>` : '—';

  const badge = document.getElementById('modalStatusBadge');
  badge.className = 'status-badge ' + (STATUS_CLASS[row[COL.status]]||'status-irrelevant');
  badge.textContent = row[COL.status]||'ללא סטטוס';

  document.getElementById('editStatus').value       = row[COL.status]||'';
  document.getElementById('editResponsible').value  = row[COL.responsible]||'';
  document.getElementById('editVolunteerNotes').value = row[COL.volNotes]||'';
  document.getElementById('saveStatus').textContent = '';

  const normPhone = normalizePhone(row[COL.phone]);
  document.getElementById('modalWaBtn').onclick  = () => openWA(normPhone);
  document.getElementById('modalNavBtn').onclick = () => openNav(encodeURIComponent(row[COL.address]||''));
  document.getElementById('modalCopyBtn').onclick = () => copyPhone(row[COL.phone]);

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- SAVE (uses GET params to avoid CORS preflight) ----
async function saveChanges() {
  if (!currentRow) return;
  const btn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('saveStatus');
  const newStatus = document.getElementById('editStatus').value;
  const newResp   = document.getElementById('editResponsible').value;
  const newNotes  = document.getElementById('editVolunteerNotes').value;

  btn.disabled = true; btn.textContent = 'שומר...';
  statusEl.textContent = ''; statusEl.className = 'save-status';

  if (DEMO_MODE) {
    currentRow[COL.status]=newStatus; currentRow[COL.responsible]=newResp; currentRow[COL.volNotes]=newNotes;
    await sleep(400);
    btn.disabled=false; btn.textContent='שמור שינויים';
    statusEl.textContent='✓ נשמר (הדגמה)'; statusEl.className='save-status save-ok';
    applyFilters(); return;
  }

  try {
    const rowIndex = allRows.indexOf(currentRow) + 2;
    const params = new URLSearchParams({
      action: 'update',
      sheet: config.sheetName||'DATABASE',
      row: rowIndex,
      s: newStatus,
      r: newResp,
      n: newNotes,
      t: new Date().toLocaleString('he-IL')
    });
    const res  = await fetch(config.scriptUrl + '?' + params);
    const json = await res.json();
    if (json.success) {
      currentRow[COL.status]=newStatus; currentRow[COL.responsible]=newResp;
      currentRow[COL.volNotes]=newNotes; currentRow[COL.lastUpdate]=new Date().toLocaleString('he-IL');
      statusEl.textContent='✓ נשמר בהצלחה'; statusEl.className='save-status save-ok';
      document.getElementById('modalStatusBadge').className='status-badge '+(STATUS_CLASS[newStatus]||'status-irrelevant');
      document.getElementById('modalStatusBadge').textContent=newStatus||'ללא סטטוס';
      applyFilters();
    } else throw new Error(json.error||'שגיאה');
  } catch(e) {
    statusEl.textContent='✗ שגיאה: '+e.message; statusEl.className='save-status save-err';
  }
  btn.disabled=false; btn.textContent='שמור שינויים';
}

// ---- ACTIONS ----
function copyPhone(p) { if(!p)return; navigator.clipboard.writeText(p).then(()=>showToast('הועתק: '+p)); }
function openWA(p)    { if(!p){showToast('אין טלפון');return;} window.open('https://wa.me/'+p,'_blank'); }
function openNav(a)   { if(!a)return; window.open('https://www.google.com/maps/search/?api=1&query='+a,'_blank'); }

// ---- VIEWS ----
function setView(v) {
  currentView=v;
  document.getElementById('tableView').classList.toggle('hidden',v!=='table');
  document.getElementById('mapView').classList.toggle('hidden',v!=='map');
  document.getElementById('btnTable').classList.toggle('active',v==='table');
  document.getElementById('btnMap').classList.toggle('active',v==='map');
  if(v==='map') initMap();
}

// ---- MAP ----
function initMap() {
  if (map) { renderMapPins(filteredRows); return; }
  if (typeof L==='undefined') { loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',()=>{ loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'); map=L.map('map',{center:[31.8,35.0],zoom:8}); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); renderMapPins(filteredRows); }); return; }
  map=L.map('map',{center:[31.8,35.0],zoom:8}); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); renderMapPins(filteredRows);
}
async function renderMapPins(rows) {
  if(!map)return; markers.forEach(m=>m.remove()); markers=[];
  for(const row of rows) { if(!row[COL.address])continue; try { const g=await geocode(row[COL.address]); if(!g)continue; const color=STATUS_MAP_COLOR[row[COL.status]]||'#6b7280'; const icon=L.divIcon({className:'',html:`<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,iconSize:[14,14],iconAnchor:[7,7]}); const m=L.marker([g.lat,g.lon],{icon}).addTo(map); m.on('click',()=>openModal(row)); markers.push(m); } catch(e){} }
}
const geocodeCache={};
async function geocode(address) {
  if(geocodeCache[address])return geocodeCache[address];
  const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address+', Israel')}&format=json&limit=1`);
  const d=await res.json(); if(d&&d[0]){geocodeCache[address]={lat:+d[0].lat,lon:+d[0].lon};return geocodeCache[address];} return null;
}

// ---- IMPORT ----
function openImport() {
  document.getElementById('importOverlay').classList.remove('hidden');
  document.getElementById('importStatus').innerHTML='';
  document.getElementById('importPreview').innerHTML='';
  document.getElementById('importDoBtn').classList.add('hidden');
  document.getElementById('importFileInput').value='';
  window._importNewRows=null;
}
function closeImport(e) {
  if(e&&e.target!==document.getElementById('importOverlay'))return;
  document.getElementById('importOverlay').classList.add('hidden');
}

async function handleImportFile(input) {
  const file=input.files[0]; if(!file)return;
  document.getElementById('importStatus').textContent='קורא קובץ...';
  if(typeof XLSX==='undefined') await loadScriptAsync('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  if(raw.length<2){document.getElementById('importStatus').textContent='הקובץ ריק';return;}

  const headers=raw[0];
  const dataRows=raw.slice(1).filter(r=>r.some(c=>c!==''));
  const idx={};
  headers.forEach((h,i)=>{ idx[String(h).trim()]=i; });

  // Map columns — flexible matching
  function findCol(...names) { for(const n of names){if(idx[n]!==undefined)return idx[n];} return -1; }
  const C = {
    title:   findCol('כותרת'),
    desc:    findCol('תיאור'),
    loc:     findCol('מיקום'),
    notes:   findCol('הערות'),
    contact: findCol('פרטי איש קשר'),
    link:    findCol('קישור למשימה למתנדב','קישור למשימה'),
  };

  const mapped = dataRows.map(r => {
    const contactRaw = C.contact>=0 ? String(r[C.contact]||'') : '';
    const parts = contactRaw.split(',').map(s=>s.trim());
    let phone = parts[1]||'';
    phone = phone.replace(/\s/g,'');
    if(phone.startsWith('+972')) phone='0'+phone.slice(4);
    const address = C.loc>=0 ? String(r[C.loc]||'') : '';
    return {
      id:    'IMP-'+Date.now()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),
      title: C.title>=0 ? String(r[C.title]||'') : '',
      desc:  C.desc>=0  ? String(r[C.desc]||'')  : '',
      address,
      area:  classifyArea(address),
      contactName: parts[0]||'',
      phone,
      status: '',
      link:  C.link>=0 ? String(r[C.link]||'') : '',
      responsible:'', volNotes: C.notes>=0?String(r[C.notes]||''):'',
      internalNotes:'', sysNotes1:'', sysNotes2:'',
      created: new Date().toLocaleDateString('he-IL'), lastUpdate:'',
    };
  });

  // Dedup: by link URL first, then by title+address combo
  const existingLinks = new Set(allRows.map(r=>r[COL.link]).filter(Boolean));
  const existingKeys  = new Set(allRows.map(r=>(r[COL.title]+'|'+r[COL.address]).toLowerCase()));
  const newRows = mapped.filter(r => {
    if(r.link && existingLinks.has(r.link)) return false;
    if(existingKeys.has((r.title+'|'+r.address).toLowerCase())) return false;
    return true;
  });

  window._importNewRows = newRows;
  const dupCount = mapped.length - newRows.length;
  const unclassified = newRows.filter(r=>!r.area).length;

  document.getElementById('importStatus').innerHTML =
    `<span style="color:var(--done)">✓ ${mapped.length} שורות בקובץ</span> &nbsp;|&nbsp;
     <span style="color:var(--accent)">${newRows.length} חדשות</span> &nbsp;|&nbsp;
     <span style="color:var(--text-muted)">${dupCount} כפולות (ידולגו)</span>`+
    (unclassified?` &nbsp;|&nbsp; <span style="color:var(--checking)">${unclassified} ללא אזור</span>`:'');

  const preview = newRows.slice(0,10);
  document.getElementById('importPreview').innerHTML = preview.length===0
    ? '<p style="color:var(--done);padding:20px;text-align:center">✓ אין בקשות חדשות — הכל כבר קיים</p>'
    : `<p style="font-size:12px;color:var(--text-dim);margin-bottom:8px">תצוגה מקדימה (${preview.length} מתוך ${newRows.length}):</p>
      <table class="requests-table" style="font-size:12px">
        <thead><tr><th>כותרת</th><th>כתובת</th><th>אזור</th><th>שם</th><th>טלפון</th></tr></thead>
        <tbody>${preview.map(r=>`<tr>
          <td>${esc(r.title)}</td>
          <td>${esc(r.address)}</td>
          <td>${r.area?`<span style="color:var(--done)">${esc(r.area)}</span>`:'<span style="color:var(--checking)">לא סווג</span>'}</td>
          <td>${esc(r.contactName)}</td>
          <td style="direction:ltr;text-align:right">${esc(r.phone)}</td>
        </tr>`).join('')}</tbody>
      </table>`+
    (newRows.length>10?`<p style="font-size:12px;color:var(--text-dim);margin-top:6px">...ועוד ${newRows.length-10} שורות</p>`:'');

  const btn = document.getElementById('importDoBtn');
  if(newRows.length>0){ btn.classList.remove('hidden'); btn.textContent=`ייבא ${newRows.length} בקשות לגיליון`; }
  else btn.classList.add('hidden');
}

async function doImport() {
  const rows = window._importNewRows;
  if(!rows||rows.length===0)return;
  const btn = document.getElementById('importDoBtn');
  btn.disabled=true; btn.textContent='מייבא...';

  if(DEMO_MODE){
    rows.forEach(r=>allRows.push([r.id,r.title,r.desc,r.address,r.area,r.contactName,r.phone,r.status,r.link,r.responsible,r.volNotes,r.internalNotes,r.sysNotes1,r.sysNotes2,r.created,r.lastUpdate]));
    applyFilters();
    document.getElementById('importStatus').innerHTML=`<span style="color:var(--done)">✓ יובאו ${rows.length} בקשות (הדגמה)</span>`;
    btn.classList.add('hidden'); return;
  }

  try {
    let imported=0;
    for(let i=0;i<rows.length;i+=50){
      const batch=rows.slice(i,i+50);
      btn.textContent=`מייבא... ${imported}/${rows.length}`;
      const params=new URLSearchParams({
        action:'import', sheet:config.sheetName||'DATABASE',
        rows:JSON.stringify(batch.map(r=>[r.id,r.title,r.desc,r.address,r.area,r.contactName,r.phone,r.status,r.link,r.responsible,r.volNotes,r.internalNotes,r.sysNotes1,r.sysNotes2,r.created,r.lastUpdate]))
      });
      const res=await fetch(config.scriptUrl+'?'+params);
      const json=await res.json();
      if(!json.success) throw new Error(json.error||'שגיאה');
      imported+=batch.length;
    }
    document.getElementById('importStatus').innerHTML=`<span style="color:var(--done)">✓ יובאו ${imported} בקשות בהצלחה!</span>`;
    btn.classList.add('hidden');
    loadData();
  } catch(e) {
    document.getElementById('importStatus').innerHTML=`<span style="color:var(--urgent)">✗ ${e.message}</span>`;
    btn.disabled=false; btn.textContent='נסה שוב';
  }
}

// ---- CONFIG MODAL ----
function openConfig() {
  document.getElementById('configOverlay').classList.remove('hidden');
  if(config.scriptUrl) document.getElementById('scriptUrlInput').value=config.scriptUrl;
  if(config.sheetName) document.getElementById('sheetNameInput').value=config.sheetName;
}
function closeConfig(e) {
  if(e&&e.target!==document.getElementById('configOverlay'))return;
  document.getElementById('configOverlay').classList.add('hidden');
}
function saveConfig() {
  config.scriptUrl = document.getElementById('scriptUrlInput').value.trim();
  config.sheetName = document.getElementById('sheetNameInput').value.trim()||'DATABASE';
  localStorage.setItem(CONFIG_KEY,JSON.stringify(config));
  document.getElementById('configOverlay').classList.add('hidden');
  showToast('נשמר. מרענן...'); setTimeout(()=>location.reload(),800);
}

// ---- UTILS ----
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function loadScript(src,cb){const s=document.createElement('script');s.src=src;s.onload=cb;document.head.appendChild(s);}
function loadCSS(href){const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);}
function loadScriptAsync(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}

// ---- DEMO DATA ----
function getDemoData(){return[
  [1,'עזרה בקניות','קשישה לבד זקוקה לעזרה','הרצל 14, רעננה','רעננה','רחל כהן','052-1234567','צריך מתנדבים דחוף','','','','','','','12/03/2024',''],
  [2,'תיקון ברז','ברז דולף בשירותים','אלנבי 8, תל אביב','תל אביב','משה לוי','053-7654321','בטיפול','','דניאל כהן','בדרך','','','','11/03/2024','12/03/2024'],
  [3,'הסעה לרופא','זקוקה להסעה לקופ"ח','הנשיא 22, חיפה','חיפה','שרה גולד','054-1111222','בבדיקה עם מתנדבים','','','','','','','10/03/2024',''],
  [4,'תרופות דחופות','חולה, צריך תרופות','בן גוריון 5, ירושלים','ירושלים','יוסף אביב','050-9876543','צריך מתנדבים דחוף','','','','','','','13/03/2024',''],
  [5,'עזרה עם ילדים','אמא חד הורית','שד׳ הציונות 40, גבעתיים','גבעתיים ורמת גן','מיכל בר','052-3334455','טופל','','נועה כץ','טופל','','','','09/03/2024','11/03/2024'],
];}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setInterval(loadData, 60000);
  if(DEMO_MODE) showToast('מצב הדגמה — לחץ ⚙️ לחיבור גיליון');
  document.addEventListener('keydown', e => {
    if(e.key==='Escape'){
      ['modalOverlay','configOverlay','importOverlay'].forEach(id=>{
        const el=document.getElementById(id); if(el)el.classList.add('hidden');
      });
      document.body.style.overflow='';
    }
  });
});
