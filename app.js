// ===== STATE =====
const STORAGE_KEY = 'writing_seeds_v1';
const API_KEY_STORAGE = 'writing_seeds_api_key';
let seeds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentSeedId = null;
let recognition = null;
let isRecording = false;

// ===== ELEMENTS =====
const $ = id => document.getElementById(id);
const thoughtInput = $('thoughtInput');
const micBtn = $('micBtn');
const voiceStatus = $('voiceStatus');
const saveBtn = $('saveBtn');
const seedsList = $('seedsList');
const seedsCount = $('seedsCount');
const detailModal = $('detailModal');
const settingsModal = $('settingsModal');
const toast = $('toast');

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === view + 'View');
    });
    if (view === 'list') renderList();
  });
});

// ===== INPUT & SAVE =====
thoughtInput.addEventListener('input', () => {
  saveBtn.disabled = thoughtInput.value.trim().length === 0;
});

saveBtn.addEventListener('click', () => {
  const text = thoughtInput.value.trim();
  if (!text) return;
  const seed = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    createdAt: new Date().toISOString(),
    expansion: null
  };
  seeds.unshift(seed);
  persist();
  thoughtInput.value = '';
  saveBtn.disabled = true;
  showToast('씨앗을 심었습니다 · 種');
});

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
}

// ===== SPEECH RECOGNITION =====
function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    voiceStatus.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다';
    micBtn.style.opacity = '0.3';
    micBtn.disabled = true;
    return;
  }
  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = '';
  let startingText = '';

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    voiceStatus.textContent = '듣고 있습니다…';
    startingText = thoughtInput.value;
    finalTranscript = '';
  };

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    const separator = startingText && !startingText.endsWith(' ') && !startingText.endsWith('\n') ? ' ' : '';
    thoughtInput.value = startingText + separator + finalTranscript + interim;
    saveBtn.disabled = thoughtInput.value.trim().length === 0;
  };

  recognition.onerror = (e) => {
    voiceStatus.textContent = `오류: ${e.error}`;
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
      // unexpected end during active recording; restart unless user stopped
      try { recognition.start(); } catch(e) { stopRecording(); }
    }
  };
}

micBtn.addEventListener('click', () => {
  if (!recognition) { initSpeech(); if (!recognition) return; }
  if (isRecording) stopRecording();
  else startRecording();
});

function startRecording() {
  try {
    recognition.start();
  } catch(e) {
    voiceStatus.textContent = '잠시 후 다시 시도해주세요';
  }
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove('recording');
  voiceStatus.textContent = '탭하여 음성으로 받아쓰기';
  try { recognition.stop(); } catch(e) {}
}

initSpeech();

// ===== LIST RENDER =====
function renderList() {
  if (seeds.length === 0) {
    seedsCount.textContent = '';
    seedsList.innerHTML = `
      <div class="empty">
        <div class="empty-char">空</div>
        <div>아직 심어둔 씨앗이 없습니다.</div>
      </div>`;
    return;
  }
  seedsCount.textContent = `— ${seeds.length} ${seeds.length === 1 ? 'seed' : 'seeds'} —`;
  seedsList.innerHTML = seeds.map(s => `
    <div class="seed" data-id="${s.id}">
      <div class="seed-text">${escapeHtml(s.text)}</div>
      <div class="seed-meta">
        <span>${formatDate(s.createdAt)}</span>
        ${s.expansion ? '<span class="seed-tag">확장됨</span>' : ''}
      </div>
    </div>
  `).join('');
  seedsList.querySelectorAll('.seed').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}.${m}.${day}`;
}

// ===== DETAIL MODAL =====
function openDetail(id) {
  const seed = seeds.find(s => s.id === id);
  if (!seed) return;
  currentSeedId = id;
  $('modalDate').textContent = new Date(seed.createdAt).toLocaleString('ko-KR');
  $('modalText').textContent = seed.text;
  renderExpansion(seed);
  detailModal.classList.add('active');
}

function renderExpansion(seed) {
  const container = $('expansionContainer');
  if (seed.expansion) {
    container.innerHTML = `
      <div class="expansion">
        <div class="expansion-label">CLAUDE의 확장 ◆</div>
        <div class="expansion-content">${escapeHtml(seed.expansion)}</div>
      </div>`;
    $('expandBtn').textContent = '다시 확장하기';
  } else {
    container.innerHTML = '';
    $('expandBtn').textContent = 'Claude로 아이디어 확장하기';
  }
}

function closeModal(modal) { modal.classList.remove('active'); }

detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) closeModal(detailModal);
});

$('copyBtn').addEventListener('click', async () => {
  const seed = seeds.find(s => s.id === currentSeedId);
  if (!seed) return;
  const text = seed.expansion ? `${seed.text}\n\n— 확장 —\n${seed.expansion}` : seed.text;
  await navigator.clipboard.writeText(text);
  showToast('복사되었습니다');
});

$('deleteBtn').addEventListener('click', () => {
  if (!confirm('이 씨앗을 정말 버리시겠습니까?')) return;
  seeds = seeds.filter(s => s.id !== currentSeedId);
  persist();
  closeModal(detailModal);
  renderList();
  showToast('씨앗을 버렸습니다');
});

// ===== EXPANSION (Claude API) =====
$('expandBtn').addEventListener('click', async () => {
  const apiKey = localStorage.getItem(API_KEY_STORAGE);
  if (!apiKey) {
    showToast('먼저 설정에서 API 키를 등록해주세요');
    closeModal(detailModal);
    settingsModal.classList.add('active');
    return;
  }
  const seed = seeds.find(s => s.id === currentSeedId);
  if (!seed) return;

  const container = $('expansionContainer');
  container.innerHTML = `
    <div class="expansion">
      <div class="expansion-label">CLAUDE의 확장 ◆</div>
      <div class="expansion-content">
        생각의 가지를 펼치는 중 <span class="loading-dots"><span></span><span></span><span></span></span>
      </div>
    </div>`;
  $('expandBtn').disabled = true;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `다음은 글로 풀어내고 싶은 짧은 메모입니다. 이 메모를 글쓰기 주제로 발전시켜 주세요.

[메모]
${seed.text}

다음 구조로 정리해주세요:

◆ 핵심 주제
이 메모가 다루려는 본질이 무엇인지 한두 문장으로.

◆ 발전시킬 수 있는 각도 (3개)
이 주제를 어떤 시선으로 풀어낼 수 있을지 서로 다른 접근 방향을 제시.

◆ 던질 만한 질문들
글을 쓰며 스스로에게 던져볼 만한 질문 3-4가지.

◆ 첫 문장 제안
글을 시작할 만한 매력적인 첫 문장 1-2개.

차분하고 사려 깊은 어조로 한국어로 답해주세요.`
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.content.map(b => b.type === 'text' ? b.text : '').join('').trim();

    seed.expansion = text;
    persist();
    renderExpansion(seed);
    showToast('확장이 완료되었습니다');
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="expansion">
        <div class="expansion-label">오류 ◆</div>
        <div class="expansion-content">확장에 실패했습니다.\n${err.message}</div>
      </div>`;
    showToast('확장 실패: ' + err.message);
  } finally {
    $('expandBtn').disabled = false;
  }
});

// ===== SETTINGS =====
$('settingsBtn').addEventListener('click', () => {
  $('apiKeyInput').value = localStorage.getItem(API_KEY_STORAGE) || '';
  settingsModal.classList.add('active');
});

$('closeSettings').addEventListener('click', () => {
  const key = $('apiKeyInput').value.trim();
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
  closeModal(settingsModal);
  showToast('설정이 저장되었습니다');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeModal(settingsModal);
});

// ===== EXPORT / IMPORT =====
$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(seeds, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `writing-seeds-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('importBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('잘못된 형식');
    if (confirm(`${imported.length}개의 씨앗을 가져옵니다. 기존 데이터에 추가하시겠습니까? (취소 = 덮어쓰기)`)) {
      const existingIds = new Set(seeds.map(s => s.id));
      imported.forEach(s => { if (!existingIds.has(s.id)) seeds.push(s); });
    } else {
      seeds = imported;
    }
    seeds.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    persist();
    showToast('가져오기 완료');
    renderList();
  } catch (err) {
    showToast('가져오기 실패: ' + err.message);
  }
  e.target.value = '';
});

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// initial render
renderList();
