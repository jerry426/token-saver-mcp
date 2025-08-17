# Token Saver MCP - Complete Overview

## 🎯 What is Token Saver MCP?

Token Saver MCP is a revolutionary VSCode extension that provides **TWO complementary sets of tools** that work together to give AI assistants unprecedented full-stack development capabilities:

### 🔍 Set 1: Language Server Protocol (LSP) Tools
**Purpose**: Navigate and understand code with 100-1000x efficiency
- 17 tools for code intelligence
- Direct access to VSCode's already-computed language understanding
- Saves 90-99% of tokens compared to text searching
- **Domain**: Backend, server-side, code analysis

### 🌐 Set 2: Chrome DevTools Protocol (CDP) Tools  
**Purpose**: Control and debug web browsers programmatically
- 13+ tools for browser automation and testing
- Complete control over Chrome/Edge browsers
- Real-time JavaScript execution and debugging
- **Domain**: Frontend, client-side, browser testing

## 🚀 The Revolutionary Combination

**Traditional Development**:
- Developer writes backend code → Manually tests in browser
- Developer sees browser error → Manually searches backend code
- Context switching between IDE and browser is constant

**With Token Saver MCP**:
- AI writes backend code → AI tests in browser automatically
- AI sees browser error → AI fixes backend code immediately
- Zero context switching - AI controls both environments

## 📊 Why This Changes Everything

### The Math:
1. **LSP Tools alone**: 90-99% token savings on code navigation
2. **This leaves**: 95%+ of context window available
3. **CDP Tools use**: That remaining context for browser control
4. **Result**: 10,000x productivity multiplication

### The Paradigm Shift:
- **Before**: AI suggests code, human tests it
- **Now**: AI writes code AND tests it
- **Impact**: AI becomes a true full-stack developer

## 🛠️ Tool Categories

### LSP Tools (Backend/Code)
```
Core Navigation:
- get_definition        → Jump to symbol definition
- get_references       → Find all usages
- get_hover           → Get type information

Code Understanding:
- get_document_symbols → File structure
- get_call_hierarchy  → Function call traces
- get_implementations → Find implementations

Code Modification:
- rename_symbol       → Refactor across files
- get_code_actions    → Get available fixes

Code Quality:
- get_diagnostics     → Errors and warnings
- get_semantic_tokens → Syntax highlighting
```

### CDP Tools (Frontend/Browser)

**Low-Level Control**:
```
- execute_in_browser  → Run any JavaScript
- navigate_browser    → Go to any URL
- get_browser_console → Capture console messages
- click_element       → Click via CSS selector
- type_in_browser     → Fill forms
- take_screenshot     → Visual verification
```

**High-Level Helpers**:
```
- test_react_component    → Complete React testing
- test_api_endpoint       → API + CORS testing
- test_form_validation    → Form submission testing
- check_page_performance  → Performance analysis
- debug_javascript_error  → Error debugging
```

## 📚 Documentation Structure

Due to the comprehensive nature of Token Saver MCP, documentation is organized into focused guides:

### Core Documentation:
1. **CLAUDE-MCP-USER.md** - LSP tools usage guide (primary)
2. **BROWSER_HELPERS_DOCUMENTATION.md** - CDP browser helpers guide
3. **AI_BROWSER_USAGE_GUIDE.md** - Browser automation strategies
4. **CDP_BROWSER_INTEGRATION.md** - Technical CDP details

### Quick Reference:
- **For code navigation**: Start with CLAUDE-MCP-USER.md
- **For browser testing**: Start with BROWSER_HELPERS_DOCUMENTATION.md
- **For debugging**: Use both LSP and CDP tools together

## 🔄 Common Workflows

### Full-Stack Development Flow:
```
1. Write backend API (LSP: get_definition, rename_symbol)
2. Launch browser (CDP: navigate_browser)
3. Test API from browser (CDP: test_api_endpoint)
4. Debug any errors (CDP: debug_javascript_error)
5. Fix backend code (LSP: get_references, edit)
6. Verify fix works (CDP: execute_in_browser)
```

### Debugging Flow:
```
1. User reports error
2. Navigate to page (CDP: navigate_browser)
3. Reproduce error (CDP: debug_javascript_error)
4. Find error source (LSP: get_definition)
5. Fix code (LSP: rename_symbol, edit)
6. Test fix (CDP: test_react_component)
```

## 🎓 Key Principles

1. **LSP First**: Always try Token Saver MCP tools before grep/find
2. **CDP for Browser**: Use browser tools for anything client-side
3. **Combine Both**: Maximum power comes from using both together
4. **Efficiency Matters**: Token Saver MCP exists to maximize context efficiency

## 🚦 Getting Started

### First Time Setup:
1. Ensure Token Saver MCP extension is installed in VSCode
2. MCP server starts automatically at `http://127.0.0.1:9527/mcp`
3. Chrome/Edge should be installed for browser features

### For AI Assistants:
1. Read the appropriate documentation based on task:
   - Code work → CLAUDE-MCP-USER.md
   - Browser work → BROWSER_HELPERS_DOCUMENTATION.md
2. Use `get_instructions` tool to access latest guide
3. Combine LSP and CDP tools for full-stack tasks

## 🌟 Remember

Token Saver MCP isn't just about saving tokens - it's about giving AI the same capabilities as a senior full-stack developer:
- **See** the code structure (LSP)
- **Understand** the relationships (LSP)
- **Test** in real browsers (CDP)
- **Debug** with full visibility (Both)
- **Fix** with confidence (Both)

This is the future of AI-assisted development - where AI doesn't just suggest, it DOES.