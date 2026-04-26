import { subscribeToData, saveSwimData, saveHypeReel } from './firebase.js';
import { ocrHeatSheet, generateHypeText, generateVoice } from './api.js';

// ── Constants ─────────────────────────────────────────────
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George — deep, authoritative

const EVENTS = [
  '25 Free','50 Free','100 Free','200 Free','400 Free',
  '25 Back','50 Back','100 Back',
  '25 Breast','50 Breast','100 Breast',
  '25 Fly','50 Fly','100 Fly',
  '100 IM','200 IM'
];

const DEMO_DATA = {
  everleigh: {
    meets: [
      { id:1, name:'Brushy Creek Invitational', date:'2025-06-07',
        events:[{event:'25 Free',time:'18.42',place:'3rd'},{event:'25 Back',time:'22.15',place:'2nd'},{event:'100 IM',time:'1:42.30',place:'3rd'}] },
      { id:2, name:'Round Rock City Meet', date:'2025-06-21',
        events:[{event:'25 Free',time:'17.88',place:'2nd'},{event:'25 Back',time:'21.40',place:'2nd'},{event:'25 Breast',time:'24.92',place:'3rd'},{event:'100 IM',time:'1:39.05',place:'2nd'}] },
      { id:3, name:'Westwood Summer Classic', date:'2025-07-12',
        events:[{event:'25 Free',time:'17.21',place:'1st'},{event:'25 Back',time:'20.85',place:'1st'},{event:'25 Breast',time:'24.10',place:'2nd'},{event:'100 IM',time:'1:36.42',place:'2nd'}] },
      { id:4, name:'Champs — Division Finals', date:'2025-07-26',
        events:[{event:'25 Free',time:'16.78',place:'1st'},{event:'25 Back',time:'20.12',place:'1st'},{event:'25 Breast',time:'23.45',place:'1st'},{event:'100 IM',time:'1:34.18',place:'1st'}] }
    ]
  },
  penny: {
    meets: [
      { id:5, name:'Brushy Creek Invitational', date:'2025-06-07',
        events:[{event:'25 Free',time:'24.50',place:'3rd'},{event:'25 Back',time:'28.90',place:'3rd'}] },
      { id:6, name:'Round Rock City Meet', date:'2025-06-21',
        events:[{event:'25 Free',time:'23.10',place:'2nd'},{event:'25 Back',time:'27.55',place:'2nd'},{event:'25 Breast',time:'30.15',place:'3rd'}] },
      { id:7, name:'Westwood Summer Classic', date:'2025-07-12',
        events:[{event:'25 Free',time:'22.18',place:'2nd'},{event:'25 Back',time:'26.40',place:'1st'},{event:'25 Breast',time:'29.20',place:'2nd'}] },
      { id:8, name:'Champs — Division Finals', date:'2025-07-26',
        events:[{event:'25 Free',time:'21.55',place:'1st'},{event:'25 Back',time:'25.88',place:'1st'},{event:'25 Breast',time:'28.45',place:'1st'}] }
    ]
  }
};

// ── State ─────────────────────────────────────────────────
let appData        = JSON.parse(JSON.stringify(DEMO_DATA));
let currentSwimmer = 'everleigh';
let currentHype   = '';
let currentAudio  = null;

// ── Persistence ───────────────────────────────────────────
async function persist() {
  await saveSwimData(appData);
}

async function resetDemo() {
  appData = JSON.parse(JSON.stringify(DEMO_DATA));
  await persist();
  toast('Demo data reset 🔄');
}

// ── Swimmer Tabs ──────────────────────────────────────────
function setSwimmer(s) {
  currentSwimmer = s;
  document.documentElement.style.setProperty('--accent', s === 'everleigh' ? 'var(--ev-color)' : 'var(--pe-color)');
  document.getElementById('tabEv').className = 'tab' + (s === 'everleigh' ? ' ev-active' : '');
  document.getElementById('tabPe').className = 'tab' + (s === 'penny'     ? ' pe-active' : '');
  document.getElementById('hypeCard').style.display = 'none';
  currentHype = '';
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  render();
}

// ── Upload / OCR ──────────────────────────────────────────
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
}

async function processFile(file) {
  const proc = document.getElementById('processing');
  const note = document.getElementById('aiNote');
  proc.style.display = 'flex';
  note.style.display = 'none';

  try {
    const b64 = await toBase64(file);
    const mt  = file.type || 'image/jpeg';
    const who = currentSwimmer === 'everleigh' ? 'Everleigh (age 8)' : 'Penny (age 6)';
    const parsed = await ocrHeatSheet(b64, mt, who);
    proc.style.display = 'none';
    prefillForm(parsed);
    if (parsed.notes) { note.textContent = '🤖 ' + parsed.notes; note.style.display = 'block'; }
  } catch(err) {
    proc.style.display = 'none';
    note.textContent = '⚠️ Could not read image — fill in manually below.';
    note.style.display = 'block';
    prefillForm({ events: [] });
  }
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function prefillForm(p) {
  document.getElementById('meetForm').style.display = 'block';
  if (p.meetName) document.getElementById('meetName').value = p.meetName;
  if (p.date)     document.getElementById('meetDate').value  = p.date;
  document.getElementById('eventRows').innerHTML = '';
  if (p.events?.length) p.events.forEach(e => addRow(e.event, e.time));
  else addRow();
}

function addRow(ev = '', tm = '') {
  const opts = EVENTS.map(e => `<option value="${e}"${e === ev ? ' selected' : ''}>${e}</option>`).join('');
  const row  = document.createElement('div');
  row.className = 'event-row';
  row.innerHTML = `
    <select><option value="">Event…</option>${opts}</select>
    <input type="text" placeholder="Time" value="${tm}">
    <select><option>1st</option><option>2nd</option><option>3rd</option><option>DQ</option><option>—</option></select>
    <button class="remove-btn" onclick="this.closest('.event-row').remove()">×</button>`;
  document.getElementById('eventRows').appendChild(row);
}

async function saveMeet() {
  const name   = document.getElementById('meetName').value.trim() || 'Meet';
  const date   = document.getElementById('meetDate').value || new Date().toISOString().slice(0, 10);
  const events = [];

  document.querySelectorAll('.event-row').forEach(r => {
    const sels = r.querySelectorAll('select');
    const inp  = r.querySelector('input');
    if (sels[0].value && inp.value.trim())
      events.push({ event: sels[0].value, time: inp.value.trim(), place: sels[1].value });
  });

  if (!events.length) { toast('Add at least one event!'); return; }

  appData[currentSwimmer].meets.push({ id: Date.now(), name, date, events });
  appData[currentSwimmer].meets.sort((a, b) => a.date.localeCompare(b.date));
  await persist();

  document.getElementById('meetForm').style.display = 'none';
  document.getElementById('aiNote').style.display   = 'none';
  document.getElementById('fileInput').value        = '';
  document.getElementById('meetName').value         = '';
  toast('Meet saved 🏊');
  render();
}

async function deleteMeet(id) {
  appData[currentSwimmer].meets = appData[currentSwimmer].meets.filter(m => m.id !== id);
  await persist();
  render();
}

// ── Hype Reel ─────────────────────────────────────────────
async function genHype() {
  const meets = appData[currentSwimmer].meets;
  if (!meets.length) { toast('Add some meets first!'); return; }

  const btn  = document.getElementById('hypeBtn');
  const card = document.getElementById('hypeCard');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spin"></span> WRITING THE HYPE REEL...';
  card.style.display = 'none';

  const name = currentSwimmer === 'everleigh' ? 'Everleigh' : 'Penny';
  const age  = currentSwimmer === 'everleigh' ? 8 : 6;
  const summary = buildMeetSummary(meets);

  try {
    const txt = await generateHypeText(name, age, summary);
    currentHype = txt;
    saveHypeReel(currentSwimmer, txt); // push to Firebase so dashboard can play it
    document.getElementById('hypeName').textContent = name;
    document.getElementById('hypeBody').textContent = txt;
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e) {
    toast('Error: ' + (e.message || JSON.stringify(e)));
  }

  btn.disabled  = false;
  btn.innerHTML = '🎙 GENERATE HYPE REEL';
}

function buildMeetSummary(meets) {
  const em = {};
  meets.forEach(m => m.events.forEach(e => {
    if (!em[e.event]) em[e.event] = [];
    em[e.event].push({ time: e.time, date: m.date });
  }));
  const lines = [`Meets: ${meets.length}`];
  Object.entries(em).forEach(([ev, times]) => {
    const sorted = [...times].sort((a, b) => a.date.localeCompare(b.date));
    const best   = [...times].sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
    lines.push(sorted.length > 1
      ? `${ev}: ${sorted[0].time} → ${sorted.at(-1).time} (best: ${best.time})`
      : `${ev}: ${sorted[0].time}`);
  });
  return lines.join('\n');
}

async function playHype() {
  if (!currentHype) { toast('Generate the hype reel first!'); return; }

  const playBtn   = document.getElementById('playBtn');
  const status    = document.getElementById('audioStatus');
  const statusTxt = document.getElementById('audioStatusText');

  if (currentAudio) {
    currentAudio.pause(); currentAudio = null;
    playBtn.innerHTML = '▶ Play SportsCenter Read';
    status.classList.remove('show');
    return;
  }

  playBtn.disabled  = true;
  playBtn.innerHTML = '<span class="spin"></span> Loading voice...';
  status.classList.add('show');
  statusTxt.textContent = 'Generating voice with ElevenLabs...';

  try {
    const blob = await generateVoice(currentHype, VOICE_ID);
    const url  = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    statusTxt.textContent = '🎙 Now playing...';
    playBtn.disabled  = false;
    playBtn.innerHTML = '⏹ Stop';

    currentAudio.onended = () => {
      playBtn.innerHTML = '▶ Play SportsCenter Read';
      status.classList.remove('show');
      currentAudio = null;
    };
    currentAudio.play();
  } catch(err) {
    playBtn.disabled  = false;
    playBtn.innerHTML = '▶ Play SportsCenter Read';
    status.classList.remove('show');
    toast('Voice error: ' + err.message);
  }
}

function copyHype() {
  if (!currentHype) return;
  navigator.clipboard.writeText(currentHype).then(() => toast('Copied! 🎙'));
}

// ── Render ────────────────────────────────────────────────
function parseTime(t) {
  if (!t) return Infinity;
  t = t.toString().trim();
  if (t.includes(':')) {
    const [m, s] = t.split(':').map(Number);
    return m * 60 + s;
  }
  return parseFloat(t) || Infinity;
}

function fmtDate(d) {
  const [, m, day] = d.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + ' ' + parseInt(day);
}

function render() {
  const meets = appData[currentSwimmer].meets;
  const n     = currentSwimmer === 'everleigh' ? 'Everleigh' : 'Penny';

  document.getElementById('statsLabel').textContent = `${n} · Season Stats`;
  document.getElementById('meetsLabel').textContent = `${n} · Meets`;

  const ml = document.getElementById('meetsList');
  if (!meets.length) {
    ml.innerHTML = '<div class="empty"><span>🏊</span><p>No meets yet — upload a heat sheet to start!</p></div>';
    document.getElementById('statsWrap').style.display = 'none';
    return;
  }
  document.getElementById('statsWrap').style.display = 'block';

  ml.innerHTML = meets.map((m, i) => `
    <div class="meet-row">
      <div class="meet-idx">${String(i + 1).padStart(2, '0')}</div>
      <div class="meet-info">
        <div class="meet-name-text">${m.name}</div>
        <div class="meet-meta">${fmtDate(m.date)} · ${m.events.length} event${m.events.length !== 1 ? 's' : ''}</div>
      </div>
      <button class="del-btn" data-id="${m.id}">🗑</button>
    </div>`).join('');

  // Build event map
  const em = {};
  meets.forEach(m => m.events.forEach(e => {
    if (!em[e.event]) em[e.event] = [];
    em[e.event].push({ time: e.time, date: m.date });
  }));

  // Count PRs (events where the most recent entry is also the personal best)
  let prs = 0;
  Object.values(em).forEach(times => {
    if (times.length > 1) {
      const sorted = [...times].sort((a, b) => a.date.localeCompare(b.date));
      const best   = [...times].sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
      if (parseTime(sorted.at(-1).time) === parseTime(best.time)) prs++;
    }
  });

  document.getElementById('statRow').innerHTML = `
    <div class="stat-box"><div class="stat-num">${meets.length}</div><div class="stat-lbl">Meets</div></div>
    <div class="stat-box"><div class="stat-num">${Object.keys(em).length}</div><div class="stat-lbl">Events</div></div>
    <div class="stat-box"><div class="stat-num">${prs}</div><div class="stat-lbl">PRs</div></div>`;

  const accentVar = currentSwimmer === 'everleigh' ? 'var(--ev-color)' : 'var(--pe-color)';
  document.getElementById('eventCards').innerHTML = Object.entries(em).map(([ev, times]) => {
    const sorted   = [...times].sort((a, b) => a.date.localeCompare(b.date));
    const best     = [...times].sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
    const latestPR = sorted.length > 1 && parseTime(sorted.at(-1).time) === parseTime(best.time);

    const chips = sorted.map((t, i) => {
      const isPR = latestPR && i === sorted.length - 1;
      return `<div class="time-chip${isPR ? ' is-pr' : ''}" ${isPR ? `style="--accent:${accentVar}"` : ''}>
        <span class="tc-meet">Meet ${i + 1}</span>
        <span class="tc-val">${t.time}${isPR ? '<span class="pr-tag">PR</span>' : ''}</span>
      </div>${i < sorted.length - 1 ? '<span class="arrow">→</span>' : ''}`;
    }).join('');

    let improve = '';
    if (sorted.length > 1) {
      const diff = parseTime(sorted[0].time) - parseTime(sorted.at(-1).time);
      if (diff > 0) improve = `▼ ${diff.toFixed(2)}s faster`;
    }

    return `<div class="event-card">
      <div class="ec-header">
        <div class="ec-name">${ev}</div>
        ${improve ? `<div class="ec-improve">${improve}</div>` : ''}
      </div>
      <div class="time-trail">${chips}</div>
    </div>`;
  }).join('');
}


// ── Modal / Toast ─────────────────────────────────────────
function openSettings() {
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Event Listeners ───────────────────────────────────────
function setupListeners() {
  const uploadZone = document.getElementById('uploadZone');
  uploadZone.addEventListener('click', () => document.getElementById('fileInput').click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', handleDrop);

  document.getElementById('choosePhotoBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', e => {
    if (e.target.files[0]) processFile(e.target.files[0]);
  });

  document.getElementById('tabEv').addEventListener('click', () => setSwimmer('everleigh'));
  document.getElementById('tabPe').addEventListener('click', () => setSwimmer('penny'));

  document.getElementById('addRowBtn').addEventListener('click', () => addRow());
  document.getElementById('saveMeetBtn').addEventListener('click', saveMeet);
  document.getElementById('resetDemoBtn').addEventListener('click', resetDemo);

  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('modalCancel').addEventListener('click', closeSettings);

  document.getElementById('hypeBtn').addEventListener('click', genHype);
  document.getElementById('playBtn').addEventListener('click', playHype);
  document.getElementById('copyBtn').addEventListener('click', copyHype);

  // Event delegation for dynamically-rendered delete buttons
  document.getElementById('meetsList').addEventListener('click', e => {
    const btn = e.target.closest('.del-btn');
    if (btn) deleteMeet(Number(btn.dataset.id));
  });
}

// ── Service Worker ────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Init ──────────────────────────────────────────────────
function init() {
  setupListeners();
  registerSW();

  // subscribeToData fires immediately with current value, then on any remote change
  subscribeToData(data => {
    if (data) {
      appData = data;
    } else {
      // First-ever load — push demo data up to Firebase
      persist();
    }
    render();
  });

  setSwimmer('everleigh');
}

init();
