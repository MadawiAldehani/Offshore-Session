#!/bin/bash
# Double-click this file to start the quiz.
# Keep the Terminal window that opens RUNNING during your workshop.
# Closing that window stops the quiz.

cd "$(dirname "$0")" || exit 1

clear
echo "==============================================="
echo "   OFFSHORE WORKSHOP QUIZ"
echo "==============================================="
echo ""

# Install dependencies on first run.
if [ ! -d node_modules ]; then
  echo "First run - installing (takes about a minute)..."
  npm install || { echo "Install failed. Press any key to close."; read -n 1; exit 1; }
  echo ""
fi

# If something is already using port 3000, stop it so we get a clean start.
EXISTING=$(lsof -ti :3000 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo "Stopping a previous copy that was still running..."
  kill $EXISTING 2>/dev/null
  sleep 2
fi

echo "Starting the quiz server..."
echo ""
npm run dev &
SERVER_PID=$!

# Wait until the server actually answers before opening the browser.
for i in $(seq 1 45); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/screen; then
    READY=1
    break
  fi
  sleep 1
done

echo ""
if [ "$READY" = "1" ]; then
  echo "==============================================="
  echo "   READY"
  echo "==============================================="
  echo ""
  echo "   PROJECTOR : http://localhost:3000/screen"
  echo "   CONTROLS  : http://localhost:3000/admin"
  echo ""
  echo "   Opening both in your browser now..."
  echo ""
  echo "   >>> KEEP THIS WINDOW OPEN <<<"
  echo "   Closing it stops the quiz."
  echo ""
  open "http://localhost:3000/screen"
  sleep 2
  open "http://localhost:3000/admin"
else
  echo "The server did not start. Scroll up for the error."
fi

# Hold the window open so the server keeps running.
wait $SERVER_PID
