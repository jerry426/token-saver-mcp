#!/bin/bash

# AI Terminal Orchestrator Startup Script

echo "🤖 AI Terminal Orchestrator"
echo "=========================="
echo ""

# Check if already running
if npx tsx ai-orchestrator-server.ts --status | grep -q "is running"; then
    echo "✅ Orchestrator is already running"
    npx tsx ai-orchestrator-server.ts --status
    echo ""
    echo "To stop it, run: ./start-orchestrator.sh stop"
    echo "To view the UI, open: http://127.0.0.1:9800"
else
    echo "Starting orchestrator..."
    echo ""
    
    # Start in background
    nohup npx tsx ai-orchestrator-server.ts > orchestrator.log 2>&1 &
    
    # Wait a moment for startup
    sleep 2
    
    # Check status
    if npx tsx ai-orchestrator-server.ts --status | grep -q "is running"; then
        echo "✅ Orchestrator started successfully!"
        echo ""
        npx tsx ai-orchestrator-server.ts --status
        echo ""
        echo "View logs: tail -f orchestrator.log"
        echo "Open UI: http://127.0.0.1:9800"
        echo "Stop server: ./start-orchestrator.sh stop"
    else
        echo "❌ Failed to start orchestrator"
        echo "Check orchestrator.log for details"
        exit 1
    fi
fi

# Handle stop command
if [ "$1" = "stop" ]; then
    echo ""
    echo "Stopping orchestrator..."
    npx tsx ai-orchestrator-server.ts --stop
    echo "✅ Orchestrator stopped"
fi