@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (
    echo Création de l'environnement Python...
    python -m venv .venv || goto :err
    .venv\Scripts\python -m pip install --upgrade pip >nul
    .venv\Scripts\python -m pip install -r requirements.txt || goto :err
)
if not exist .env copy .env.example .env >nul
echo.
echo  Maison connectée : http://localhost:8123
echo  (fermer cette fenêtre ou Ctrl+C pour arrêter)
echo.
.venv\Scripts\python run.py
pause
exit /b
:err
echo Échec de l'installation. Python 3.11+ est-il installé ?
pause
