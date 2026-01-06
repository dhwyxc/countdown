// script.js - countdown logic + responsive UI

const DEFAULT_EVENTS = [
  { id: 'ny', name: "Tết Nguyên Đán (hãy nhập ngày dương lịch)", date: "", yearly: true, note: "Ngày theo âm lịch — hãy nhập ngày dương lịch chính xác cho năm bạn cần." },
  { id: 'newyear', name: "Tết Dương Lịch", date: "2026-01-01T00:00:00Z", yearly: true },
  { id: 'womenday', name: "Quốc tế Phụ nữ", date: "2026-03-08T00:00:00Z", yearly: true },
  { id: 'reunify', name: "Ngày Giải phóng miền Nam / 30-4", date: "2026-04-30T00:00:00Z", yearly: true },
  { id: 'labor', name: "Quốc tế Lao động / 1-5", date: "2026-05-01T00:00:00Z", yearly: true },
  { id: 'natday', name: "Quốc khánh / 2-9", date: "2026-09-02T00:00:00Z", yearly: true }
];

const STORAGE_KEY = 'vn_countdown_events_v2';
let events = [];
let intervalRef = null;
let searchTerm = '';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      events = JSON.parse(raw);
    } else {
      const v1 = localStorage.getItem('vn_countdown_events_v1');
      if (v1) events = JSON.parse(v1);
      else events = DEFAULT_EVENTS;
      save();
    }
  } catch(e){ events = DEFAULT_EVENTS; save(); }

  ensureIds();
  populatePreset();
  attachUI();
  renderAll();
  startTimer();
}

function ensureIds(){
  events.forEach((e, idx)=>{ if (!e.id) e.id = 'ev_' + Date.now() + '_' + idx; });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function attachUI(){
  document.getElementById('btnAdd').addEventListener('click', ()=>openModal({}));
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveFromModal);
  document.getElementById('btnExport').addEventListener('click', exportJSON);
  document.getElementById('btnImport').addEventListener('click', ()=>document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', (e)=>{ if (e.target.files.length) importJSONFile(e.target.files[0]); });

  document.getElementById('xBtn').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  const search = document.getElementById('searchInput');
  search.addEventListener('input', ()=>{
    searchTerm = (search.value || '').trim().toLowerCase();
    renderAll();
  });

  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') closeModal();
  });
}

function populatePreset(){
  const sel = document.getElementById('presetSelect');
  sel.innerHTML = '<option value="">Thêm nhanh ngày lễ…</option>';

  const presets = [
    {name: 'Tết Nguyên Đán (nhập ngày dương lịch)', date: ''},
    {name: 'Tết Dương Lịch — 01/01', date: '01-01'},
    {name: 'Quốc tế Phụ nữ — 08/03', date: '03-08'},
    {name: '30/4 — Giải phóng', date: '04-30'},
    {name: '01/05 — Lao động', date: '05-01'},
    {name: '02/09 — Quốc khánh', date: '09-02'}
  ];

  presets.forEach(p=>{
    const o = document.createElement('option');
    o.value = p.date;
    o.textContent = p.name;
    sel.appendChild(o);
  });

  sel.onchange = ()=>{
    const val = sel.value;
    if (!val) return;

    if (val.length===5){
      const now = new Date();
      const next = new Date(now.getFullYear(), parseInt(val.slice(0,2))-1, parseInt(val.slice(3,5)), 0,0,0);
      if (next <= now) next.setFullYear(next.getFullYear()+1);
      openModal({name: sel.options[sel.selectedIndex].text, date: toLocalInput(next), yearly: true});
    } else {
      openModal({name: 'Tết Nguyên Đán (nhập ngày dương lịch)', date: '', yearly: true});
    }

    sel.selectedIndex = 0;
  };
}

function renderAll(){
  const list = document.getElementById('list');
  list.innerHTML = '';

  const filtered = events.filter(ev=>{
    if (!searchTerm) return true;
    return (ev.name || '').toLowerCase().includes(searchTerm);
  });

  filtered.sort((a,b)=> getCountdownTarget(a).getTime() - getCountdownTarget(b).getTime());

  filtered.forEach(ev=>{
    const card = document.createElement('article');
    card.className = 'card';

    const head = document.createElement('div');
    head.className = 'card-head';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = ev.name || 'Untitled';

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = ev.yearly ? 'Lặp hàng năm' : 'Một lần';

    head.appendChild(title);
    head.appendChild(badge);

    const countdown = document.createElement('div');
    countdown.className = 'countdown';
    countdown.id = 't_'+ev.id;
    countdown.innerHTML = renderCountdownHTML(getCountdownParts(getCountdownTarget(ev).getTime() - Date.now()));

    card.appendChild(head);
    card.appendChild(countdown);

    if (ev.note){
      const note = document.createElement('div');
      note.className = 'help';
      note.textContent = ev.note;
      note.style.marginTop = '0';
      note.style.paddingTop = '2px';
      card.appendChild(note);
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const dateText = document.createElement('div');
    dateText.className = 'date';
    dateText.title = ev.date ? new Date(ev.date).toString() : '';
    dateText.textContent = formatDateLabel(ev);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const edit = document.createElement('button');
    edit.className = 'link-btn';
    edit.textContent = 'Sửa';
    edit.onclick = ()=> editEvent(ev.id);

    const del = document.createElement('button');
    del.className = 'link-btn danger';
    del.textContent = 'Xóa';
    del.onclick = ()=> removeEvent(ev.id);

    actions.appendChild(edit);
    actions.appendChild(del);

    meta.appendChild(dateText);
    meta.appendChild(actions);

    card.appendChild(meta);
    list.appendChild(card);
  });

  if (filtered.length === 0){
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `
      <div class="card-head">
        <h3 class="card-title">Không có kết quả</h3>
        <div class="badge">Gợi ý</div>
      </div>
      <div class="help">Hãy thử đổi từ khóa tìm kiếm hoặc bấm <b>+ Thêm sự kiện</b>.</div>
    `;
    list.appendChild(empty);
  }
}

function getCountdownTarget(ev){
  if (!ev.date) return new Date(Date.now()+1000*60*60*24*365);
  const d = new Date(ev.date);

  if (ev.yearly){
    const now = new Date();
    const candidate = new Date(d);
    candidate.setFullYear(now.getFullYear());
    if (candidate <= now) candidate.setFullYear(now.getFullYear()+1);
    return candidate;
  }
  return d;
}

function getCountdownParts(ms){
  if (ms <= 0) return { state: 'live' };

  const sec = Math.floor(ms/1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  return { state: 'running', days, hours, mins, secs };
}

function renderCountdownHTML(parts){
  if (parts.state === 'live') return `<div class="live">Đang diễn ra!</div>`;
  return `
    <div class="cd-box"><div class="cd-num">${parts.days}</div><div class="cd-lbl">ngày</div></div>
    <div class="cd-box"><div class="cd-num">${pad(parts.hours)}</div><div class="cd-lbl">giờ</div></div>
    <div class="cd-box"><div class="cd-num">${pad(parts.mins)}</div><div class="cd-lbl">phút</div></div>
    <div class="cd-box"><div class="cd-num">${pad(parts.secs)}</div><div class="cd-lbl">giây</div></div>
  `;
}

function pad(n){ return String(n).padStart(2,'0'); }

function startTimer(){
  if (intervalRef) clearInterval(intervalRef);

  intervalRef = setInterval(()=>{
    events.forEach(ev=>{
      const el = document.getElementById('t_'+ev.id);
      if (!el) return;
      const parts = getCountdownParts(getCountdownTarget(ev).getTime() - Date.now());
      el.innerHTML = renderCountdownHTML(parts);
    });
  }, 1000);
}

function formatDateLabel(ev){
  if (!ev.date) return 'Chưa có ngày dương lịch';

  const target = getCountdownTarget(ev);
  const opt = { weekday: 'short', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' };
  try{
    return 'Mốc: ' + target.toLocaleString('vi-VN', opt);
  }catch(e){
    return 'Mốc: ' + target.toLocaleString();
  }
}

function removeEvent(id){
  const ev = events.find(e=>e.id===id);
  if (!ev) return;
  if (!confirm(`Bạn có muốn xóa: "${ev.name}"?`)) return;
  events = events.filter(e=>e.id !== id);
  save();
  renderAll();
}

function editEvent(id){
  const ev = events.find(e=>e.id===id);
  if (!ev) return;
  openModal(ev);
}

function openModal(ev){
  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');

  document.getElementById('evName').value = ev.name || '';
  document.getElementById('evDate').value = ev.date ? toLocalInput(new Date(ev.date)) : (ev.date || '');
  document.getElementById('evYearly').checked = !!ev.yearly;

  modal.dataset.editId = ev.id || '';
  setTimeout(()=> document.getElementById('evName').focus(), 30);
}

function closeModal(){
  const modal = document.getElementById('modal');
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  modal.dataset.editId = '';
}

function toLocalInput(date){
  const pad2 = n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function saveFromModal(){
  const modal = document.getElementById('modal');
  const id = modal.dataset.editId || '';
  const name = (document.getElementById('evName').value || '').trim() || 'Untitled';
  const datev = document.getElementById('evDate').value;
  const yearly = document.getElementById('evYearly').checked;

  if (!datev){
    if (!confirm('Bạn chưa chọn ngày dương lịch. Lưu không có ngày?')) return;
  }

  const iso = datev ? new Date(datev).toISOString() : '';

  if (id){
    events = events.map(e => e.id === id ? ({...e, name, date: iso, yearly}) : e);
  } else {
    events.push({ id: 'ev_' + Date.now(), name, date: iso, yearly });
  }

  save();
  renderAll();
  closeModal();
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(events, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vn-holidays-countdown.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONFile(file){
  const reader = new FileReader();
  reader.onload = e=>{
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error('Định dạng JSON phải là mảng (array).');

      parsed.forEach((p, idx)=>{
        if (!p.id) p.id = 'ev_imp_' + Date.now() + '_' + idx;
        if (typeof p.name !== 'string') p.name = String(p.name || 'Untitled');
        if (typeof p.yearly !== 'boolean') p.yearly = !!p.yearly;
        if (typeof p.date !== 'string') p.date = '';
      });

      events = parsed;
      save();
      renderAll();
      alert('Đã nhập ' + parsed.length + ' mục.');
    } catch(err){
      alert('Lỗi khi nhập JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', load);
