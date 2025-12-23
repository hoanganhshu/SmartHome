@echo off
echo ====================================
echo   KHOI DONG HE THONG NHA THONG MINH
echo ====================================
echo.

echo [1/2] Dang khoi dong Backend Server...
cd backend
start "Backend Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul

echo [2/2] Dang khoi dong Frontend Server...
cd ..\frontend
start "Frontend Server" cmd /k "python -m http.server 8000"
timeout /t 2 /nobreak >nul

echo.
echo ====================================
echo   HE THONG DA KHOI DONG!
echo ====================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:8000
echo.
echo Nhan phim bat ky de mo trinh duyet...
pause >nul
start http://localhost:8000

