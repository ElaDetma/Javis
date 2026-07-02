# JAVIS als handelnder Agent einrichten (Windows)

Diese Anleitung macht aus deinem PC einen **handelnden JAVIS**: einen KI-Agenten,
der auf Zuruf echte Aufgaben erledigt — Code schreiben, Texte erstellen, Dateien
ordnen, Projekte umsetzen. Er läuft lokal auf deinem Computer.

## Was du brauchst
- Einen Windows-PC
- Ca. 15 Minuten
- Ein Claude-Konto. **Dein Claude Max 5×-Abo enthält Claude Code bereits — du
  zahlst nichts extra.** Beim Start meldest du dich einfach mit diesem Konto an.

---

## Schritt 1 — Node.js prüfen (und ggf. installieren)
Node.js ist die Grundlage, auf der der Agent läuft.
1. Windows-Taste → **„PowerShell"** tippen → öffnen
2. Tippe `node -v` und drücke Enter:
   - Kommt eine **Versionsnummer** (z.B. `v20.11.0`) → Node ist da, weiter zu Schritt 2.
   - Kommt ein **Fehler / „wird nicht erkannt"** → installieren:
     1. Gehe zu **https://nodejs.org**
     2. Klick den großen grünen **„LTS"**-Knopf → Datei herunterladen
     3. Installer öffnen und durchklicken (alle Standard-Einstellungen)
     4. PowerShell **schließen und neu öffnen**, dann `node -v` erneut prüfen

## Schritt 2 — JAVIS-Arbeitsordner anlegen
Ein fester Ordner, in dem JAVIS für dich arbeitet:
1. Im Explorer unter **„Dokumente"** einen Ordner **`JAVIS`** anlegen
2. Diese zwei Dateien aus dem Repo-Ordner `JAVIS-Agent/` hineinlegen:
   - **`CLAUDE.md`** — gibt JAVIS seine Persönlichkeit und kennt deine Ziele
   - **`JAVIS-starten.bat`** — die Start-Datei zum Doppelklicken

> Dateien herunterladen: Auf github.com/ElaDetma/Javis im Ordner `JAVIS-Agent`
> jede Datei öffnen → Knopf **„Download raw file"** (Pfeil-Symbol) → in den
> `JAVIS`-Ordner speichern.

## Schritt 3 — JAVIS starten (Doppelklick)
Doppelklick auf **`JAVIS-starten.bat`**.
- Beim **allerersten Mal** installiert sich Claude Code automatisch (dauert ein
  paar Minuten) — das passiert nur einmal.
- Danach öffnet sich der Browser zum **Anmelden** → mit deinem **Max**-Konto einloggen.

> Hinweis: Windows zeigt bei `.bat`-Dateien evtl. eine Warnung („Windows hat den
> PC geschützt"). Klick auf **„Weitere Informationen" → „Trotzdem ausführen"**.
> Die Datei macht nur, was oben beschrieben ist.

## Schritt 4 — Loslegen
Jetzt einfach schreiben, was JAVIS tun soll. Beispiele:
- „Schreib mir eine Bewerbung als … und speichere sie als Word-taugliche Datei."
- „Sortiere alle PDFs in diesem Ordner nach Datum in Unterordner."
- „Lass uns einen Plan machen, wie ich mit meinem Spiel die ersten 500 € verdiene."

## Schritt 5 — Für dein Unity-Spiel
Damit JAVIS die Skripte direkt in dein Spiel schreibt, muss er im
**Unity-Projektordner** laufen:
- Kopiere `JAVIS-starten.bat` zusätzlich in deinen Unity-Projektordner und
  doppelklicke sie **dort**. Dann landet z.B.
  „Erstelle ein C#-Skript, das den Spieler mit WASD bewegt" genau im Projekt,
  und Unity importiert es automatisch.

---

## Gut zu wissen
- **Zwei getrennte Dinge:** Die Orb-Webseite (eladetma.github.io/Javis) ist die
  hübsche Sprach-Oberfläche zum Reden/Planen. Dieser lokale Agent ist der, der
  wirklich Dateien schreibt und Aufgaben erledigt.
- **Kosten:** Mit deinem Max 5×-Abo keine Zusatzkosten für Claude Code.
- **Grenzen (ehrlich):** JAVIS handelt an Dateien und Befehlen. Er klickt nicht
  selbst in fremden Programmen herum und verdient nicht vollautomatisch Geld —
  er macht dich aber um ein Vielfaches schneller.
