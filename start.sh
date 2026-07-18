#!/bin/bash
# Start script to run both backend and frontend

# 1. Start Backend if not already running on port 8000
if lsof -i :8000 > /dev/null ; then
    echo "Backend is already running on port 8000."
else
    echo "Starting backend..."
    cd backend
    ./.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 > uvicorn.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started with PID $BACKEND_PID."
    cd ..
fi

# 2. Start Frontend and display QR code (foreground)
echo "Starting frontend on port 8083..."
cd frontend
npx expo start --port 8083
