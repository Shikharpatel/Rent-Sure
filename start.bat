@echo off
echo 🚀 Starting Rent-Sure Backend and Frontend...

:: Open a new command window for the backend
start "Rent-Sure Backend" cmd /k "cd backend && node index.js"

:: Open a new command window for the frontend
start "Rent-Sure Frontend" cmd /k "cd frontend && npm run dev"

echo Done! The backend and frontend are starting in separate windows.
