# JAVIS als handelnder Agent einrichten (Windows)

Diese Anleitung macht aus deinem PC einen **handelnden JAVIS**: einen KI-Agenten,
der auf Zuruf echte Aufgaben erledigt — Code schreiben, Texte erstellen, Dateien
ordnen, Projekte umsetzen. Er läuft lokal auf deinem Computer.

## Was du brauchst
- Einen Windows-PC
- Ca. 15 Minuten
- Ein Claude-Konto (Empfehlung: **Claude Pro**, ~20 $/Monat Festpreis — enthält
  großzügige Nutzung, kein „pro Anfrage")

---

## Schritt 1 — Node.js installieren
Node.js ist die Grundlage, auf der der Agent läuft.
1. Gehe zu **https://nodejs.org**
2. Klick den großen grünen **„LTS"**-Knopf → Datei herunterladen
3. Installer öffnen und einfach durchklicken (alle Standard-Einstellungen)

## Schritt 2 — PowerShell öffnen
1. Windows-Taste drücken
2. **„PowerShell"** tippen → öffnen (das schwarze/blaue Fenster)

## Schritt 3 — Claude Code installieren
Tippe (oder kopiere) diese Zeile und drücke Enter:
```
npm install -g @anthropic-ai/claude-code
```
Warte, bis es fertig ist (ein paar Zeilen Text erscheinen).

## Schritt 4 — Einen JAVIS-Arbeitsordner anlegen
Am besten ein fester Ordner, in dem JAVIS für dich arbeitet. Zum Beispiel:
1. Im Explorer unter „Dokumente" einen Ordner **`JAVIS`** anlegen
2. Die Datei **`CLAUDE.md`** (aus diesem Ordner hier) hineinkopieren —
   sie gibt JAVIS seine Persönlichkeit und kennt deine Ziele.

## Schritt 5 — JAVIS starten
In PowerShell in deinen Ordner wechseln (deinen Pfad einsetzen) und starten:
```
cd "C:\Users\DeinName\Documents\JAVIS"
claude
```
Beim ersten Start öffnet sich der Browser zum **Anmelden** (mit deinem Claude-Konto).

## Schritt 6 — Loslegen
Jetzt einfach schreiben, was JAVIS tun soll. Beispiele:
- „Schreib mir eine Bewerbung als … und speichere sie als Word-taugliche Datei."
- „Erstelle in meinem Unity-Projekt ein C#-Skript, das Gegner spawnt."
  (Dafür beim Start in den **Unity-Projektordner** wechseln statt in den JAVIS-Ordner.)
- „Sortiere alle PDFs in diesem Ordner nach Datum in Unterordner."
- „Lass uns einen Plan machen, wie ich mit meinem Spiel die ersten 500 € verdiene."

---

## Gut zu wissen
- **Zwei getrennte Dinge:** Die Orb-Webseite (eladetma.github.io/Javis) ist die
  hübsche Sprach-Oberfläche zum Reden/Planen. Dieser lokale Agent ist der, der
  wirklich Dateien schreibt und Aufgaben erledigt.
- **Für Unity:** Starte `claude` direkt in deinem Unity-Projektordner — dann
  schreibt JAVIS die Skripte genau dorthin, und Unity importiert sie automatisch.
- **Grenzen (ehrlich):** JAVIS handelt an Dateien und Befehlen. Er klickt nicht
  selbst in fremden Programmen herum und verdient nicht vollautomatisch Geld —
  er macht dich aber um ein Vielfaches schneller.
