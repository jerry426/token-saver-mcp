# Token Saver MCP v2.0 - Split Architecture

## 🎯 The Problem with v1.0

The original Token Saver MCP was a monolithic VSCode extension. This meant:
- **Every code change** required rebuilding and reinstalling the extension
- **Debugging was painful** - VSCode extension debugging is complex
- **No hot reload** - lose context on every change
- **Language lock-in** - must use TypeScript/JavaScript
- **Version coupling** - MCP server tied to VSCode extension version

## 💡 The Solution: Split Architecture

We're splitting Token Saver MCP into two independent components:

### 1. **VSCode Internals Gateway** (VSCode Extension)
- **Thin, stable layer** - rarely needs updates
- **Universal API gateway** - exposes ALL VSCode commands
- **Install once, use forever** - no constant reinstalling
- **Generic and reusable** - any external tool can use it

### 2. **Token Saver MCP Server** (Standalone App)
- **Regular Node.js app** - run with `npm run dev`
- **Hot reload** - instant updates with `tsx watch`
- **Language agnostic** - could be Python, Go, Rust...
- **Easy debugging** - standard Node.js debugging tools
- **Version independent** - update without touching VSCode

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         VSCode                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │        VSCode Internals Gateway Extension          │     │
│  │                                                     │     │
│  │  - Exposes: /execute-command                       │     │
│  │  - Exposes: /languages-api                         │     │
│  │  - Exposes: /workspace-api                         │     │
│  │  - Exposes: /window-api                            │     │
│  │  - Port: 9600 (configurable)                       │     │
│  └──────────────────────┬─────────────────────────────┘     │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTP
                          │
┌─────────────────────────┴────────────────────────────────────┐
│           Token Saver MCP Server (Standalone)                │
│                                                               │
│  - Runs independently: npm run dev                           │
│  - Hot reload with tsx watch                                 │
│  - Connects to gateway on port 9600                          │
│  - Serves MCP protocol on port 9527                          │
│  - All 30 tools work through gateway                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              VSCode Gateway Client                   │    │
│  │  - executeCommand('vscode.executeDefinitionProvider')│    │
│  │  - languagesApi('getDiagnostics')                    │    │
│  │  - workspaceApi('findFiles')                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                          │
                          │ MCP Protocol / REST API
                          │
┌─────────────────────────┴────────────────────────────────────┐
│              AI Assistants (Claude, GPT, etc.)               │
└───────────────────────────────────────────────────────────────┘
```

## 🚀 Development Workflow

### Initial Setup (One Time)
```bash
# 1. Install VSCode Internals Gateway in VSCode
cd vscode-internals-gateway
npm install
npm run compile
# Install in VSCode using F5 or package as VSIX

# 2. Set up standalone server
cd standalone-server
npm install
```

### Daily Development
```bash
# Just run the standalone server with hot reload!
cd standalone-server
npm run dev

# Make changes - they reload instantly
# No VSCode reinstall needed!
```

## 🔧 How It Works

### Gateway Extension (vscode-internals-gateway)
```typescript
// Ultra-simple forwarding
app.post('/execute-command', async (req, res) => {
  const { command, args } = req.body
  const result = await vscode.commands.executeCommand(command, ...args)
  res.json({ success: true, result })
})
```

### Standalone Server (token-saver-mcp-server)
```typescript
// Calls through gateway instead of direct VSCode
async function getDefinition(uri: string, line: number, character: number) {
  const gateway = getGatewayClient()
  return gateway.executeCommand(
    'vscode.executeDefinitionProvider',
    uri,
    { line, character }
  )
}
```

## 🎉 Benefits

1. **10x Faster Development**
   - Change code → Save → Already running
   - No rebuild, no reinstall, no restart VSCode

2. **Better Debugging**
   - Use Chrome DevTools, VSCode debugger, or any Node.js tool
   - Set breakpoints in running code
   - Inspect variables in real-time

3. **Language Freedom**
   - Gateway speaks HTTP - use any language
   - Write Token Saver MCP in Python? Go? Rust? Yes!

4. **Deployment Flexibility**
   - Run MCP server locally or remotely
   - Multiple MCP servers can share one gateway
   - Version servers independently

5. **Universal Gateway**
   - Other tools can use the same gateway
   - One extension enables unlimited external tools
   - Becomes infrastructure for VSCode automation

## 📦 Migration Path

1. **Phase 1**: Create gateway and test with one tool ✅
2. **Phase 2**: Migrate all 30 tools to use gateway
3. **Phase 3**: Add hot reload and development tools
4. **Phase 4**: Package for easy distribution
5. **Phase 5**: Explore multi-language implementations

## 🔮 Future Possibilities

- **Remote MCP Servers**: Run on a powerful server, use locally
- **Multiple MCP Servers**: Different servers for different languages
- **Plugin System**: Drop in new tools without modifying core
- **Web UI**: Control panel for managing MCP servers
- **Cloud Deployment**: MCP-as-a-Service

## 🎯 Key Insight

By separating the **stable VSCode interface** (gateway) from the **rapidly evolving MCP logic** (server), we get the best of both worlds:
- **Stability** where we need it (VSCode extension)
- **Agility** where we want it (MCP server)

This is the same pattern used by:
- Language servers (LSP)
- Debug adapters (DAP)
- Database drivers
- Microservice architectures

We're just applying proven architectural patterns to make development 10x more pleasant!