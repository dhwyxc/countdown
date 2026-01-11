// script.js - countdown logic + responsive UI
(() => {
  const list = document.getElementById('list');
  const editModal = document.getElementById('modal');

  const zoom = document.getElementById('zoom');
  const zoomTitle = document.getElementById('zoomTitle');
  const zoomMeta = document.getElementById('zoomMeta');
  const zoomCountdown = document.getElementById('zoomCountdown');
  const zoomNote = document.getElementById('zoomNote');
  const zoomClose = document.getElementById('zoomClose');

  let currentId = null;
  let syncTimer = null;

  function openZoomFromCard(card) {
    // Không mở zoom khi đang mở modal Add/Edit
    if (editModal && !editModal.classList.contains('hidden')) return;

    // Không mở zoom nếu bấm vào nút Sửa/Xóa, input...
    // (đã chặn ở handler click, vẫn giữ thêm lớp bảo vệ)
    const titleEl = card.querySelector('.card-title, h3');
    const metaEl = card.querySelector('.card-meta .date, .meta .small');
    const noteEl = card.querySelector('.help');

    // Lấy id countdown: id="t_<eventId>"
    const srcCountdown = card.querySelector('[id^="t_"]');
    currentId = srcCountdown?.id?.startsWith('t_') ? srcCountdown.id.slice(2) : null;

    zoomTitle.textContent = titleEl ? titleEl.textContent.trim() : 'Sự kiện';
    zoomMeta.innerHTML = metaEl ? metaEl.innerHTML : '';

    if (noteEl && noteEl.textContent.trim()) {
      zoomNote.textContent = noteEl.textContent.trim();
      zoomNote.style.display = 'block';
    } else {
      zoomNote.style.display = 'none';
    }

    zoom.classList.remove('hidden');
    document.body.classList.add('zoom-open');

    syncCountdown();
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(syncCountdown, 500);

    zoomClose?.focus();
  }

  function syncCountdown() {
    if (!currentId) { zoomCountdown.innerHTML = ''; return; }
    const src = document.getElementById('t_' + currentId);
    if (src) zoomCountdown.innerHTML = src.innerHTML; // luôn khớp với countdown đang chạy
  }

  function closeZoom() {
    zoom.classList.add('hidden');
    document.body.classList.remove('zoom-open');
    currentId = null;
    zoomCountdown.innerHTML = '';
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  // Tap bất kỳ card nào để phóng to
  list?.addEventListener('click', (e) => {
    // Không kích hoạt khi click vào các nút hành động/inputs
    if (e.target.closest('button, a, input, select, textarea, .link-btn, .btn')) return;

    const card = e.target.closest('.card');
    if (!card) return;
    openZoomFromCard(card);
  });

  zoomClose?.addEventListener('click', closeZoom);
  zoom?.querySelector('.zoom-backdrop')?.addEventListener('click', closeZoom);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !zoom.classList.contains('hidden')) closeZoom();
  });

  // Xoay ngang: sync lại cho chắc (iOS đôi khi cần)
  window.addEventListener('orientationchange', () => setTimeout(syncCountdown, 250));
})();

const DEFAULT_EVENTS = [
  { id: 'ny', name: "Tết Nguyên Đán 2026", date: "2026-02-17T00:00:00.000Z", repeat: 'lunar', note: "Tự động tính theo Âm lịch" },
  { id: 'newyear', name: "Tết Dương Lịch", date: "2026-01-01T00:00:00.000Z", repeat: 'yearly' },
  { id: 'womenday', name: "Quốc tế Phụ nữ", date: "2026-03-08T00:00:00.000Z", repeat: 'yearly' },
  { id: 'reunify', name: "Ngày Giải phóng miền Nam / 30-4", date: "2026-04-30T00:00:00.000Z", repeat: 'yearly' },
  { id: 'labor', name: "Quốc tế Lao động / 1-5", date: "2026-05-01T00:00:00.000Z", repeat: 'yearly' },
  { id: 'natday', name: "Quốc khánh / 2-9", date: "2026-09-02T00:00:00.000Z", repeat: 'yearly' }
];

const STORAGE_KEY = 'vn_countdown_events_v2';
const STORAGE_OPTS_KEY = 'vn_countdown_opts';
let events = [];
let intervalRef = null;
let searchTerm = '';
let showLunar = false;

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

    // Load options
    const opts = localStorage.getItem(STORAGE_OPTS_KEY);
    if (opts) {
      const parsedOpts = JSON.parse(opts);
      showLunar = !!parsedOpts.showLunar;
    }
  } catch (e) { events = DEFAULT_EVENTS; save(); }

  ensureIds();
  populatePreset();
  attachUI();
  renderAll();
  startTimer();
  setInterval(updateHeaderClock, 1000);
  updateHeaderClock();
}

function ensureIds() {
  events.forEach((e, idx) => { if (!e.id) e.id = 'ev_' + Date.now() + '_' + idx; });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function attachUI() {
  document.getElementById('btnAdd').addEventListener('click', () => openModal({}));
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveFromModal);
  document.getElementById('btnExport').addEventListener('click', exportJSON);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', (e) => { if (e.target.files.length) importJSONFile(e.target.files[0]); });

  const lunarToggle = document.getElementById('showLunarToggle');
  if (lunarToggle) {
    lunarToggle.checked = showLunar;
    lunarToggle.addEventListener('change', (e) => {
      showLunar = e.target.checked;
      localStorage.setItem(STORAGE_OPTS_KEY, JSON.stringify({ showLunar }));
      renderAll();
    });
  }

  document.getElementById('xBtn').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // Toggle Custom Days input
  const repeatSel = document.getElementById('evRepeat');
  const divCustom = document.getElementById('divCustomDays');
  repeatSel.addEventListener('change', () => {
    if (repeatSel.value === 'custom_days') divCustom.classList.remove('hidden');
    else divCustom.classList.add('hidden');
  });

  const search = document.getElementById('searchInput');
  search.addEventListener('input', () => {
    searchTerm = (search.value || '').trim().toLowerCase();
    renderAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function populatePreset() {
  const sel = document.getElementById('presetSelect');
  sel.innerHTML = '<option value="">Thêm nhanh ngày lễ…</option>';

  const presets = [
    { name: 'Tết Nguyên Đán', repeat: 'lunar', date: '2024-02-10T00:00:00' }, // Mốc Giáp Thìn
    { name: 'Tết Dương Lịch — 01/01', repeat: 'yearly', date: '2026-01-01T00:00:00' },
    { name: 'Quốc tế Phụ nữ — 08/03', repeat: 'yearly', date: '2026-03-08T00:00:00' },
    { name: '30/4 — Giải phóng', repeat: 'yearly', date: '2026-04-30T00:00:00' },
    { name: '01/05 — Lao động', repeat: 'yearly', date: '2026-05-01T00:00:00' },
    { name: '02/09 — Quốc khánh', repeat: 'yearly', date: '2026-09-02T00:00:00' }
  ];

  presets.forEach(p => {
    const o = document.createElement('option');
    o.value = JSON.stringify(p);
    o.textContent = p.name;
    sel.appendChild(o);
  });

  sel.onchange = () => {
    if (!sel.value) return;
    try {
      const p = JSON.parse(sel.value);
      // Nếu là ngày cụ thể (yearly), chỉnh lại năm cho hợp lý (next occurrence)
      let d = new Date(p.date);
      if (p.repeat === 'yearly') {
        const now = new Date();
        d.setFullYear(now.getFullYear());
        if (d < now) d.setFullYear(now.getFullYear() + 1);
      }
      openModal({ name: p.name, date: toLocalInput(d), repeat: p.repeat });
    } catch (e) { }
    sel.selectedIndex = 0;
  };
}

function renderAll() {
  const list = document.getElementById('list');
  list.innerHTML = '';

  const filtered = events.filter(ev => {
    if (!searchTerm) return true;
    return (ev.name || '').toLowerCase().includes(searchTerm);
  });

  filtered.sort((a, b) => getCountdownTarget(a).getTime() - getCountdownTarget(b).getTime());

  filtered.forEach(ev => {
    const card = document.createElement('article');
    card.className = 'card';

    const head = document.createElement('div');
    head.className = 'card-head';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = ev.name || 'Untitled';

    const badge = document.createElement('div');
    badge.className = 'badge';
    let label = 'Một lần';
    if (ev.repeat === 'yearly') label = 'Hàng năm';
    else if (ev.repeat === 'monthly') label = 'Hàng tháng';
    else if (ev.repeat === 'weekly') label = 'Hàng tuần';
    else if (ev.repeat === 'lunar') label = 'Âm lịch';
    else if (ev.repeat === 'custom_days') label = `Mỗi ${ev.repeatDays} ngày`;
    else if (ev.yearly) label = 'Hàng năm'; // fallback
    badge.textContent = label;

    head.appendChild(title);
    head.appendChild(badge);

    const countdown = document.createElement('div');
    countdown.className = 'countdown';
    countdown.id = 't_' + ev.id;
    countdown.innerHTML = renderCountdownHTML(getCountdownParts(getCountdownTarget(ev).getTime() - Date.now()));

    card.appendChild(head);
    card.appendChild(countdown);

    if (ev.note) {
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

    if (showLunar && window.LunarCalendar) {
      const target = getCountdownTarget(ev);
      const solar = new window.LunarCalendar.SolarDate(target);
      const lunar = solar.toLunarDate();
      const lunarDiv = document.createElement('div');
      lunarDiv.className = 'lunar-sub';
      lunarDiv.style.opacity = '0.75';
      lunarDiv.style.fontSize = '0.9em';
      lunarDiv.textContent = `Âm lịch: ${lunar.day}/${lunar.month} ${lunar.getYearName()}`;
      dateText.appendChild(lunarDiv);
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const edit = document.createElement('button');
    edit.className = 'link-btn';
    edit.textContent = 'Sửa';
    edit.onclick = () => editEvent(ev.id);

    const del = document.createElement('button');
    del.className = 'link-btn danger';
    del.textContent = 'Xóa';
    del.onclick = () => removeEvent(ev.id);

    actions.appendChild(edit);
    actions.appendChild(del);

    meta.appendChild(dateText);
    meta.appendChild(actions);

    card.appendChild(meta);
    list.appendChild(card);
  });

  if (filtered.length === 0) {
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

function getCountdownTarget(ev) {
  if (!ev.date) return new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
  let d = new Date(ev.date);
  const now = new Date();

  // Backward compatibility
  const repeat = ev.repeat || (ev.yearly ? 'yearly' : 'none');

  if (repeat === 'none') {
    return d;
  }

  if (repeat === 'yearly') {
    const candidate = new Date(d);
    candidate.setFullYear(now.getFullYear());
    if (candidate <= now) candidate.setFullYear(now.getFullYear() + 1);
    return candidate;
  }

  if (repeat === 'monthly') {
    // Jump to current month
    const candidate = new Date(d);
    candidate.setFullYear(now.getFullYear());
    candidate.setMonth(now.getMonth());
    // Safe date check (e.g. 31st) -> JS automatically rolls over if invalid, which is acceptable behavior for "monthly" usually,
    // OR we can clamp. Let's stick to standard behavior: 31 Jan + 1 month -> 3 March (non-leap) or 2 March.
    // Actually, user expects "same day". If today is 15th, target 10th -> next month 10th.
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  if (repeat === 'weekly') {
    const candidate = new Date(d);
    // Calculate difference in weeks
    const diffMs = now.getTime() - candidate.getTime();
    if (diffMs > 0) {
      const weeks = Math.floor(diffMs / (7 * 86400000));
      candidate.setTime(candidate.getTime() + (weeks * 7 * 86400000));
      if (candidate <= now) candidate.setTime(candidate.getTime() + (7 * 86400000));
    }
    return candidate;
  }

  if (repeat === 'custom_days' && ev.repeatDays > 0) {
    const interval = ev.repeatDays * 86400000;
    const diff = now.getTime() - d.getTime();
    if (diff > 0) {
      const steps = Math.floor(diff / interval);
      const candidate = new Date(d.getTime() + steps * interval);
      if (candidate <= now) {
        return new Date(candidate.getTime() + interval);
      }
      return candidate;
    }
    return d;
  }

  if (repeat === 'lunar' && window.LunarCalendar) {
    // Convert source solar date to lunar
    try {
      const { SolarDate, LunarDate } = window.LunarCalendar;
      const solarSrc = new SolarDate(d);
      const lunarSrc = solarSrc.toLunarDate(); // { day, month, leap_month, ... }

      // Check current lunar year and next
      const nowSolar = new SolarDate(now);
      const nowLunar = nowSolar.toLunarDate();

      const checkYears = [nowLunar.year, nowLunar.year + 1];

      for (const y of checkYears) {
        // Construct target lunar date for this year
        // finding the month in that year
        const yearCode = LunarDate.getYearCode(y);
        const lunarMonths = LunarDate.decodeLunarYear(y, yearCode);

        // Find matching month
        let targetMonth = lunarMonths.find(m =>
          m.month === lunarSrc.month &&
          m.leap_month === lunarSrc.leap_month
        );

        // If exact match (including leap) not found, fallback to non-leap or first occurrence
        if (!targetMonth && lunarSrc.leap_month) {
          // Updated fallback: try same month non-leap
          targetMonth = lunarMonths.find(m => m.month === lunarSrc.month && !m.leap_month);
        }

        if (targetMonth) {
          const daysInMonth = targetMonth.length; // length property from library
          const targetDay = Math.min(lunarSrc.day, daysInMonth); // clamp

          const jd = targetMonth.jd + targetDay - 1;
          const targetSolar = SolarDate.fromJd(jd).toDate();

          // Allow for today if hours allow, but simplest is > now
          if (targetSolar > now) return targetSolar;
        }
      }
    } catch (e) { console.error('Lunar calc error', e); }
    // Fallback if error or not found
    return d;
  }

  return d;
}

function getCountdownParts(ms) {
  if (ms <= 0) return { state: 'live' };

  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  return { state: 'running', days, hours, mins, secs };
}

function renderCountdownHTML(parts) {
  if (parts.state === 'live') return `<div class="live">Đang diễn ra!</div>`;
  return `
    <div class="cd-box"><div class="cd-num">${parts.days}</div><div class="cd-lbl">ngày</div></div>
    <div class="cd-box"><div class="cd-num">${pad(parts.hours)}</div><div class="cd-lbl">giờ</div></div>
    <div class="cd-box"><div class="cd-num">${pad(parts.mins)}</div><div class="cd-lbl">phút</div></div>
    <div class="cd-box"><div class="cd-num">${pad(parts.secs)}</div><div class="cd-lbl">giây</div></div>
  `;
}

function pad(n) { return String(n).padStart(2, '0'); }

function startTimer() {
  if (intervalRef) clearInterval(intervalRef);

  intervalRef = setInterval(() => {
    const now = Date.now();

    let shouldTick = false;

    for (const ev of events) {
      try {
        const el = document.getElementById('t_' + ev.id);

        // QUAN TRỌNG: thiếu element thì bỏ qua event đó, KHÔNG return
        if (!el) continue;

        const diff = getCountdownTarget(ev).getTime() - now;
        const parts = getCountdownParts(diff);
        el.innerHTML = renderCountdownHTML(parts);

        // Check for ticking sound condition (0 < remaining <= 15s)
        if (diff > 0 && diff <= 15000) {
          shouldTick = true;
        }

        // an toàn: chỉ gọi nếu Effects tồn tại
        if (window.Effects && typeof window.Effects.maybeCelebrate === "function") {
          window.Effects.maybeCelebrate(ev, now, {
            soundUrl: "assets/sfx/celebrate.wav",
            volume: 0.9,
            onCelebrate: (eventId) => {
              // Add celebration class to the card
              const card = document.getElementById('t_' + eventId)?.closest('.card');
              if (card) {
                card.classList.add('celebrating');
                // Optional: remove after 10s
                setTimeout(() => card.classList.remove('celebrating'), 10000);
              }
            }
          });
        }
      } catch (err) {
        console.warn("Update countdown error:", ev?.name, err);
        // không làm gì thêm để các card khác vẫn chạy
      }
    }

    // Play tick if at least one event is in the final minute
    if (shouldTick && window.Effects && typeof window.Effects.playTick === "function") {
      window.Effects.playTick();
    }
  }, 1000);
}

function formatDateLabel(ev) {
  if (!ev.date) return 'Chưa có ngày dương lịch';

  const target = getCountdownTarget(ev);
  const opt = { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
  try {
    return 'Mốc: ' + target.toLocaleString('vi-VN', opt);
  } catch (e) {
    return 'Mốc: ' + target.toLocaleString();
  }
}

function removeEvent(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  if (!confirm(`Bạn có muốn xóa: "${ev.name}"?`)) return;
  events = events.filter(e => e.id !== id);
  save();
  renderAll();
}

function editEvent(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  openModal(ev);
}

function openModal(ev) {
  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');

  document.getElementById('evName').value = ev.name || '';
  document.getElementById('evDate').value = ev.date ? toLocalInput(new Date(ev.date)) : (ev.date || '');

  // Repetition
  const repeat = ev.repeat || (ev.yearly ? 'yearly' : 'none');
  const repeatSel = document.getElementById('evRepeat');
  repeatSel.value = repeat;

  // Custom days
  const divCustom = document.getElementById('divCustomDays');
  const inpCustom = document.getElementById('evCustomDays');
  inpCustom.value = ev.repeatDays || 100;

  if (repeat === 'custom_days') divCustom.classList.remove('hidden');
  else divCustom.classList.add('hidden');

  modal.dataset.editId = ev.id || '';
  setTimeout(() => document.getElementById('evName').focus(), 30);
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  modal.dataset.editId = '';
}

function toLocalInput(date) {
  const pad2 = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function saveFromModal() {
  const modal = document.getElementById('modal');
  const id = modal.dataset.editId || '';
  const name = (document.getElementById('evName').value || '').trim() || 'Untitled';
  const datev = document.getElementById('evDate').value;
  const repeat = document.getElementById('evRepeat').value;
  let repeatDays = parseInt(document.getElementById('evCustomDays').value);

  if (repeat === 'custom_days' && (!repeatDays || repeatDays <= 0)) {
    alert('Vui lòng nhập số ngày lặp lại hợp lệ (> 0).');
    return;
  }

  if (!datev) {
    if (!confirm('Bạn chưa chọn ngày dương lịch. Lưu không có ngày?')) return;
  }

  const iso = datev ? new Date(datev).toISOString() : '';

  const newEv = {
    id: id || 'ev_' + Date.now(),
    name,
    date: iso,
    repeat,
    repeatDays: repeat === 'custom_days' ? repeatDays : undefined,
    yearly: undefined // Clean up old field if exists
  };

  if (id) {
    events = events.map(e => e.id === id ? newEv : e);
  } else {
    events.push(newEv);
  }

  save();
  renderAll();
  closeModal();
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vn-holidays-countdown.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error('Định dạng JSON phải là mảng (array).');

      parsed.forEach((p, idx) => {
        if (!p.id) p.id = 'ev_imp_' + Date.now() + '_' + idx;
        if (typeof p.name !== 'string') p.name = String(p.name || 'Untitled');
        if (typeof p.repeat !== 'string') {
          // Migration
          p.repeat = p.yearly ? 'yearly' : 'none';
        }
        delete p.yearly; // cleanup
        if (typeof p.date !== 'string') p.date = '';
      });

      events = parsed;
      save();
      renderAll();
      alert('Đã nhập ' + parsed.length + ' mục.');
    } catch (err) {
      alert('Lỗi khi nhập JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', load);

function updateHeaderClock() {
  const now = new Date();
  const solarEl = document.getElementById('solarClock');
  const lunarEl = document.getElementById('lunarDate');

  if (solarEl) {
    // Format: "Thứ Sáu, 09/01/2026 - 15:30:45"
    const time = now.toLocaleTimeString('vi-VN', { hour12: false });
    const date = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    solarEl.textContent = `${date} • ${time}`;
  }

  if (lunarEl && window.LunarCalendar && window.LunarCalendar.SolarDate) {
    try {
      const solar = new window.LunarCalendar.SolarDate(now);
      const lunar = solar.toLunarDate();
      // Format: "21/11 Ất Tỵ (Tháng Chạp)"
      const dayName = lunar.getDayName(); // Can Chi ngày
      const monthName = lunar.getMonthName(); // Can chi tháng
      lunarEl.textContent = `${lunar.day}/${lunar.month}/${lunar.year} ${lunar.getYearName()}`;
    } catch (e) { console.error(e); }
  }
}
