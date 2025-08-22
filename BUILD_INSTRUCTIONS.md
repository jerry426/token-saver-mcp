# Build Instructions for Token Saver MCP

Token Saver MCP consists of two independent components that work together:
1. **VSCode Internals Gateway** - A VSCode extension that exposes Language Server Protocol features
2. **MCP Server** - A standalone server that provides the MCP interface and Chrome DevTools Protocol

## Prerequisites

- Node.js 18+ 
- pnpm (`npm install -g pnpm`)
- VSCode
- Chrome browser (for CDP features)

## Component 1: VSCode Internals Gateway

The VSCode extension that provides HTTP access to VSCode's internal Language Server features.

### Location
```
vscode-internals-gateway/
```

### Build and Install

```bash
# Navigate to the gateway directory
cd vscode-internals-gateway

# Install dependencies
pnpm install

# Build the extension
pnpm run build

# Package as VSIX (for distribution)
pnpm run package

# Install in VSCode (using the generated VSIX)
code --install-extension vscode-internals-gateway-*.vsix --force
```

### Verify Gateway Installation

After installing and reloading VSCode:

```bash
# Check extension is loaded
code --list-extensions | grep vscode-internals-gateway

# Verify gateway is running (default port 9600)
curl http://127.0.0.1:9600/health
```

The gateway will show a status notification in VSCode when it starts, indicating which port it's using (9600 by default, or next available if there's a conflict).

### Gateway Port Configuration

The gateway supports intelligent port management:
- Default port: 9600
- Automatically finds next available port if 9600 is in use
- Creates `.vscode_gateway_port` file in workspace root with the active port
- Override with `.vscode_gateway_port` file containing desired port number

## Component 2: MCP Server

The standalone Node.js server that provides the MCP protocol interface and Chrome DevTools Protocol features.

### Location
```
mcp-server/
```

### Development Mode

```bash
# Navigate to MCP server directory
cd mcp-server

# Install dependencies
pnpm install

# Run in development mode with hot reload
pnpm run dev

# Server will start on port 9700 by default
# Dashboard available at http://127.0.0.1:9700/dashboard
```

### Production Mode

```bash
# Build for production
pnpm run build

# Start production server
pnpm start
```

### Verify MCP Server

```bash
# Check server health
curl http://127.0.0.1:9700/health

# List available tools
curl -X POST http://127.0.0.1:9700/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'

# Access dashboard
open http://127.0.0.1:9700/dashboard
```

### MCP Server Port Configuration

The MCP server automatically discovers the VSCode Gateway port:
1. Reads `.vscode_gateway_port` file if present
2. Falls back to GATEWAY_PORT environment variable
3. Defaults to 9600

MCP Server port (default 9700) can be configured via:
- `PORT` environment variable
- Command line: `PORT=9800 pnpm start`

## Complete System Setup

### Quick Start (Development)

```bash
# Terminal 1: Start MCP Server
cd mcp-server
pnpm install
pnpm run dev

# Terminal 2: Build and install VSCode Gateway (one-time setup)
cd vscode-internals-gateway
pnpm install
pnpm run build
pnpm run package
code --install-extension vscode-internals-gateway-*.vsix --force

# Reload VSCode: Cmd/Ctrl + R
```

### Using with AI Assistants

Once both components are running:

1. **For Claude Desktop/Claude Code**: Add to your MCP settings:
```json
{
  "mcpServers": {
    "token-saver": {
      "url": "http://127.0.0.1:9700/mcp"
    }
  }
}
```

2. **For other AI tools**: Point them to the MCP server endpoint:
```
http://127.0.0.1:9700/mcp
```

## Architecture Overview

```
┌─────────────────────────────────────────┐
│            VSCode                        │
│  ┌────────────────────────────────────┐  │
│  │  VSCode Internals Gateway          │  │
│  │  Port: 9600 (auto-discovered)      │  │
│  └──────────────┬─────────────────────┘  │
└─────────────────┼────────────────────────┘
                  │ HTTP
┌─────────────────▼────────────────────────┐
│         MCP Server                       │
│         Port: 9700                       │
│         - MCP Protocol                   │
│         - Chrome DevTools Protocol       │
│         - 31 tools total                 │
└─────────────────┬────────────────────────┘
                  │ MCP
┌─────────────────▼────────────────────────┐
│      AI Assistants                       │
│      (Claude, Cursor, etc.)              │
└───────────────────────────────────────────┘
```

## Troubleshooting

### VSCode Gateway Issues

**Extension not activating:**
- Ensure VSCode was restarted after installation
- Check Output panel → "VSCode Internals Gateway" for errors
- Verify no port conflicts on 9600

**Port conflicts:**
- Gateway automatically tries next available port
- Check `.vscode_gateway_port` file for actual port in use
- Status bar shows actual port being used

### MCP Server Issues

**Server not starting:**
- Check if port 9700 is already in use
- Verify `.vscode_gateway_port` file exists if gateway is on non-default port
- Check console output for connection errors

**Cannot connect to VSCode Gateway:**
- Ensure VSCode is running with the gateway extension installed
- Verify gateway port matches what MCP server expects
- Check firewall settings for localhost connections

**Dashboard not loading:**
- Clear browser cache
- Try incognito/private browsing mode
- Check browser console for errors

### Common Issues

**"Gateway not found" error:**
1. Install and activate the VSCode Gateway extension first
2. Reload VSCode
3. Wait for gateway startup notification
4. Then start the MCP server

**Tools not working:**
1. Open a file in VSCode (activates Language Server)
2. Ensure you're in a project with the relevant language files
3. Check tool requirements in README_USAGE_GUIDE.md

## Development Workflow

### For VSCode Gateway Changes

1. Make changes in `vscode-internals-gateway/src/`
2. Run `pnpm run build`
3. Run `pnpm run package`
4. Reinstall: `code --install-extension vscode-internals-gateway-*.vsix --force`
5. Reload VSCode

### For MCP Server Changes

1. Make changes in `mcp-server/src/`
2. If running `pnpm run dev`, changes auto-reload
3. Otherwise: `pnpm run build && pnpm start`
4. No VSCode restart needed!

### For Testing Both Components

```bash
# Run MCP server tests
cd mcp-server
pnpm test

# Test the complete system
cd mcp-server
pnpm run test:integration
```

## Production Deployment

### VSCode Gateway
- Build once: `pnpm run package`
- Distribute the `.vsix` file
- Users install once and rarely need updates

### MCP Server
- Can be deployed as a standalone Node.js service
- Docker support: `docker build -t token-saver-mcp .`
- Supports environment-based configuration
- Can run on separate machine from VSCode (requires network config)

## Version Management

- VSCode Gateway: Stable, rarely changes (currently v2.1.0)
- MCP Server: Actively developed, frequent updates (currently v1.2.0)
- Components are version-independent and maintain compatibility

## Additional Resources

- [README.md](README.md) - Project overview and features
- [README_USAGE_GUIDE.md](README_USAGE_GUIDE.md) - Complete tool documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [docs/PATTERN_INNOVATION.md](docs/PATTERN_INNOVATION.md) - Architectural insights