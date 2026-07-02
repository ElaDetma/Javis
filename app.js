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
    provider: 'gemini',
    keys: { anthropic: '', gemini: '' },
    models: { anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.0-flash' },
    voiceURI: '',
    autoSpeak: true,
  }),
  speaking: false,
  listening: false,
};

// Migration: alte Einstellungen ({apiKey, model}) auf das neue Anbieter-Format heben.
(function migrateSettings() {
  const s = state.settings;
  if (!s.provider) s.provider = 'gemini';
  if (!s.keys) s.keys = { anthropic: '', gemini: '' };
  if (!s.models) s.models = { anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.0-flash' };
  if (s.apiKey) { // alter einzelner Anthropic-Key
    if (!s.keys.anthropic) s.keys.anthropic = s.apiKey;
    delete s.apiKey;
  }
  if (s.model) { // altes einzelnes Anthropic-Modell
    if (!s.models.anthropic) s.models.anthropic = s.model;
    delete s.model;
  }
})();

// Auswahlmöglichkeiten je Anbieter (Wert = Modell-ID, Text = Anzeige).
const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyHint: 'Kostenloser Key auf aistudio.google.com → „Get API key". Kein Guthaben/keine Kreditkarte nötig. Wird nur lokal im Browser gespeichert.',
    models: [
      ['gemini-2.0-flash', 'Gemini 2.0 Flash (schnell, gratis)'],
      ['gemini-2.5-flash', 'Gemini 2.5 Flash (neuer)'],
      ['gemini-1.5-flash', 'Gemini 1.5 Flash'],
    ],
  },
  anthropic: {
    label: 'Anthropic Claude',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Key auf console.anthropic.com. Kostenpflichtig (Guthaben nötig). Wird nur lokal im Browser gespeichert.',
    models: [
      ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (günstig)'],
      ['claude-sonnet-5', 'Claude Sonnet 5 (schnell)'],
      ['claude-opus-4-8', 'Claude Opus 4.8 (stärkstes)'],
    ],
  },
};

const SYSTEM_PROMPT = `Du bist JAVIS, ein persönlicher KI-Assistent im Stil von JARVIS aus Iron Man.
Du sprichst den Nutzer respektvoll und freundlich an, mit einem Hauch trockenem Humor.
Antworte standardmäßig auf Deutsch, kurz und klar — deine Antworten werden vorgelesen,
also vermeide lange Aufzählungen, Code-Blöcke oder Formatierung, wenn nicht ausdrücklich gewünscht.
Du hilfst dem Nutzer aktiv, seine Ziele zu erreichen (z.B. Geld verdienen, ein Unity-Spiel
fertig bauen, lernen). Sei konkret, schlage nächste Schritte vor und frag nach, wenn dir
Informationen fehlen. Wenn nach Code oder Details gefragt wird, darfst du ausführlicher werden.

Wichtig: Wann immer der Nutzer ein neues Ziel, Vorhaben oder eine Absicht nennt
(z.B. "ich will 500€ verdienen", "hilf mir mein Spiel fertig zu bauen", "ich möchte
Gitarre lernen"), lege es mit dem Werkzeug "add_goal" an — auch ungefragt. Doppelte
oder bereits vorhandene Ziele nicht erneut anlegen. Erwähne beiläufig, dass du es
zur Ziel-Liste hinzugefügt hast.`;

const TOOLS = [{
  name: 'add_goal',
  description: 'Fügt der Ziel-Liste des Nutzers ein neues Ziel hinzu, wenn er im Gespräch ein Vorhaben, eine Absicht oder ein Ziel nennt.',
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Das Ziel, kurz und klar formuliert (z.B. "500€ verdienen").' },
    },
    required: ['text'],
  },
}];

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
    const t = $('textInput').value.trim();
    if (t) send(t);
    resumeWakeIfWanted();
  };
  recognition.onerror = () => {
    state.listening = false;
    $('micBtn').classList.remove('rec');
    setState('idle', 'Bereit');
    resumeWakeIfWanted();
  };
}

/* ---------- Wake-Word „Hey JAVIS" ----------
   Separater Dauer-Recognizer, der im Hintergrund lauscht. Erkennt er das
   Wake-Word, pausiert er und startet die normale Befehls-Erkennung. */
const WAKE_WORDS = ['hey javis', 'hey jarvis', 'hey jervis', 'hallo javis', 'ok javis', 'hey chavis'];
let wakeRecognition = null;
let wakeWanted = false; // Nutzer hat Wake-Modus aktiviert

if (SR) {
  wakeRecognition = new SR();
  wakeRecognition.lang = 'de-DE';
  wakeRecognition.continuous = true;
  wakeRecognition.interimResults = true;

  wakeRecognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript.toLowerCase().trim();
      if (WAKE_WORDS.some((w) => t.includes(w))) {
        stopWake();
        // Bestätigungston + direkt aufnehmen
        if (state.settings.autoSpeak) speak('Ja?');
        setTimeout(() => { if (!state.listening) startCommand(); }, state.settings.autoSpeak ? 600 : 0);
        return;
      }
    }
  };
  // Chrome beendet die Erkennung periodisch — im Wake-Modus neu starten.
  wakeRecognition.onend = () => { if (wakeWanted && !state.listening) safeStartWake(); };
  wakeRecognition.onerror = (ev) => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      wakeWanted = false; updateWakeBtn();
      addMessage('javis', 'Für „Hey JAVIS" brauche ich die Mikrofon-Erlaubnis. Bitte im Browser zulassen.');
    }
  };
}

function safeStartWake() {
  try { wakeRecognition.start(); } catch (_) { /* läuft evtl. schon */ }
}
// Nach einer Befehls-Aufnahme wieder in den Lausch-Modus zurückkehren.
function resumeWakeIfWanted() {
  if (wakeWanted && !state.listening) {
    setState('idle', 'Warte auf „Hey JAVIS"…');
    setTimeout(safeStartWake, 400);
  } else {
    setState('idle', 'Bereit');
  }
}
function stopWake() {
  if (!wakeRecognition) return;
  try { wakeRecognition.stop(); } catch (_) {}
}
function updateWakeBtn() {
  const b = $('wakeBtn');
  b.classList.toggle('rec', wakeWanted);
  b.title = wakeWanted ? 'Wake-Word „Hey JAVIS" AN (klick zum Ausschalten)' : 'Wake-Word „Hey JAVIS" AUS';
}
function toggleWake() {
  if (!wakeRecognition) {
    addMessage('javis', 'Wake-Word wird von diesem Browser nicht unterstützt. Nutze am besten Chrome/Edge.');
    return;
  }
  wakeWanted = !wakeWanted;
  save('javis_wake', wakeWanted);
  updateWakeBtn();
  if (wakeWanted) {
    setState('idle', 'Warte auf „Hey JAVIS"…');
    safeStartWake();
    addMessage('javis', 'Ich höre auf „Hey JAVIS". Sag es einfach — ich melde mich.');
  } else {
    stopWake();
    setState('idle', 'Bereit');
  }
}

// Startet die eigentliche Befehls-Aufnahme (nach Wake-Word oder Klick).
function startCommand() {
  speechSynthesis.cancel();
  $('textInput').value = '';
  state.listening = true;
  $('micBtn').classList.add('rec');
  setState('listening', 'Hört zu…');
  try { recognition.start(); } catch (_) {}
}

function toggleMic() {
  if (!recognition) {
    addMessage('javis', 'Spracherkennung wird von diesem Browser nicht unterstützt. Nutze am besten Chrome/Edge — oder tippe einfach.');
    return;
  }
  if (state.listening) { recognition.stop(); return; }
  stopWake(); // Konflikt zweier Recognizer vermeiden
  speechSynthesis.cancel();
  $('textInput').value = '';
  state.listening = true;
  $('micBtn').classList.add('rec');
  setState('listening', 'Hört zu…');
  recognition.start();
}

/* ---------- KI-Anbindung (anbieter-neutral) ----------
   state.history hält schlichte Turns: { role:'user'|'assistant', text:'...' }.
   Je nach gewähltem Anbieter wird daraus die passende Anfrage gebaut. */
function currentKey() {
  return (state.settings.keys[state.settings.provider] || '').trim();
}
function systemPrompt() {
  const goalsText = state.goals.length
    ? '\n\nAktuelle Ziele des Nutzers:\n' + state.goals.map((g, i) => `${i + 1}. [${g.done ? 'erledigt' : 'offen'}] ${g.text}`).join('\n')
    : '';
  return SYSTEM_PROMPT + goalsText;
}

async function askAI() {
  const key = currentKey();
  if (!key) {
    openSettings();
    throw new Error('Kein API-Key hinterlegt. Bitte oben rechts unter ⚙️ eintragen.');
  }
  const reply = state.settings.provider === 'gemini'
    ? await askGemini(key)
    : await askAnthropic(key);
  state.history.push({ role: 'assistant', text: reply });
  return reply;
}

/* --- Anthropic Claude --- */
async function askAnthropic(key) {
  const messages = state.history.map((m) => ({ role: m.role, content: m.text }));
  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: state.settings.models.anthropic,
        max_tokens: 1024,
        system: systemPrompt(),
        tools: TOOLS,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`API-Fehler ${res.status}: ${await res.text()}`);
    const data = await res.json();
    messages.push({ role: 'assistant', content: data.content });

    const toolUses = (data.content || []).filter((c) => c.type === 'tool_use');
    if (data.stop_reason === 'tool_use' && toolUses.length) {
      messages.push({
        role: 'user',
        content: toolUses.map((tu) => ({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: tu.name === 'add_goal' ? handleAddGoal(tu.input.text) : 'Nicht ausgeführt.',
        })),
      });
      continue;
    }
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return text || 'In Ordnung.';
  }
  return 'Ich konnte die Anfrage nicht abschließen.';
}

/* --- Google Gemini (kostenloses Kontingent) --- */
async function askGemini(key) {
  const model = state.settings.models.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const contents = state.history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  const geminiTools = [{
    functionDeclarations: [{
      name: 'add_goal',
      description: TOOLS[0].description,
      parameters: { type: 'object', properties: { text: { type: 'string', description: 'Das Ziel, kurz formuliert.' } }, required: ['text'] },
    }],
  }];

  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents,
        tools: geminiTools,
      }),
    });
    if (!res.ok) throw new Error(`API-Fehler ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    const parts = (cand && cand.content && cand.content.parts) || [];
    const calls = parts.filter((p) => p.functionCall);

    if (calls.length) {
      contents.push({ role: 'model', parts });
      contents.push({
        role: 'user',
        parts: calls.map((p) => ({
          functionResponse: {
            name: p.functionCall.name,
            response: { result: p.functionCall.name === 'add_goal' ? handleAddGoal(p.functionCall.args && p.functionCall.args.text) : 'Nicht ausgeführt.' },
          },
        })),
      });
      continue;
    }
    const text = parts.filter((p) => p.text).map((p) => p.text).join('\n');
    return text || 'In Ordnung.';
  }
  return 'Ich konnte die Anfrage nicht abschließen.';
}

// Fügt ein Ziel hinzu (dedupliziert) und aktualisiert die UI.
function handleAddGoal(text) {
  const t = (text || '').trim();
  if (!t) return 'Leeres Ziel ignoriert.';
  const exists = state.goals.some((g) => g.text.toLowerCase() === t.toLowerCase());
  if (exists) return `Ziel "${t}" existiert bereits.`;
  state.goals.push({ text: t, done: false });
  save('javis_goals', state.goals);
  renderGoals();
  return `Ziel "${t}" wurde zur Liste hinzugefügt.`;
}

/* ---------- Senden ---------- */
async function send(text) {
  text = (text || $('textInput').value).trim();
  if (!text) return;
  $('textInput').value = '';
  addMessage('user', text);
  state.history.push({ role: 'user', text });

  setState('thinking', 'Denkt nach…');
  const holder = addMessage('javis', '…');
  try {
    const reply = await askAI(); // History wird in askAI gepflegt
    holder.lastChild.textContent = reply;
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
// Modell-Auswahl und Key-Feld an den gewählten Anbieter anpassen.
function refreshProviderUI() {
  const p = state.settings.provider;
  const conf = PROVIDERS[p];
  const modelSel = $('model');
  modelSel.innerHTML = '';
  conf.models.forEach(([val, label]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = label;
    modelSel.appendChild(o);
  });
  modelSel.value = state.settings.models[p];
  $('apiKey').value = state.settings.keys[p] || '';
  $('apiKey').placeholder = conf.keyPlaceholder;
  $('keyHint').textContent = conf.keyHint;
}
function openSettings() {
  $('provider').value = state.settings.provider;
  refreshProviderUI();
  $('autoSpeak').checked = state.settings.autoSpeak;
  loadVoices();
  $('settingsModal').hidden = false;
}
function saveSettings() {
  const p = $('provider').value;
  state.settings.provider = p;
  state.settings.keys[p] = $('apiKey').value.trim();
  state.settings.models[p] = $('model').value;
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
$('wakeBtn').onclick = toggleWake;
$('addGoalBtn').onclick = addGoal;
$('settingsBtn').onclick = openSettings;
$('saveSettings').onclick = saveSettings;
$('closeSettings').onclick = () => { $('settingsModal').hidden = true; };
// Beim Anbieter-Wechsel Modell-Liste und Key-Feld sofort aktualisieren.
$('provider').onchange = () => { state.settings.provider = $('provider').value; refreshProviderUI(); };

/* ---------- Init ---------- */
renderGoals();
loadVoices();
updateWakeBtn();
addMessage('javis', 'Systeme online. Ich bin JAVIS. Sag oder schreib mir dein Ziel — zum Beispiel „Hilf mir, 500€ zu verdienen" oder „Bau mit mir mein Unity-Spiel fertig". Tipp: Aktiviere 👂 und sag einfach „Hey JAVIS".');
if (!currentKey()) {
  addMessage('javis', 'Kurz vorab: Bitte hinterlege oben rechts unter ⚙️ einen API-Key. Voreingestellt ist Google Gemini — der ist kostenlos (Key auf aistudio.google.com holen).');
}
// Gespeicherten Wake-Modus wiederherstellen (Start erst nach erster Nutzer-Geste erlaubt).
if (load('javis_wake', false) && wakeRecognition) {
  const arm = () => { if (!wakeWanted) toggleWake(); window.removeEventListener('pointerdown', arm); };
  window.addEventListener('pointerdown', arm, { once: true });
}
