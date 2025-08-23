# Token Saver MCP — AI as a Full-Stack Developer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)  
[![GitHub stars](https://img.shields.io/github/stars/jerry426/token-saver-mcp)](https://github.com/jerry426/token-saver-mcp)

> **Transform AI from a code suggester into a true full-stack developer — with instant access to code intelligence and real browser control.**

📚 [**Full Usage Guide & Examples →**](README_USAGE_GUIDE.md) |  
📝 [Changelog](CHANGELOG.md) |  
📖 [Detailed Technical README →](README_FULL.md)

---

## 🚀 What is Token Saver MCP?

Modern AI coding assistants waste enormous context (and your money) by stuffing full grep/search results into the model window. That leads to:

- ❌ Slow lookups (seconds instead of milliseconds)  
- ❌ Thousands of wasted tokens per query  
- ❌ AI “losing its train of thought” in cluttered context  

**Token Saver MCP fixes this.**

It gives AI assistants **direct access to VSCode’s Language Server Protocol (LSP)** and the **Chrome DevTools Protocol (CDP)**, so they can work like *real developers*:  
- Instantly navigate & refactor code  
- Run code in a real browser (Edge/Chrome)  
- Test, debug, and verify changes themselves  

**Result:** 90–99% fewer tokens, 100–1000× faster responses, and $200+ in monthly savings — while enabling AI to truly act as a full-stack engineer.

---

## ✨ Why Token Saver?

Think of your AI’s context window like a **workbench**. If it’s cluttered with logs, search dumps, and irrelevant snippets, the AI can’t focus.  

**Token Saver MCP keeps the workbench clean.**

### 🔍 Without Token Saver
```text
grep -r "renderProfileImage" .
# 5000+ tokens, 10–30 seconds, bloated context
```

### ⚡ With Token Saver
```text
get_definition('src/components/UserCard.js', 25)
# 50 tokens, <100ms, exact location + type info
```

**Cleaner context = a sharper, more persistent AI assistant.**

---

## 🏗️ Revolutionary Dual Architecture

Token Saver MCP uses a **split architecture** designed for speed and stability:

```
AI Assistant ←→ MCP Server ←→ VSCode Gateway ←→ VSCode Internals
               (hot reload)   (stable interface)
```

- 🏗️ **VSCode Gateway Extension**  
  - Installed once, rarely updated  
  - Exposes VSCode’s LSP via HTTP (port 9600)  

- 🚀 **Standalone MCP Server**  
  - Hot reloadable — no VSCode restarts  
  - Language-agnostic (JS/TS, Python, Go, Rust…)  
  - Bridges MCP protocol ↔ VSCode Gateway + CDP (port 9700 by default)  

**Why it matters:** You can iterate on MCP tools instantly without rebuilding/restarting VSCode. Development is 60× faster and much more reliable.

---

## 🧰 What You Get

Token Saver MCP currently provides **31 production-ready tools** across four categories:

- **LSP Tools (14)** → `get_definition`, `get_references`, `rename_symbol`, `get_hover`, `find_implementations`, …  
- **Browser Tools (8)** → `navigate_browser`, `execute_in_browser`, `take_screenshot`, `get_browser_console`, …  
- **Testing Helpers (5)** → `test_react_component`, `test_api_endpoint`, `check_page_performance`, …  
- **System Tools (4)** → `get_instructions`, `retrieve_buffer`, `get_supported_languages`, …  

📚 See the full [Usage Guide with JSON examples →](README_USAGE_GUIDE.md)

---

## 📊 Proven Results

| Operation | Traditional (grep/search) | With Token Saver MCP | Time Saved |
|-----------|----------------------------|----------------------|------------|
| Find function definition | 5–10s, 5k tokens | **10ms, 50 tokens** | ☕ Coffee break |
| Find all usages | 10–30s | **50ms** | 💭 Keep coding |
| Rename symbol project-wide | Minutes | **100ms** | 🚀 Already done |

**Token & Cost Savings (GPT-4 pricing):**

- Tokens per search: 5,000 → **50**  
- Cost per search: $0.15 → **$0.0015**  
- Typical dev workflow: **$200+ saved per month**  

---

## 🌐 Browser Control (Edge-Optimized)

Beyond backend code, Token Saver MCP empowers AI to **control a real browser** through CDP:  

- Launch Edge/Chrome automatically  
- Click, type, navigate, capture screenshots  
- Run frontend tests & debug JS errors in real-time  
- Analyze performance metrics  

Example workflow:  
1. AI writes backend API (LSP tools)  
2. AI launches browser & tests API (CDP tools)  
3. AI sees error logs instantly  
4. AI fixes backend code (LSP tools)  
5. AI verifies fix in browser  

➡️ No more “please test this manually” — AI tests itself.

---

## 🖥️ Real-Time Dashboard

Visit `http://127.0.0.1:9700/dashboard` to monitor:

- Server status & connection health  
- Request metrics & response times  
- Token & cost savings accumulating live  
- Tool usage statistics  

Perfect for seeing your AI’s efficiency gains in action.

---

## ⚡ Quickstart (30 Seconds)

```bash
# Clone repo
git clone https://github.com/jerry426/token-saver-mcp
cd token-saver-mcp

# One-step setup
./mcp setup /path/to/your/project
```

That’s it! The installer:  
- Finds open ports  
- Creates config files  
- Tests connection  
- Provides the Claude/Gemini command  

➡️ Full installation & build steps: [Detailed README →](README_FULL.md)

---

## 🔌 Supported AI Assistants

- **Claude Code** → works out of the box with MCP endpoint  
- **Gemini CLI** → use `/mcp-gemini` endpoint  
- **Other AI tools** → MCP JSON-RPC, streaming, or simple REST endpoints available  

Endpoints include:  
- `http://127.0.0.1:9700/mcp` (standard MCP)  
- `http://127.0.0.1:9700/mcp-gemini` (Gemini)  
- `http://127.0.0.1:9700/mcp/simple` (REST testing)  
- `http://127.0.0.1:9700/dashboard` (metrics UI)  

---

## 🔬 Verify It Yourself

Think the claims are too good to be true? Run the built-in test suite:

```bash
python3 test/test_mcp_tools.py
```

Expected output shows: hover, completions, definitions, references, diagnostics, semantic tokens, buffer management, etc. — all passing ✅

---

## 🛠️ Development

```bash
pnpm install
pnpm run dev       # hot reload
pnpm run build
pnpm run test
```

MCP server lives in `/mcp-server/`, with modular tools organized by category (`lsp/`, `cdp/`, `helper/`, `system/`).  

See [Full Technical README →](README_FULL.md) for architecture diagrams, tool JSON schemas, buffer system details, and contributing guide.

---

## 📍 Roadmap / Vision

Token Saver MCP already unlocks **full-stack AI workflows**. Next up:  

- 🔧 More browser automation tools (multi-tab, network control)  
- 📦 Plugin ecosystem for custom toolpacks  
- 🌐 Multi-assistant coordination (Claude + Gemini + others)  
- 🧠 Expanded context management strategies  

---

## 📄 License

MIT — free for personal and commercial use.  

---

👉 **Start today**:  
- Run `./mcp setup`  
- Tell your AI: *“Use the get_instructions tool to understand Token Saver MCP.”*  
- Watch your AI become a focused, cost-efficient, full-stack developer.  

📚 For in-depth details:  
- [Usage Guide & Examples](README_USAGE_GUIDE.md)  
- [Full Technical README](README_FULL.md)  
