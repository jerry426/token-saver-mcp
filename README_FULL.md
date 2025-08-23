# Token Saver MCP — Full Technical Documentation

This is the **detailed companion README** for Token Saver MCP.  
If you are looking for the shorter overview and quickstart, see [README.md](README.md).  
If you are looking for full tool usage with JSON examples, see [README_USAGE_GUIDE.md](README_USAGE_GUIDE.md).

---

## 📖 Table of Contents

1. [Introduction](#-introduction)  
2. [Architecture](#-architecture)  
   - [Why Split Architecture?](#why-split-architecture)  
   - [Component Diagram](#component-diagram)  
   - [Port System](#port-system)  
3. [Installation](#-installation)  
   - [Quickstart](#quickstart)  
   - [Advanced Installation](#advanced-installation)  
4. [Tools](#-tools)  
   - [LSP Tools](#lsp-tools)  
   - [Browser Tools](#browser-tools)  
   - [Testing Tools](#testing-tools)  
   - [System Tools](#system-tools)  
5. [Buffer Management](#-buffer-management)  
6. [Dashboard & Monitoring](#-dashboard--monitoring)  
7. [Endpoints](#-endpoints)  
8. [Testing & Verification](#-testing--verification)  
9. [Development Workflow](#-development-workflow)  
10. [Contributing](#-contributing)  
11. [Roadmap](#-roadmap)  
12. [License](#-license)  

---

## 📖 Introduction

Token Saver MCP is designed to **transform AI assistants from code suggesters into true full-stack developers**.  

Where most assistants waste context and tokens by streaming raw grep outputs or file contents, Token Saver MCP leverages **language server intelligence** and **real browser automation** to give the AI precise, actionable tools.

**Benefits:**  
- ⚡ **Speed** — operations in milliseconds, not seconds  
- 💸 **Efficiency** — 90–99% fewer tokens → $200+/month saved  
- 🧠 **Focus** — AI stays sharp with a clean context “workbench”  
- 🌐 **Full-stack ability** — backend code, frontend browser, automated tests  

---

## 🏗 Architecture

### Why Split Architecture?

Traditional approaches embed all logic inside a VSCode extension. That makes development slow (every change requires a VSCode restart) and brittle.  

Token Saver MCP introduces a **dual-architecture**:  
- **Stable Gateway (VSCode extension)** — rarely changes, exposes LSP through HTTP  
- **Dynamic MCP Server** — rapidly iterated, hot-reloadable, bridges Gateway/CDP ↔ AI  

This design provides **stability** + **developer velocity**.

---

### Component Diagram

```
AI Assistant
   │
   ▼
MCP Server (port 9700)
   ├── LSP Proxy → VSCode Gateway (port 9600)
   ├── Browser Proxy → Chrome/Edge via CDP
   └── REST/MCP Endpoints
```

- **MCP Server**: Language-agnostic, tool orchestration  
- **VSCode Gateway**: LSP bridge, stable port 9600  
- **Browser (Edge/Chrome)**: controlled via CDP  
- **Dashboard**: live monitoring at port 9700  

---

### Port System

- **9600** → VSCode Gateway (LSP bridge)  
- **9700** → MCP Server (default main port)  
- **9701+** → Optional browser automation channels  

All ports are configurable via setup script.

---

## ⚡ Installation

### Quickstart

```bash
git clone https://github.com/jerry426/token-saver-mcp
cd token-saver-mcp
./mcp setup /path/to/your/project
```

This:  
- Auto-detects ports  
- Configures both Gateway and MCP server  
- Prints out the Claude/Gemini command to connect  

---

### Advanced Installation

#### Requirements
- Node.js (>=18)  
- Python3 (>=3.9)  
- pnpm  
- VSCode (>=1.80)  
- Chrome/Edge  

#### Build & Run

```bash
# VSCode Gateway
cd vscode-gateway
pnpm install
pnpm run build

# MCP Server
cd ../mcp-server
pnpm install
pnpm run dev
```

#### Configuration

Edit `config/mcp.config.json`:

```json
{
  "gatewayPort": 9600,
  "serverPort": 9700,
  "projectRoot": "/absolute/path/to/project",
  "browsers": ["edge", "chrome"]
}
```

---

## 🧰 Tools

Token Saver MCP provides **31 tools**, grouped into four categories.

### LSP Tools
- `get_definition` — resolve function/class definition  
- `get_references` — find all usages  
- `rename_symbol` — safe project-wide refactor  
- `get_hover` — type info / docs  
- `get_completion` — autocomplete suggestions  
- `get_diagnostics` — linting & errors  
- `get_symbols` — file symbol outline  
- `find_implementations` — interface/abstract class resolution  
- `get_type_hierarchy` — inheritance tree  
- `semantic_tokens` — syntax highlighting info  
- `signature_help` — function signature assistance  
- `format_code` — language-aware formatting  
- `apply_workspace_edit` — project-wide edits  
- `code_action` — quick fixes & refactorings  

### Browser Tools
- `navigate_browser` — open URL  
- `execute_in_browser` — run JS in page  
- `click_element` — simulate click  
- `type_text` — type into fields  
- `take_screenshot` — save screenshot  
- `get_browser_console` — retrieve console logs  
- `inspect_element` — query DOM node  
- `get_performance_metrics` — Core Web Vitals  

### Testing Tools
- `test_react_component` — run component tests  
- `test_api_endpoint` — check HTTP responses  
- `check_page_performance` — lighthouse-style metrics  
- `validate_schema` — API response schema validation  
- `mock_network_request` — intercept API calls  

### System Tools
- `get_instructions` — system intro + available tools  
- `retrieve_buffer` — view in-memory buffer  
- `update_buffer` — apply buffer modifications  
- `get_supported_languages` — list available LSPs  

📚 For full JSON request/response examples, see [README_USAGE_GUIDE.md](README_USAGE_GUIDE.md).

---

## 🗂 Buffer Management

One of the unique advantages:  
- **AI can hold a scratchpad buffer** separate from disk.  
- Tools like `retrieve_buffer` and `update_buffer` let the AI experiment in-memory before committing changes.  
- Prevents “file overwrite disasters” and allows iterative refinement.  

---

## 📊 Dashboard & Monitoring

Visit `http://127.0.0.1:9700/dashboard` to view:  
- Active connections (Claude, Gemini, etc.)  
- Recent tool invocations  
- Average response latency  
- Token & cost savings (estimated)  
- Browser session status  

---

## 🔌 Endpoints

- `/mcp` → Standard MCP JSON-RPC  
- `/mcp-gemini` → Gemini-friendly MCP  
- `/mcp/simple` → Simple REST (debugging & testing)  
- `/dashboard` → Web dashboard  

---

## 🔬 Testing & Verification

Run built-in tests:

```bash
python3 test/test_mcp_tools.py
```

Expected tests cover:  
- Hover  
- Completion  
- Definition  
- References  
- Diagnostics  
- Semantic tokens  
- Buffer retrieval  

All should pass ✅.

---

## 🛠 Development Workflow

```bash
pnpm install
pnpm run dev       # hot reload server
pnpm run build
pnpm run test
```

Hot reload enables you to update MCP tools instantly without restarting VSCode.

Code layout:  
```
/mcp-server
  /tools
    /lsp
    /cdp
    /testing
    /system
/vscode-gateway
  extension.ts
  lspBridge.ts
```

---

## 🤝 Contributing

We welcome PRs for:  
- New tool implementations  
- Optimizations to buffer management  
- Browser/CDP extensions  
- New testing harnesses  

Please follow:  
- Prettier + ESLint config  
- Conventional commits (`feat:`, `fix:`, `docs:`)  
- Run `pnpm run test` before PR  

---

## 📍 Roadmap

- 🔧 More browser automation (multi-tab, network request interception)  
- 📦 Plugin ecosystem (toolpacks installable via npm)  
- 🌐 Multi-assistant orchestration (Claude + Gemini + others working together)  
- 🧠 Extended AI memory management  

---

## 📄 License

MIT License. Free for personal & commercial use.  

---

👉 Next steps:  
- Read [README.md](README.md) for quickstart  
- Explore [README_USAGE_GUIDE.md](README_USAGE_GUIDE.md) for full JSON examples  
- Build your own tools with hot reload in `/mcp-server/tools`  

