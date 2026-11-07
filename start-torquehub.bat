@echo off
title TorqueHub - Vehicle Service Center Management
color 0A
echo ========================================================
echo   🚗 TorqueHub - Vehicle Service Center Management
echo   Connected to MySQL Workbench (torquehub_db)
echo ========================================================
echo.
cd /d "%~dp0"
echo Starting server and launching http://localhost:3000 in your browser...
timeout /t 1 /nobreak >nul
start "" http://localhost:3000
node server.js
pause
