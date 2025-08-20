# VSCode Internals Gateway

**Complete programmatic control of VSCode via HTTP**

Turn VSCode into a programmable robot that external programs can control through simple HTTP calls.

## 🚀 What is this?

A lightweight VSCode extension that exposes ALL of VSCode's internal APIs via HTTP endpoints, enabling:

- **External programs** to control every aspect of VSCode
- **Any programming language** (Python, Go, Rust, etc.) to integrate with VSCode  
- **Hot-reloadable development** - no more rebuilding extensions!
- **Remote control** of VSCode instances
- **Automation** of complex workflows
- **AI assistants** to actually control your editor

## 💡 Why?

Because:
- Rebuilding and reinstalling extensions for every change is **painful**
- You should be able to use **any language** to control VSCode
- IDE integration shouldn't require learning complex extension APIs
- Development should be **fast and fun**

## 🎯 Key Features

### Complete VSCode Control
- Execute any VSCode command
- Access workspace, window, editor, debug, and terminal APIs
- Control UI elements (notifications, sidebars, panels)
- Manage extensions and settings
- Full Language Server Protocol access

### Universal HTTP API
```python
# Control VSCode from Python!
import requests

gateway = "http://localhost:9600"

# Execute any command
requests.post(f"{gateway}/execute-command", json={
    "command": "editor.action.formatDocument"
})

# Access workspace
requests.post(f"{gateway}/workspace-api", json={
    "method": "findFiles",
    "args": ["**/*.ts"]
})
```

### 60x Faster Development
- **Traditional**: Edit → Build → Package → Install → Reload (30-60 seconds)
- **With Gateway**: Edit → Save (instant hot reload!)

## 📦 Installation

### Quick Start
1. Install the VSCode Internals Gateway extension
2. Extension auto-starts on port 9600 (configurable)
3. Start making HTTP requests!

### From Source
```bash
cd vscode-internals-gateway
npm install
npm run compile
# Press F5 in VSCode to run
```

## 🔧 API Endpoints

### `/execute-command`
Execute any VSCode command with arguments
```json
POST /execute-command
{
  "command": "vscode.executeDefinitionProvider",
  "args": ["file:///path/to/file.ts", {"line": 10, "character": 5}]
}
```

### `/workspace-api`
Access workspace functionality
```json
POST /workspace-api
{
  "method": "findFiles",
  "args": ["**/*.js", "**/node_modules/**"]
}
```

### `/window-api`
Control VSCode UI
```json
POST /window-api
{
  "method": "showInformationMessage",
  "args": ["Build completed successfully!"]
}
```

### `/languages-api`
Access language features
```json
POST /languages-api
{
  "method": "getDiagnostics",
  "args": ["file:///path/to/file.ts"]
}
```

### `/extension-api`
Manage extensions
```json
POST /extension-api
{
  "method": "getExtension",
  "args": ["ms-python.python"]
}
```

## 🌟 Use Cases

### Build Your Own Copilot
```python
def smart_complete(file_path, line, char):
    # Get context
    context = gateway.execute_command("vscode.executeHoverProvider", ...)
    
    # Send to your AI
    suggestion = my_ai_model.complete(context)
    
    # Insert suggestion
    gateway.execute_command("editor.action.insertSnippet", suggestion)
```

### Automate Complex Workflows
```javascript
// Refactor entire codebase
async function refactorAll() {
  const files = await gateway.workspaceApi('findFiles', '**/*.ts')
  for (const file of files) {
    await gateway.executeCommand('vscode.open', file)
    await gateway.executeCommand('editor.action.organizeImports')
    await gateway.executeCommand('editor.action.formatDocument')
    await gateway.executeCommand('workbench.action.files.save')
  }
}
```

### Create External Tools
```go
// Go tool that controls VSCode
func RunTests() {
    gateway.ExecuteCommand("workbench.action.tasks.runTask", "test")
}

func DebugCurrentFile() {
    gateway.ExecuteCommand("workbench.action.debug.start")
}
```

## 🔒 Security

- **Default**: Binds to localhost only (127.0.0.1)
- **Port**: Configurable (default 9600)
- **Future**: Authentication and HTTPS for remote access

## 🤝 Contributing

This is a revolutionary pattern that could change how we build IDE integrations. Contributions welcome!

Ideas for contribution:
- Add more specialized endpoints
- Implement authentication
- Create client libraries for different languages
- Build example integrations

## 📝 Configuration

VSCode settings:
```json
{
  "vscode-internals-gateway.port": 9600,
  "vscode-internals-gateway.enabled": true
}
```

Environment variables for external tools:
```bash
export VSCODE_GATEWAY_PORT=9600
```

## 🚦 Status

**Revolutionary but early!** This pattern is brand new and actively being developed.

## 📖 Documentation

See ARCHITECTURE_v2.md in the parent directory for detailed architecture documentation.

## 📄 License

MIT - Because great ideas should be free to spread!

## 🙏 Acknowledgments

Inspired by the pain of traditional VSCode extension development and the dream of truly programmable editors.

---

**"Why rebuild extensions when you can just make HTTP calls?"**

Built with ❤️ for developers who value their time.