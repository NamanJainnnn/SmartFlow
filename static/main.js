/* ─── SmartFlow Main JS ─── */

const fileInput    = document.getElementById('fileInput');
const dropZone     = document.getElementById('dropZone');
const previewWrap  = document.getElementById('previewWrap');
const previewImg   = document.getElementById('previewImg');
const previewMeta  = document.getElementById('previewMeta');
const analyzeBtn   = document.getElementById('analyzeBtn');
const clearBtn     = document.getElementById('clearBtn');
const uploadSection  = document.getElementById('uploadSection');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultsSection = document.getElementById('resultsSection');

let selectedFile = null;

// ─── Drag & Drop ───
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ─── File Input ───
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(file.type)) {
    showToast('Please upload a JPG or PNG image.', 'error');
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    previewMeta.textContent = `${file.name}  ·  ${(file.size / 1024).toFixed(1)} KB  ·  ${file.type}`;
    dropZone.style.display = 'none';
    previewWrap.style.display = 'block';
    analyzeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

// ─── Clear ───
clearBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  previewImg.src = '';
  dropZone.style.display = 'block';
  previewWrap.style.display = 'none';
  analyzeBtn.disabled = true;
});

// ─── Analyze ───
analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Show loading
  uploadSection.style.display = 'none';
  loadingOverlay.style.display = 'block';
  resultsSection.style.display = 'none';

  const formData = new FormData();
  formData.append('image', selectedFile);

  try {
    const res = await fetch('/analyze', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Server error');
    }

    // Small artificial delay for polish
    await delay(900);

    loadingOverlay.style.display = 'none';
    displayResults(data);

  } catch (err) {
    loadingOverlay.style.display = 'none';
    uploadSection.style.display = 'block';
    showToast('Error: ' + err.message, 'error');
  }
});

// ─── Reset ───
document.getElementById('resetBtn').addEventListener('click', () => {
  resultsSection.style.display = 'none';
  clearBtn.click();
  uploadSection.style.display = 'block';
});

// ─── Display Results ───
function displayResults(d) {
  resultsSection.style.display = 'block';

  // Method badge
  document.getElementById('methodBadge').textContent = d.detection_method;

  // Count
  animateNumber(document.getElementById('statVehicles'), 0, d.vehicle_count, 900);

  // Congestion
  const congEl = document.getElementById('statCongestion');
  congEl.textContent = d.congestion_level;
  congEl.style.color = d.congestion_color;

  // Bar width
  const barPct = d.congestion_level === 'Low' ? 30 : d.congestion_level === 'Medium' ? 65 : 100;
  const bar = document.getElementById('statBar');
  bar.style.background = d.congestion_color;
  setTimeout(() => { bar.style.width = barPct + '%'; }, 100);

  // Confidence
  const confEl = document.getElementById('statConfidence');
  animateNumber(confEl, 0, d.confidence, 900, '%');

  // Recommendation card
const recommendations = {
  Low:    { icon: '✦', action: 'Short Green Phase',    detail: 'Light traffic detected\nStandard cycle is sufficient' },
  Medium: { icon: '◈', action: 'Standard Green Phase', detail: 'Moderate flow detected\nMaintain regular signal timing' },
  High:   { icon: '▲', action: 'Extend Green Phase',   detail: 'Heavy congestion detected\nIncrease green duration to clear vehicles' }
};
const rec = recommendations[d.congestion_level];
const card = document.getElementById('recommendationCard');
document.getElementById('recIcon').textContent = rec.icon;
const recActionEl = document.getElementById('recAction');
recActionEl.textContent = rec.action;
recActionEl.style.color = d.congestion_color;
document.getElementById('recDetail').textContent = rec.detail;
card.style.borderColor = d.congestion_color + '66';

  // Timer value
  animateNumber(document.getElementById('timerValue'), 0, d.signal_timer, 1000);

  // Ring fill: circumference = 2πr = 2 * π * 52 ≈ 326.7
  const circ = 326.7;
  const maxTimer = 70; // max possible timer
  const fillPct = d.signal_timer / maxTimer;
  const offset = circ - (circ * fillPct);
  const ring = document.getElementById('ringFill');
  ring.style.stroke = d.congestion_color;
  setTimeout(() => { ring.style.strokeDashoffset = offset; }, 200);

  // Timer note
  const notes = {
    Low: 'Short green phase — light traffic',
    Medium: 'Standard green phase — moderate flow',
    High: 'Extended green phase — clear congestion'
  };
  document.getElementById('timerNote').textContent = notes[d.congestion_level];
}

// ─── Helpers ───
function animateNumber(el, from, to, duration, suffix = '') {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    el.textContent = (Number.isInteger(to) ? Math.round(current) : current.toFixed(1)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${type === 'error' ? '#450a0a' : '#0c1a2e'};
    border:1px solid ${type === 'error' ? '#7f1d1d' : '#1d3a6e'};
    color:#e8edf5; padding:12px 24px; border-radius:12px;
    font-family:'Syne',sans-serif; font-size:14px;
    z-index:9999; box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation:fadeUp 0.3s ease both;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
