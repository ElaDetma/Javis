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

  // Tool-Use-Schleife: das Modell kann add_goal aufrufen, wir führen es aus
  // und lassen es danach seine finale Textantwort formulieren.
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
        model: state.settings.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT + goalsText,
        tools: TOOLS,
        messages: state.history,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API-Fehler ${res.status}: ${err}`);
    }
    const data = await res.json();
    // Assistant-Nachricht (inkl. tool_use-Blöcke) in die History übernehmen
    state.history.push({ role: 'assistant', content: data.content });

    const toolUses = (data.content || []).filter((c) => c.type === 'tool_use');
    if (data.stop_reason === 'tool_use' && toolUses.length) {
      const results = toolUses.map((tu) => {
        let msg = 'Nicht ausgeführt.';
        if (tu.name === 'add_goal') msg = handleAddGoal(tu.input.text);
        return { type: 'tool_result', tool_use_id: tu.id, content: msg };
      });
      state.history.push({ role: 'user', content: results });
      continue; // nächste Runde: Modell formuliert Antwort
    }

    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
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
  state.history.push({ role: 'user', content: text });

  setState('thinking', 'Denkt nach…');
  const holder = addMessage('javis', '…');
  try {
    const reply = await askClaude(); // History wird in askClaude gepflegt
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
$('wakeBtn').onclick = toggleWake;
$('addGoalBtn').onclick = addGoal;
$('settingsBtn').onclick = openSettings;
$('saveSettings').onclick = saveSettings;
$('closeSettings').onclick = () => { $('settingsModal').hidden = true; };

/* ---------- Init ---------- */
renderGoals();
loadVoices();
updateWakeBtn();
addMessage('javis', 'Systeme online. Ich bin JAVIS. Sag oder schreib mir dein Ziel — zum Beispiel „Hilf mir, 500€ zu verdienen" oder „Bau mit mir mein Unity-Spiel fertig". Tipp: Aktiviere 👂 und sag einfach „Hey JAVIS".');
if (!state.settings.apiKey) {
  addMessage('javis', 'Kurz vorab: Bitte hinterlege deinen Anthropic API-Key oben rechts unter ⚙️, damit ich denken kann.');
}
// Gespeicherten Wake-Modus wiederherstellen (Start erst nach erster Nutzer-Geste erlaubt).
if (load('javis_wake', false) && wakeRecognition) {
  const arm = () => { if (!wakeWanted) toggleWake(); window.removeEventListener('pointerdown', arm); };
  window.addEventListener('pointerdown', arm, { once: true });
}
