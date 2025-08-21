#!/bin/bash

# Token Saver MCP Auto-Setup Script
# This script automatically configures everything needed for the MCP extension

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="${1:-$(pwd)}"
PROJECT_NAME=$(basename "$PROJECT_DIR")

echo -e "${BOLD}Token Saver MCP - Automatic Setup${NC}"
echo "================================================"
echo "Project: $PROJECT_NAME"
echo "Path: $PROJECT_DIR"
echo ""

# Step 1: Find an available port
find_available_port() {
    local port=9527
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        ((port++))
    done
    echo $port
}

# Step 2: Check if .mcp_server_port exists
if [ -f "$PROJECT_DIR/.mcp_server_port" ]; then
    EXISTING_PORT=$(cat "$PROJECT_DIR/.mcp_server_port")
    echo -e "${YELLOW}Found existing port configuration: $EXISTING_PORT${NC}"
    read -p "Keep existing port $EXISTING_PORT? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PORT=$EXISTING_PORT
    else
        PORT=$(find_available_port)
        echo $PORT > "$PROJECT_DIR/.mcp_server_port"
        echo -e "${GREEN}✓ Updated port to: $PORT${NC}"
    fi
else
    PORT=$(find_available_port)
    echo $PORT > "$PROJECT_DIR/.mcp_server_port"
    echo -e "${GREEN}✓ Created .mcp_server_port file with port: $PORT${NC}"
fi

# Step 3: Create or update workspace ID
if [ ! -f "$PROJECT_DIR/.lsp_mcp_workspace_id" ]; then
    WORKSPACE_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$PROJECT_NAME-$(date +%s)")
    echo "$WORKSPACE_ID" > "$PROJECT_DIR/.lsp_mcp_workspace_id"
    echo -e "${GREEN}✓ Created workspace ID: $WORKSPACE_ID${NC}"
else
    WORKSPACE_ID=$(cat "$PROJECT_DIR/.lsp_mcp_workspace_id")
    echo -e "${GREEN}✓ Found workspace ID: $WORKSPACE_ID${NC}"
fi

# Step 4: Generate Claude command
CLAUDE_CMD="claude mcp add --transport http token-saver http://127.0.0.1:$PORT/mcp"

# Step 5: Check if VSCode is running
if pgrep -f "code.*$PROJECT_DIR" > /dev/null || pgrep -f "code-server.*$PROJECT_DIR" > /dev/null; then
    echo -e "${GREEN}✓ VSCode is running for this project${NC}"
else
    echo -e "${YELLOW}⚠ VSCode is not running for this project${NC}"
    echo "  Please open VSCode with this project before using MCP tools"
fi

# Step 6: Test MCP server
echo ""
echo "Testing MCP server connection..."
if curl -s -f "http://127.0.0.1:$PORT/workspace-info" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MCP server is responding on port $PORT${NC}"
else
    echo -e "${YELLOW}⚠ MCP server not responding yet${NC}"
    echo "  This is normal if VSCode just started. Wait 10-30 seconds."
fi

# Step 7: Create status file
cat > "$PROJECT_DIR/.lsp_mcp_status.json" <<EOF
{
  "project": "$PROJECT_NAME",
  "path": "$PROJECT_DIR",
  "port": $PORT,
  "workspace_id": "$WORKSPACE_ID",
  "setup_date": "$(date -Iseconds)",
  "claude_command": "$CLAUDE_CMD"
}
EOF

echo -e "${GREEN}✓ Created .lsp_mcp_status.json${NC}"

# Step 8: Show summary
echo ""
echo "================================================"
echo -e "${BOLD}Setup Complete!${NC}"
echo "================================================"
echo ""
echo -e "${BOLD}To use with Claude:${NC}"
echo ""
echo "  $CLAUDE_CMD"
echo ""
echo -e "${BOLD}Project Configuration:${NC}"
echo "  Port: $PORT"
echo "  Workspace ID: $WORKSPACE_ID"
echo "  Status file: .lsp_mcp_status.json"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo "  1. Run the Claude command above (if not already configured)"
echo "  2. Open a TypeScript/JavaScript file in VSCode"
echo "  3. Wait 10-30 seconds for language server to initialize"
echo "  4. Start using MCP tools in Claude!"
echo ""

# Optional: Auto-configure Claude if requested
read -p "Would you like to configure Claude now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running: $CLAUDE_CMD"
    eval $CLAUDE_CMD
    echo -e "${GREEN}✓ Claude configured successfully!${NC}"
fi