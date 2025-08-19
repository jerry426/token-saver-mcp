# Token Saver MCP - AI Usage Quick Start

## What You Have Access To

Token Saver MCP provides **30+ tools** across two domains:

### 🔍 17 LSP Tools (Code/Backend)
- Navigate code instantly
- Understand relationships
- Refactor safely
- Find errors

### 🌐 13+ CDP Tools (Browser/Frontend)  
- Control Chrome completely
- Test React components
- Debug JavaScript errors
- Measure performance

## Documentation Map

```
TOKEN_SAVER_OVERVIEW.md
├── Complete overview of both toolsets
├── Why they're revolutionary together
└── Common workflows

AI-MCP-USER.md
├── LSP tools detailed guide
├── Code navigation patterns
└── Performance comparisons

BROWSER_HELPERS_DOCUMENTATION.md
├── CDP browser tools guide
├── 5 high-level helpers explained
└── When to use each tool

AI_BROWSER_USAGE_GUIDE.md
├── Browser automation strategies
├── Debugging workflows
└── Advanced techniques
```

## Quick Decision Tree

```
Need to find code? → Use LSP tools (get_definition, get_references)
Need to test UI? → Use CDP tools (test_react_component, test_form_validation)
Need to debug? → Use both (debug_javascript_error + get_definition)
Need API testing? → Use CDP (test_api_endpoint)
Need refactoring? → Use LSP (rename_symbol, get_references)
```

## The Power of Both

**Scenario**: User reports "Login button doesn't work"

```
Without Token Saver MCP:
1. Manually search for login code (slow)
2. Open browser, try to reproduce (manual)
3. Check console (manual)
4. Search for error source (slow)
5. Fix and test (manual)

With Token Saver MCP:
1. navigate_browser("/login") - Open login page
2. debug_javascript_error() - Capture the error
3. get_definition() - Jump to error source
4. Fix the code
5. test_form_validation() - Verify fix works
```

## Remember

- **LSP tools** = Backend, code, server-side
- **CDP tools** = Frontend, browser, client-side
- **Together** = Complete full-stack capabilities

Start with TOKEN_SAVER_OVERVIEW.md for the big picture, then dive into specific guides as needed.