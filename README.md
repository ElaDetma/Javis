# JAVIS 🛰️

Ein futuristisches KI-Interface im Stil von JARVIS aus Iron Man: ein großer,
animierter Orb, mit dem du **schreiben und sprechen** kannst und der dir per
**Sprache antwortet**. Du kannst JAVIS Ziele geben (z.B. „500€ verdienen",
„mein Unity-Spiel fertig bauen") und er hilft dir Schritt für Schritt.

## Features
- 🔵 **Animierter Orb** mit Ringen, Glühen und Live-Wellen-Visualizer
- 🎙️ **Spracheingabe** (Push-to-talk, Klick auf Mikro oder Orb) via Web Speech API
- 👂 **Wake-Word „Hey JAVIS"** – 👂 aktivieren und freihändig per „Hey JAVIS" starten
- 🔊 **Sprachausgabe** – Antworten werden vorgelesen (Stimme wählbar)
- ⌨️ **Texteingabe** als Alternative
- 🎯 **Ziele-Panel** – Ziele speichern, abhaken und JAVIS gezielt um Hilfe bitten
- 🧠 Antworten von **Google Gemini (kostenlos)** oder **Claude** – umschaltbar in den Einstellungen
- 💾 Alles läuft lokal im Browser – der API-Key wird nur lokal gespeichert

## Loslegen
1. Repo klonen und `index.html` im Browser öffnen (am besten **Chrome** oder
   **Edge** – dort funktioniert die Spracherkennung am besten).
   Oder lokal servieren:
   ```bash
   python3 -m http.server 8000
   # dann http://localhost:8000 öffnen
   ```
2. Oben rechts auf ⚙️ klicken, **Anbieter** wählen und den **API-Key** eintragen:
   - **Google Gemini (kostenlos, empfohlen):** Key gratis auf https://aistudio.google.com → „Get API key" (keine Kreditkarte nötig).
   - **Anthropic Claude (kostenpflichtig):** Key auf https://console.anthropic.com (Guthaben erforderlich).
3. Stimme wählen, speichern – fertig.
4. Auf 🎙️ (oder den Orb) klicken und sprechen, oder unten tippen.

## Ziele
Über das **＋** im Ziele-Panel legst du Ziele an. Mit 💬 bittest du JAVIS
direkt um die nächsten konkreten Schritte für ein Ziel. JAVIS kennt deine
Ziele und bezieht sie in jede Antwort mit ein.

## Hinweis zum API-Key
Der Key wird ausschließlich in deinem Browser (`localStorage`) gespeichert und
direkt an die Anthropic-API gesendet. Er verlässt deinen Rechner nur Richtung
Anthropic. Für den reinen Browser-Betrieb wird das Header-Flag
`anthropic-dangerous-direct-browser-access` genutzt.

## Technik
Reines HTML/CSS/JS, keine Build-Tools, keine Abhängigkeiten:
- `index.html` – Struktur
- `style.css` – futuristisches Design
- `app.js` – Sprache, Ziele und Anthropic-Anbindung
