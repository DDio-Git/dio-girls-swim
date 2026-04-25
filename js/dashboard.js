import { subscribeToData, loadHypeReel } from './firebase.js';
import { generateVoice } from './api.js';

const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const KEY_EL   = 'dioElKey-v1';

let appData       = null;
let currentSwimmer = 'everleigh';
let currentHype   = '';
let currentAudio  = null;
let elKey         = localStorage.getItem(KEY_EL) || '';

// ── Data ─────────────────────────────────────────────────
subscribeToData(data => {
  document.getElementById('loadingState').style.display = 'none';
  if (!data) {
    document.getElementById('dashContent').innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:rgba(221,238,246,0.3);font-size:14px">Season data loading — check back soon 🏊</div>';
    document.getElementById('dashContent').style.display = 'block';
    return;
  }
  appData = data;
  document.getElementById('dashContent').style.display = 'block';
  render();
  loadHype();
});

async function loadHype() {
  currentHype = await loadHypeReel(currentSwimmer) || '';
  updateHypeUI();
}

// ── Swimmer ───────────────────────────────────────────────
function setSwimmer(s) {
  currentSwimmer = s;
  const isEv = s === 'everleigh';
  document.documentElement.style.setProperty('--accent', isEv ? 'var(--ev-color)' : 'var(--pe-color)');
  document.getElementById('tabEv').className = 'tab' + (isEv ? ' ev-active' : '');
  document.getElementById('tabPe').className = 'tab' + (!isEv ? ' pe-active' : '');
  document.getElementById('hypeSwimmerName').textContent = isEv ? 'Everleigh' : 'Penny';
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  updateHypeUI();
  if (appData) render();
  loadHype();
}

// ── Render ────────────────────────────────────────────────
function parseTime(t) {
  if (!t) return Infinity;
  t = t.toString().trim();
  if (t.includes(':')) { const [m, s] = t.split(':').map(Number); return m * 60 + s; }
  return parseFloat(t) || Infinity;
}

function fmtDate(d) {
  const [, m, day] = d.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + ' ' + parseInt(day);
}

function placeBadge(place) {
  const cls = place === '1st' ? 'gold' : place === '2nd' ? 'silver' : place === '3rd' ? 'bronze' : 'other';
  return `<span class="le-place ${cls}">${place}</span>`;
}

function render() {
  const meets = appData[currentSwimmer].meets;
  if (!meets.length) {
    document.getElementById('dashContent').style.display = 'none';
    return;
  }
  document.getElementById('dashContent').style.display = 'block';

  // ── Build event map ──
  const em = {};
  meets.forEach(m => m.events.forEach(e => {
    if (!em[e.event]) em[e.event] = [];
    em[e.event].push({ time: e.time, place: e.place, meet: m.name, date: m.date });
  }));

  // ── Stat row ──
  let prCount = 0;
  Object.values(em).forEach(times => {
    if (times.length > 1) {
      const sorted = [...times].sort((a, b) => a.date.localeCompare(b.date));
      const best   = [...times].sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];
      if (parseTime(sorted.at(-1).time) === parseTime(best.time)) prCount++;
    }
  });

  document.getElementById('statRow').innerHTML = `
    <div class="stat-box">
      <div class="stat-num">${meets.length}</div>
      <div class="stat-lbl">Meets</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${prCount}</div>
      <div class="stat-lbl">PRs</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${Object.keys(em).length}</div>
      <div class="stat-lbl">Events</div>
    </div>`;

  // ── Latest meet ──
  const latest = [...meets].sort((a, b) => b.date.localeCompare(a.date))[0];
  document.getElementById('latestCard').innerHTML = `
    <div class="latest-meet-name">${latest.name}</div>
    <div class="latest-meet-date">${fmtDate(latest.date)}</div>
    <div class="latest-events">
      ${latest.events.map(e => `
        <div class="latest-event-row">
          <span class="le-name">${e.event}</span>
          <div class="le-right">
            <span class="le-time">${e.time}</span>
            ${placeBadge(e.place)}
          </div>
        </div>`).join('')}
    </div>`;

  // ── Season bests ──
  document.getElementById('bestsList').innerHTML = Object.entries(em).map(([ev, times]) => {
    const sorted = [...times].sort((a, b) => a.date.localeCompare(b.date));
    const best   = [...times].sort((a, b) => parseTime(a.time) - parseTime(b.time))[0];

    let improveBadge = '<span class="best-improve none">First season</span>';
    if (sorted.length > 1) {
      const diff = parseTime(sorted[0].time) - parseTime(best.time);
      if (diff > 0) improveBadge = `<span class="best-improve">▼ ${diff.toFixed(2)}s faster</span>`;
    }

    return `<div class="best-card">
      <div class="best-left">
        <div class="best-event">${ev}</div>
        <div class="best-meta">Best at ${best.meet.split('—')[0].trim()}</div>
      </div>
      <div class="best-right">
        ${improveBadge}
        <div class="best-time">${best.time}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Hype Reel ─────────────────────────────────────────────
function updateHypeUI() {
  const playBtn = document.getElementById('hypePlayBtn');
  const noHype  = document.getElementById('noHype');
  if (currentHype) {
    playBtn.style.display = 'block';
    noHype.style.display  = 'none';
  } else {
    playBtn.style.display = 'none';
    noHype.style.display  = 'block';
  }
  if (currentAudio) {
    playBtn.textContent = '⏹ Stop';
    playBtn.classList.add('playing');
  } else {
    const name = currentSwimmer === 'everleigh' ? 'Everleigh' : 'Penny';
    playBtn.innerHTML = `▶ Play ${name}'s Hype Reel`;
    playBtn.classList.remove('playing');
  }
}

async function playHype() {
  if (!currentHype) return;

  if (currentAudio) {
    currentAudio.pause(); currentAudio = null;
    document.getElementById('audioStatus').classList.remove('show');
    updateHypeUI();
    return;
  }

  if (!elKey) { openSettings(); toast('Enter your ElevenLabs key first'); return; }

  const playBtn   = document.getElementById('hypePlayBtn');
  const status    = document.getElementById('audioStatus');
  const statusTxt = document.getElementById('audioStatusText');

  playBtn.disabled  = true;
  playBtn.innerHTML = '<span class="spin"></span> Loading voice...';
  status.classList.add('show');
  statusTxt.textContent = 'Generating voice...';

  try {
    const blob = await generateVoice(currentHype, elKey, VOICE_ID);
    const url  = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    statusTxt.textContent = '🎙 Now playing...';
    playBtn.disabled = false;
    updateHypeUI();

    currentAudio.onended = () => {
      currentAudio = null;
      status.classList.remove('show');
      updateHypeUI();
    };
    currentAudio.play();
  } catch(err) {
    playBtn.disabled = false;
    status.classList.remove('show');
    updateHypeUI();
    toast('Voice error: ' + err.message);
  }
}

// ── Settings ──────────────────────────────────────────────
function openSettings() {
  document.getElementById('elKeyInput').value = elKey || '';
  document.getElementById('settingsModal').classList.add('open');
}
function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}
function saveKey() {
  const val = document.getElementById('elKeyInput').value.trim();
  if (!val) { toast('Paste your key first'); return; }
  elKey = val;
  localStorage.setItem(KEY_EL, val);
  closeSettings();
  toast('Key saved ✓');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Init ──────────────────────────────────────────────────
document.getElementById('tabEv').addEventListener('click', () => setSwimmer('everleigh'));
document.getElementById('tabPe').addEventListener('click', () => setSwimmer('penny'));
document.getElementById('hypePlayBtn').addEventListener('click', playHype);
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('modalSave').addEventListener('click', saveKey);
document.getElementById('modalCancel').addEventListener('click', closeSettings);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
