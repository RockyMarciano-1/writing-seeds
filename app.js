// ===== STORAGE KEYS =====
const STORAGE_KEY = 'writing_seeds_v1';
const API_KEY_STORAGE = 'writing_seeds_api_key';
const GH_OWNER = 'writing_seeds_gh_owner';
const GH_REPO = 'writing_seeds_gh_repo';
const GH_PATH = 'writing_seeds_gh_path';
const GH_TOKEN = 'writing_seeds_gh_token';
const GH_SHA = 'writing_seeds_gh_sha'; // 파일의 마지막 SHA (커밋용)

// ===== STATE =====
let seeds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentSeedId = null;
let recognition = null;
let isRecording = false;
let pushTimer = null;

// ===== DOM =====
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
const syncBadge = $('syncBadge');
const syncText = $('syncText');

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === view + 'View'));
    if (view === 'list') renderList();
  });
});

// ===== LOCAL PERSIST =====
function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
}

// ===== GITHUB SYNC =====
function ghConfig() {
  return {
    owner: localStorage.getItem(GH_OWNER) || '',
    repo: localStorage.getItem(GH_REPO) || '',
    path: localStorage.getItem(GH_PATH) || 'seeds.json',
    token: localStorage.getItem(GH_TOKEN) || ''
  };
}

function isGhConfigured() {
  const c = ghConfig();
  return c.owner && c.repo && c.token;
}

function setSyncStatus(state, text) {
  syncBadge.classList.remove('synced', 'syncing', 'error');
  if (state) syncBadge.classList.add(state);
  syncText.textContent = text;
}

// UTF-8 안전 base64 인코딩 (한글 포함)
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

// GitHub에서 불러오기
async function pullFromGithub() {
  if (!isGhConfigured()) {
    showToast('먼저 설정에서 GitHub 정보를 입력해주세요');
    return false;
  }
  const { owner, repo, path, token } = ghConfig();
  setSyncStatus('syncing', '불러오는 중…');
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (res.status === 404) {
      // 파일 없음 → 빈 상태 유지, SHA 클리어
      localStorage.removeItem(GH_SHA);
      setSyncStatus('synced', 'GitHub (빈 파일)');
      showToast('GitHub에 아직 데이터 파일이 없습니다');
      return true;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    localStorage.setItem(GH_SHA, data.sha);
    const json = base64ToUtf8(data.content);
    const remote = JSON.parse(json);
    if (Array.isArray(remote)) {
      seeds = remote;
      persistLocal();
      renderList();
      setSyncStatus('synced', 'GitHub 동기화됨');
      showToast(`${remote.length}개의 씨앗을 불러왔습니다`);
    } else {
      throw new Error('파일 형식이 올바르지 않습니다');
    }
    return true;
  } catch (err) {
    console.error(err);
    setSyncStatus('error', '오류');
    showToast('불러오기 실패: ' + err.message);
    return false;
  }
}

// GitHub로 푸시
async function pushToGithub() {
  if (!isGhConfigured()) return false;
  const { owner, repo, path, token } = ghConfig();
  setSyncStatus('syncing', '동기화 중…');
  try {
    // 항상 최신 SHA를 먼저 가져온다 (충돌 회피)
    let sha = localStorage.getItem(GH_SHA);
    try {
      const head = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
      });
      if (head.ok) {
        const meta = await head.json();
        sha = meta.sha;
      } else if (head.status === 404) {
        sha = null; // 새 파일
      }
    } catch(_) { /* 네트워크 오류면 캐시된 SHA로 진행 */ }

    const content = utf8ToBase64(JSON.stringify(seeds, null, 2));
    const body = {
      message: `seeds: ${seeds.length} entries (${new Date().toISOString()})`,
      content
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }
    const result = await res.json();
    localStorage.setItem(GH_SHA, result.content.sha);
    setSyncStatus('synced', 'GitHub 동기화됨');
    return true;
  } catch (err) {
    console.error(err);
    setSyncStatus('error', '오류');
    showToast('동기화 실패: ' + err.message);
    return false;
  }
}

// 변경 후 자동 푸시 (디바운스)
function schedulePush() {
  if (!isGhConfigured()) {
    setSyncStatus('', '로컬');
    return;
  }
  setSyncStatus('syncing', '대기 중…');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushToGithub, 1500);
}

// ===== SAVE WORKFLOW =====
function persist() {
  persistLocal();
  schedulePush();
}

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

// ===== SPEECH =====
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
      if (e.results[i].isFinal) finalTranscript += transcript;
      else interim += transcript;
    }
    const sep = startingText && !startingText.endsWith(' ') && !startingText.endsWith('\n') ? ' ' : '';
    thoughtInput.value = startingText + sep + finalTranscript + interim;
    saveBtn.disabled = thoughtInput.value.trim().length === 0;
  };

  recognition.onerror = (e) => {
    voiceStatus.textContent = `오류: ${e.error}`;
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
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
  try { recognition.start(); }
  catch(e) { voiceStatus.textContent = '잠시 후 다시 시도해주세요'; }
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove('recording');
  voiceStatus.textContent = '탭하여 음성으로 받아쓰기';
  try { recognition.stop(); } catch(e) {}
}

initSpeech();

// ===== LIST =====
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
  const diff = (new Date() - d) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}.${m}.${day}`;
}

// ===== DETAIL =====
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

// ===== EXPANSION =====
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
  $('ghOwnerInput').value = localStorage.getItem(GH_OWNER) || '';
  $('ghRepoInput').value = localStorage.getItem(GH_REPO) || '';
  $('ghPathInput').value = localStorage.getItem(GH_PATH) || 'seeds.json';
  $('ghTokenInput').value = localStorage.getItem(GH_TOKEN) || '';
  settingsModal.classList.add('active');
});

$('closeSettings').addEventListener('click', async () => {
  const apiKey = $('apiKeyInput').value.trim();
  if (apiKey) localStorage.setItem(API_KEY_STORAGE, apiKey);
  else localStorage.removeItem(API_KEY_STORAGE);

  const owner = $('ghOwnerInput').value.trim();
  const repo = $('ghRepoInput').value.trim();
  const path = $('ghPathInput').value.trim() || 'seeds.json';
  const token = $('ghTokenInput').value.trim();

  const wasConfigured = isGhConfigured();

  if (owner) localStorage.setItem(GH_OWNER, owner); else localStorage.removeItem(GH_OWNER);
  if (repo) localStorage.setItem(GH_REPO, repo); else localStorage.removeItem(GH_REPO);
  localStorage.setItem(GH_PATH, path);
  if (token) localStorage.setItem(GH_TOKEN, token); else localStorage.removeItem(GH_TOKEN);

  closeModal(settingsModal);
  showToast('설정이 저장되었습니다');

  // 새로 GitHub 설정한 직후라면 한번 풀해서 동기화
  if (!wasConfigured && isGhConfigured()) {
    const ok = await pullFromGithub();
    // pull 후 로컬에 데이터가 있고 원격이 비었으면 푸시
    if (ok && seeds.length > 0 && !localStorage.getItem(GH_SHA)) {
      pushToGithub();
    }
  } else if (isGhConfigured()) {
    setSyncStatus('synced', 'GitHub 동기화됨');
  } else {
    setSyncStatus('', '로컬');
  }
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeModal(settingsModal);
});

// ===== MANUAL SYNC BUTTONS =====
$('syncBtn').addEventListener('click', () => {
  if (!isGhConfigured()) {
    showToast('먼저 설정에서 GitHub 정보를 입력해주세요');
    return;
  }
  pushToGithub().then(ok => { if (ok) showToast('GitHub에 동기화 완료'); });
});

$('pullBtn').addEventListener('click', async () => {
  if (!isGhConfigured()) {
    showToast('먼저 설정에서 GitHub 정보를 입력해주세요');
    return;
  }
  if (seeds.length > 0 && !confirm('현재 기기의 씨앗이 GitHub의 내용으로 덮어씌워집니다. 계속할까요?')) return;
  await pullFromGithub();
});

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ===== INIT =====
(async function init() {
  renderList();
  if (isGhConfigured()) {
    // 시작 시 자동으로 원격에서 최신본 가져오기
    await pullFromGithub();
  } else {
    setSyncStatus('', '로컬');
  }
})();
