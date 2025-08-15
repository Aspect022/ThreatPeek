@echo off
echo Starting ThreatPeek Backend and Frontend...
echo.

echo Starting Backend Server...
start "ThreatPeek Backend" cmd /k "cd Backend && npm start"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "ThreatPeek Frontend" cmd /k "cd Frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
pause