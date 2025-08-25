#!/bin/bash

# Token Saver Memory Viewer Launcher

echo "🧠 Token Saver Memory Viewer"
echo "============================="
echo ""

# Check if MCP server is running
if curl -s -X POST http://127.0.0.1:9700/mcp -H "Content-Type: application/json" \
   -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}' > /dev/null 2>&1; then
    echo "✅ MCP server is running on port 9700"
else
    echo "⚠️  Warning: MCP server doesn't appear to be running on port 9700"
    echo "   The viewer will not be able to load memories."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start a simple HTTP server
echo ""
echo "Starting web server..."
echo "----------------------"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "📡 Starting server at http://localhost:8888"
    echo ""
    echo "🌐 Opening browser..."
    
    # Open browser based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:8888"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "http://localhost:8888" 2>/dev/null || echo "Please open http://localhost:8888 in your browser"
    else
        echo "Please open http://localhost:8888 in your browser"
    fi
    
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    
    # Start Python HTTP server
    cd "$DIR"
    python3 -m http.server 8888
else
    echo "❌ Error: Python 3 is required to run the web server"
    echo "   Please install Python 3 and try again"
    exit 1
fi