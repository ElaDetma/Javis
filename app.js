/* =========================================================
   JAVIS — Iron-Man-Style KI-Interface
   Reines Frontend: Web Speech API (STT + TTS) + Anthropic API.
   Der API-Key bleibt lokal im Browser (localStorage).
   ========================================================= */

const $ = (id) => document.getElementById(id);

const state = {
  history: [],            // { role: 'user'|'assistant', content: '...' }
  goals: load('javis_goals', []),
  settings: load('javis_settings', {
    apiKey: '',
    model: 'claude-opus-4-8',
    voiceURI: '',
    autoSpeak: true,
  }),
  speaking: false,
  listening: false,
};

const SYSTEM_PROMPT = `Du bist JAVIS, ein persönlicher KI-Assistent im Stil von JARVIS aus Iron Man.
Du sprichst den Nutzer respektvoll und freundlich an, mit einem Hauch trockenem Humor.
Antworte standardmäßig auf Deutsch, kurz und klar — deine Antworten werden vorgelesen,
also vermeide lange Aufzählungen, Code-Blöcke oder Formatierung, wenn nicht ausdrücklich gewünscht.
Du hilfst dem Nutzer aktiv, seine Ziele zu erreichen (z.B. Geld verdienen, ein Unity-Spiel
fertig bauen, lernen). Sei konkret, schlage nächste Schritte vor und frag nach, wenn dir
Informationen fehlen. Wenn nach Code oder Details gefragt wird, darfst du ausführlicher werden.`;

/* ---------- Persistenz ---------- */
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- Orb / Status ---------- */
const orb = $('orb');
function setState(s, label) {
  orb.dataset.state = s;
  if (label) $('status').textContent = label;
}

/* ---------- Chat-Log ---------- */
function addMessage(role, text) {
  const el = document.createElement('div');
  el.className = 'msg ' + (role === 'user' ? 'user' : 'javis');
  el.innerHTML = `<span class="who">${role === 'user' ? 'Du' : 'JAVIS'}</span>`;
  el.appendChild(document.createTextNode(text));
  $('log').appendChild(el);
  $('log').scrollTop = $('log').scrollHeight;
  return el;
}

/* ---------- Text-to-Speech ---------- */
let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
  const sel = $('voiceSelect');
  sel.innerHTML = '';
  // Deutsche Stimmen zuerst
  voices
    .sort((a, b) => (b.lang.startsWith('de') - a.lang.startsWith('de')))
    .forEach((v) => {
      const o = document.createElement('option');
      o.value = v.voiceURI;
      o.textContent = `${v.name} (${v.lang})`;
      sel.appendChild(o);
    });
  if (state.settings.voiceURI) sel.value = state.settings.voiceURI;
}
speechSynthesis.onvoiceschanged = loadVoices;

function speak(text) {
  if (!state.settings.autoSpeak) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = voices.find((x) => x.voiceURI === state.settings.voiceURI)
         || voices.find((x) => x.lang.startsWith('de'));
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'de-DE'; }
  u.rate = 1.02; u.pitch = 1.0;
  u.onstart = () => { state.speaking = true; setState('speaking', 'Spricht…'); };
  u.onend = () => { state.speaking = false; setState('idle', 'Bereit'); };
  speechSynthesis.speak(u);
}

/* ---------- Speech-to-Text ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SR) {
  recognition = new SR();
  recognition.lang = 'de-DE';
  recognition.interimResults = true;
  recognition.continuous = false;

  let finalText = '';
  recognition.onresult = (e) => {
    let interim = '';
    finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    $('textInput').value = finalText || interim;
  };
  recognition.onend = () => {
    state.listening = false;
    $('micBtn').classList.remove('rec');
    setState('idle', 'Bereit');
    const t = $('textInput').value.trim();
    if (t) send(t);
  };
  recognition.onerror = () => {
    state.listening = false;
    $('micBtn').classList.remove('rec');
    setState('idle', 'Bereit');
  };
}

function toggleMic() {
  if (!recognition) {
    addMessage('javis', 'Spracherkennung wird von diesem Browser nicht unterstützt. Nutze am besten Chrome/Edge — oder tippe einfach.');
    return;
  }
  if (state.listening) { recognition.stop(); return; }
  speechSynthesis.cancel();
  $('textInput').value = '';
  state.listening = true;
  $('micBtn').classList.add('rec');
  setState('listening', 'Hört zu…');
  recognition.start();
}

/* ---------- Anthropic API ---------- */
async function askClaude() {
  const key = state.settings.apiKey;
  if (!key) {
    openSettings();
    throw new Error('Kein API-Key hinterlegt.');
  }
  const goalsText = state.goals.length
    ? '\n\nAktuelle Ziele des Nutzers:\n' + state.goals.map((g, i) => `${i + 1}. [${g.done ? 'erledigt' : 'offen'}] ${g.text}`).join('\n')
    : '';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: state.settings.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT + goalsText,
      messages: state.history,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API-Fehler ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

/* ---------- Senden ---------- */
async function send(text) {
  text = (text || $('textInput').value).trim();
  if (!text) return;
  $('textInput').value = '';
  addMessage('user', text);
  state.history.push({ role: 'user', content: text });

  setState('thinking', 'Denkt nach…');
  const holder = addMessage('javis', '…');
  try {
    const reply = await askClaude();
    holder.lastChild.textContent = reply;
    state.history.push({ role: 'assistant', content: reply });
    speak(reply);
    if (!state.settings.autoSpeak) setState('idle', 'Bereit');
  } catch (e) {
    holder.lastChild.textContent = '⚠️ ' + e.message;
    setState('idle', 'Bereit');
  }
}

/* ---------- Ziele ---------- */
function renderGoals() {
  const ul = $('goalList');
  ul.innerHTML = '';
  state.goals.forEach((g, i) => {
    const li = document.createElement('li');
    li.className = 'goal' + (g.done ? ' done' : '');
    li.innerHTML = `
      <input type="checkbox" ${g.done ? 'checked' : ''} />
      <span class="txt"></span>
      <button class="ask" title="JAVIS um Hilfe bei diesem Ziel bitten">💬</button>
      <button class="del" title="Löschen">✕</button>`;
    li.querySelector('.txt').textContent = g.text;
    li.querySelector('input').onchange = (e) => { g.done = e.target.checked; save('javis_goals', state.goals); renderGoals(); };
    li.querySelector('.ask').onclick = () => send(`Hilf mir mit diesem Ziel: "${g.text}". Was sind die nächsten konkreten Schritte?`);
    li.querySelector('.del').onclick = () => { state.goals.splice(i, 1); save('javis_goals', state.goals); renderGoals(); };
    ul.appendChild(li);
  });
}
function addGoal() {
  const text = prompt('Neues Ziel für JAVIS:', 'z.B. 500€ verdienen');
  if (text && text.trim()) {
    state.goals.push({ text: text.trim(), done: false });
    save('javis_goals', state.goals);
    renderGoals();
  }
}

/* ---------- Settings ---------- */
function openSettings() {
  $('apiKey').value = state.settings.apiKey;
  $('model').value = state.settings.model;
  $('autoSpeak').checked = state.settings.autoSpeak;
  loadVoices();
  $('settingsModal').hidden = false;
}
function saveSettings() {
  state.settings.apiKey = $('apiKey').value.trim();
  state.settings.model = $('model').value;
  state.settings.voiceURI = $('voiceSelect').value;
  state.settings.autoSpeak = $('autoSpeak').checked;
  save('javis_settings', state.settings);
  $('settingsModal').hidden = true;
}

/* ---------- Orb-Visualizer (animierte Wellen) ---------- */
const canvas = $('viz');
const ctx = canvas.getContext('2d');
function drawViz(t) {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const active = state.speaking || state.listening;
  const amp = active ? 30 : 10;
  ctx.strokeStyle = state.listening ? 'rgba(255,207,107,.7)' : 'rgba(180,245,255,.7)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.15) {
      const wobble = Math.sin(a * (4 + r) + t / (300 - r * 60)) * amp * (active ? Math.random() * 0.5 + 0.7 : 1);
      const rad = 50 + r * 18 + wobble;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.5 - r * 0.12;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(drawViz);
}
requestAnimationFrame(drawViz);

/* ---------- Events ---------- */
$('sendBtn').onclick = () => send();
$('micBtn').onclick = toggleMic;
$('orb').onclick = toggleMic;
$('textInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
$('addGoalBtn').onclick = addGoal;
$('settingsBtn').onclick = openSettings;
$('saveSettings').onclick = saveSettings;
$('closeSettings').onclick = () => { $('settingsModal').hidden = true; };

/* ---------- Init ---------- */
renderGoals();
loadVoices();
addMessage('javis', 'Systeme online. Ich bin JAVIS. Sag oder schreib mir dein Ziel — zum Beispiel „Hilf mir, 500€ zu verdienen" oder „Bau mit mir mein Unity-Spiel fertig". Womit fangen wir an?');
if (!state.settings.apiKey) {
  addMessage('javis', 'Kurz vorab: Bitte hinterlege deinen Anthropic API-Key oben rechts unter ⚙️, damit ich denken kann.');
}
