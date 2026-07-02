@echo off
chcp 65001 >nul
title JAVIS
cd /d "%~dp0"

echo ============================================
echo            J A V I S   startet...
echo ============================================
echo.

REM --- Node.js vorhanden? ---
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js wurde nicht gefunden.
  echo     Bitte zuerst installieren: https://nodejs.org  ^(gruener "LTS"-Knopf^)
  echo     Danach dieses Fenster schliessen und erneut doppelklicken.
  echo.
  pause
  exit /b
)

REM --- Claude Code vorhanden? Sonst installieren ---
where claude >nul 2>nul
if errorlevel 1 (
  echo [*] Claude Code ist noch nicht installiert - das mache ich jetzt einmalig.
  echo     Das kann ein paar Minuten dauern...
  echo.
  call npm install -g @anthropic-ai/claude-code
  echo.
)

REM --- JAVIS starten ---
echo [*] Starte JAVIS. Beim ersten Mal oeffnet sich der Browser zum Anmelden
echo     mit deinem Claude-Konto ^(Max-Abo^).
echo.
call claude

echo.
echo JAVIS wurde beendet. Fenster kann geschlossen werden.
pause
