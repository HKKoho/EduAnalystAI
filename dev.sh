#!/bin/bash

# Start both frontend and backend development servers
# Usage: ./dev.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Edu-Analyst AI Development Servers${NC}"
echo "============================================"

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${RED}Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start backend server
echo -e "${BLUE}Starting backend server...${NC}"
(cd backend && npm run dev) &
BACKEND_PID=$!

# Give backend a moment to start
sleep 1

# Start frontend server
echo -e "${BLUE}Starting frontend server...${NC}"
npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}Both servers are running!${NC}"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000"
echo -e "\nPress Ctrl+C to stop both servers\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
