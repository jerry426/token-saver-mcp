#!/bin/bash

# Token Saver Memory Viewer Launcher (Integrated)

echo "🧠 Opening Token Saver Memory Viewer"
echo "===================================="
echo ""

# Check if MCP server is running
if curl -s http://127.0.0.1:9700/health > /dev/null 2>&1; then
    echo "✅ MCP server is running on port 9700"
    echo ""
    
    URL="http://127.0.0.1:9700/memory-viewer"
    echo "🌐 Opening $URL in your browser..."
    
    # Open browser based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$URL" 2>/dev/null || echo "Please open $URL in your browser"
    elif command -v cmd.exe > /dev/null; then
        cmd.exe /c start "$URL"
    else
        echo "Please open $URL in your browser"
    fi
    
    echo ""
    echo "✨ The memory viewer is now open in your browser"
    echo "   You can search, filter, and view memories with beautiful markdown rendering"
else
    echo "❌ Error: MCP server is not running on port 9700"
    echo ""
    echo "To start the Token Saver MCP server:"
    echo "1. Open VSCode with the Token Saver MCP extension"
    echo "2. The server will start automatically"
    echo ""
    echo "Or check if it's running on a different port and update this script"
    exit 1
fi