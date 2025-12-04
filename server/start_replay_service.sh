#!/bin/bash

# Start the Replay Service (Python FastAPI)
cd "$(dirname "$0")"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed"
    exit 1
fi

# Install dependencies if needed
pip3 install fastapi uvicorn requests pydantic --quiet

# Set environment variables
export BETRADAR_ACCESS_TOKEN="${BETRADAR_ACCESS_TOKEN:-oIUENTCkk9nCIv92uQ}"
export REPLAY_SERVICE_PORT="${REPLAY_SERVICE_PORT:-8001}"
export UOF_API_BASE_URL="${UOF_API_BASE_URL:-https://api.betradar.com/v1}"

# Start the service
echo "Starting Replay Service on port $REPLAY_SERVICE_PORT..."
python3 replay_service.py
