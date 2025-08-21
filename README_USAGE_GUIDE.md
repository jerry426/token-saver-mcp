# Token Saver MCP - Usage Guide

<!-- AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Generated from modular tool definitions on 2025-08-21T05:44:57.382Z -->
<!-- Version: 1.1.0 -->

## 🎯 Quick Overview

Token Saver MCP provides **31 tools** organized by category:
- **14 LSP tools** - Code navigation and intelligence
- **8 CDP tools** - Browser automation and control
- **5 Helper tools** - High-level testing utilities
- **4 System tools** - Utilities and meta functions

**Server URL**: `http://127.0.0.1:9700/mcp` (automatically handles port conflicts)
**Performance**: 100-1000x faster than text search, saves 90-99% of tokens

## 📋 THIS FILE CONTAINS EVERYTHING YOU NEED

**No additional documentation reading required!** This comprehensive guide is auto-generated from the tool definitions themselves, ensuring it's always accurate and up-to-date.

## 🔧 Complete Tool Reference

### Code Navigation (LSP) - 14 Tools

Tools for navigating and understanding code using Language Server Protocol:

---

#### `rename_symbol`
**Safely rename variables, functions, classes across entire codebase**

Rename a symbol across the workspace.

**Example:**
```javascript
rename_symbol({
  uri: "file:///src/utils/helpers.ts",
  line: 15,
  character: 10,
  newName: "validateUserEmail"
})
// Renames validateEmail() everywhere it's used
```

**Tips:**
- Use get_references first to preview all affected locations
- Handles imports, exports, and type annotations automatically
- Preserves semantic meaning - won't rename unrelated symbols
- Check get_diagnostics after rename to ensure no errors

**Performance:**
- Speed: < 1s for typical symbols, longer for heavily-used ones
- Token Savings: 99% vs manual find-and-replace

---

#### `get_type_definition`
**Navigate to where a type is defined (interfaces, classes, type aliases)**

Get the type definition location of a symbol.

**Example:**
```javascript
get_type_definition({
  uri: "file:///src/user/profile.ts",
  line: 15,
  character: 10
})
// From "const user: User" -> jumps to interface User definition
```

**Tips:**
- Different from get_definition - shows type/interface, not implementation
- Particularly useful in TypeScript for understanding type relationships
- Use on variables, parameters, return types to see their type definitions
- Combines well with get_implementations to see all type implementers

**Performance:**
- Speed: < 50ms
- Token Savings: 95-99% vs searching for type definitions manually

---

#### `get_semantic_tokens`
**Get detailed semantic analysis for syntax highlighting and code understanding**

Get semantic tokens (detailed syntax highlighting) for a document.

**Example:**
```javascript
get_semantic_tokens({
  uri: "file:///src/api/users.ts"
})
// Returns: variables, functions, classes, types with semantic info
```

**Tips:**
- Provides richer information than basic syntax highlighting
- Shows variable scopes, function signatures, type information
- Essential for advanced refactoring and code transformation
- Large files automatically buffered to save tokens

**Performance:**
- Speed: < 300ms for typical files
- Token Savings: 70-90% vs manually parsing code structure

---

#### `get_references`
**Find everywhere a symbol is used across the entire codebase**

Find all references to a symbol.

**Example:**
```javascript
get_references({
  uri: "file:///src/utils/helpers.ts",
  line: 15,
  character: 10
})
// Returns: all places where validateEmail() is called
```

**Tips:**
- Use before renaming/refactoring to understand impact
- Includes both reads and writes to variables
- Shows usage in comments, strings, and documentation
- Large result sets automatically buffered to save tokens

**Performance:**
- Speed: < 500ms for typical symbols
- Token Savings: 95-99% vs manual grep/search

---

#### `get_hover`
**Get documentation, type info, and quick help for any symbol**

Get hover information for a symbol at a given position.

**Example:**
```javascript
get_hover({
  uri: "file:///src/api/users.ts",
  line: 25,
  character: 10
})
// Returns: function signature, JSDoc comments, parameter types
```

**Tips:**
- Hover on function names to see signatures and documentation
- Works on variables to show inferred types and values
- Displays JSDoc comments and TypeScript type information
- Essential for understanding third-party library APIs

**Performance:**
- Speed: < 50ms
- Token Savings: 90-99% vs searching documentation manually

---

#### `get_document_symbols`
**Get file outline with all functions, classes, variables, and their hierarchy**

Get all symbols (classes, methods, functions, variables, etc.) in a document with hierarchical structure.

**Example:**
```javascript
get_document_symbols({
  uri: "file:///src/api/users.ts"
})
// Returns: interfaces, classes, functions, variables with positions
```

**Tips:**
- Provides hierarchical view - classes contain methods, modules contain functions
- Shows symbol ranges for precise navigation
- Includes visibility info (public, private, protected)
- Works as file outline/table of contents for any language

**Performance:**
- Speed: < 200ms for typical files
- Token Savings: 80-95% vs reading entire file

---

#### `get_diagnostics`
**Get all errors, warnings, and suggestions from language servers**

Get diagnostics (errors, warnings, info, hints) for a file or all files.

**Example:**
```javascript
get_diagnostics({
  uri: "file:///src/api/users.ts"
})
// Returns: TypeScript errors, ESLint warnings, etc. for that file
```

**Tips:**
- Omit uri parameter to get workspace-wide diagnostics
- Severity levels: 1=Error, 2=Warning, 3=Information, 4=Hint
- Use with get_code_actions to see available auto-fixes
- Large workspaces auto-buffer results to save tokens

**Performance:**
- Speed: < 200ms for single file, < 1s for workspace
- Token Savings: 80-95% vs reading all error output manually

---

#### `get_definition`
**Jump to where something is defined**

Get the definition location of a symbol.

**Example:**
```javascript
get_definition({
  uri: "file:///src/app.ts",
  line: 45,
  character: 10
})
```

**Tips:**
- Always use absolute file:// URIs, not relative paths
- Use search_text first to find symbols, then get_definition for exact location
- Combines well with get_references to understand code usage

**Performance:**
- Speed: < 50ms
- Token Savings: 95-99% vs reading entire file

---

#### `get_completions`
**Get IntelliSense completion suggestions at cursor position**

Get code completion suggestions for a given position in a document.

**Example:**
```javascript
get_completions({
  uri: "file:///src/api/users.ts",
  line: 25,
  character: 8
})
// After typing "user.pro" - returns "profile", "projects", etc.
```

**Tips:**
- Position cursor exactly where you need suggestions (mid-word, after dot, etc.)
- Results include auto-imports, method signatures, and documentation
- Large result sets are automatically buffered to save tokens
- Use with TypeScript/JavaScript for best IntelliSense experience

**Performance:**
- Speed: < 100ms
- Token Savings: 90-99% vs manually searching documentation

---

#### `get_code_actions`
**Get quick fixes, refactorings, and code improvements available at cursor position**

Get available code actions (quick fixes, refactorings) at a given position.

**Example:**
```javascript
get_code_actions({
  uri: "file:///src/api/users.ts",
  line: 15,
  character: 10
})
// Returns: "Add missing import", "Fix typo", "Declare property", etc.
```

**Tips:**
- Works best when positioned on errors/warnings highlighted in diagnostics
- Returns both quick fixes and refactoring suggestions
- Actions include imports, type fixes, code style improvements
- Use after get_diagnostics to see available fixes for specific issues

**Performance:**
- Speed: < 100ms
- Token Savings: 90-99% vs manually researching fixes

---

#### `get_call_hierarchy`
**Trace function call relationships - who calls this function or what does it call**

Trace function calls - find who calls a function (incoming) or what a function calls (outgoing).

**Example:**
```javascript
get_call_hierarchy({
  uri: "file:///src/api/users.ts",
  line: 25,
  character: 10,
  direction: "incoming"
})
// Returns: all functions that call this function
```

**Tips:**
- Use "incoming" to find callers before modifying a function
- Use "outgoing" to understand function dependencies
- Perfect for impact analysis and refactoring planning
- Shows call hierarchy tree with file locations

**Performance:**
- Speed: < 300ms for typical functions
- Token Savings: 90-95% vs manual code tracing

---

#### `find_text`
**Full text search across entire workspace with smart buffering**

Search for text patterns across all files using ripgrep with intelligent result buffering

**Example:**
```javascript
find_text({
  query: "TODO",
  maxResults: 50
})
// Returns first 50 TODO comments with file locations
```

**Tips:**
- Results are buffered - request more with retrieve_buffer if needed
- Use includes/excludes for precise file filtering
- Returns summary stats when results exceed maxResults
- Regex patterns must be properly escaped
- Use find_symbols for semantic code search instead

**Performance:**
- Speed: < 2s for large workspaces (ripgrep powered)
- Token Savings: 70-95% through intelligent buffering

---

#### `find_symbols`
**Semantic symbol search across entire workspace**

Find symbols (functions, classes, methods, variables) across the workspace using semantic search

**Example:**
```javascript
find_symbols({
  query: "validateEmail"
})
// Finds all functions, methods, or variables named validateEmail
```

**Tips:**
- Uses Language Server Protocol for semantic understanding
- Finds symbols regardless of file location
- Returns exact locations for direct navigation
- More accurate than text search for code elements
- Works best when language servers are active

**Performance:**
- Speed: < 500ms for most workspaces
- Token Savings: 80-95% vs text search for finding symbols

---

#### `find_implementations`
**Find all concrete implementations of interfaces, abstract classes, or virtual methods**

Find all implementations of an interface or abstract class.

**Example:**
```javascript
find_implementations({
  uri: "file:///src/types/api.ts",
  line: 15,
  character: 18
})
// From "interface UserService" -> finds all classes implementing it
```

**Tips:**
- Position cursor on interface/abstract class names
- Works for virtual methods to find overrides
- Shows all concrete classes implementing the interface
- Perfect for understanding inheritance hierarchies

**Performance:**
- Speed: < 200ms for typical interfaces
- Token Savings: 95-99% vs manual inheritance search

---


### Browser Control (CDP) - 8 Tools

Tools for browser automation using Chrome DevTools Protocol:

---

#### `wait_for_element`
**Wait for element to become available before interaction**

Wait for an element to appear in the DOM.

**Example:**
```javascript
// Navigate to dynamic page
navigate_browser({ url: "http://localhost:3000/dashboard" })

// Wait for main content to load
wait_for_element({ selector: "#dashboard-content" })

// Now safe to interact
click_element({ selector: "#menu-button" })
```

**Tips:**
- Always wait after navigation for dynamic content
- Use data attributes for reliable waiting
- Essential for SPAs and AJAX-heavy sites
- Prevents "element not found" errors
- Timeout throws error if element never appears

**Performance:**
- Speed: 0ms-timeout (depends on page loading)

---

#### `type_in_browser`
**Type text into any input field using CSS selector**

Type text into an input field in the browser using a CSS selector.

**Example:**
```javascript
type_in_browser({ selector: "#username", text: "john.doe" })
```

**Tips:**
- Clears existing input content before typing
- Works with input, textarea, and contenteditable elements
- Use specific selectors for forms with multiple inputs
- Text is typed as if user is typing (triggers events)
- Check console for validation errors after typing

**Performance:**
- Speed: 100-300ms (plus typing simulation time)

---

#### `take_screenshot`
**Capture visual state of current browser page**

Take a screenshot of the current browser page.

**Example:**
```javascript
// Navigate to page first
navigate_browser({ url: "http://localhost:3000" })

// Take screenshot
take_screenshot({})
```

**Tips:**
- Screenshot is returned as base64 PNG data
- Captures full visible viewport
- Use after navigation to verify page loaded
- Helpful for debugging layout issues
- Can be saved or displayed by AI assistants

**Performance:**
- Speed: 200-800ms (depends on page complexity)

---

#### `navigate_browser`
**Navigate to URL and wait**

Navigate the browser to a specific URL and wait for page load.

**Example:**
```javascript
navigate_browser({ url: "http://localhost:3000" })
```

**Tips:**
- Chrome will auto-launch if not running
- Waits for page load automatically
- Use execute_in_browser if you need to navigate and run JS in one call

**Performance:**
- Speed: 1-3 seconds (network dependent)

---

#### `get_dom_snapshot`
**Capture complete DOM structure with interactive elements**

Get a snapshot of the current DOM including forms, links, and images.

**Example:**
```javascript
// Navigate to page first
navigate_browser({ url: "http://localhost:3000" })

// Then get DOM structure
get_dom_snapshot({})
```

**Tips:**
- Captures all interactive elements (forms, buttons, links)
- Includes element attributes and text content
- Use to discover available selectors
- Helpful for understanding page structure
- Large pages may produce large snapshots

**Performance:**
- Speed: 200ms-1s (depends on page complexity)

---

#### `get_browser_console`
**Retrieve browser console messages with filtering**

Get console messages from the browser (log, error, warning, info, debug). Captures all console output since connection.

**Example:**
```javascript
get_browser_console({})
```

**Tips:**
- Messages persist across navigation
- Use clear: true to reset for fresh debugging
- Timestamps are in ISO format
- Stack traces included for errors
- Filter by type to focus on specific issues

**Performance:**
- Speed: 50-200ms (depending on message count)

---

#### `execute_in_browser`
**Execute JavaScript in browser context**

Execute JavaScript code in the browser context via Chrome DevTools Protocol. Requires Chrome to be running or will launch it automatically.

**Example:**
```javascript
execute_in_browser({ expression: "document.title" })
```

**Tips:**
- Use template literals for multi-line JavaScript
- Return values will be JSON serialized
- Chrome launches automatically if not running
- Use url parameter to navigate before executing
- Timeout after page load is 1 second by default

**Performance:**
- Speed: 500ms-2s (depends on navigation and script complexity)

---

#### `click_element`
**Click any element using CSS selector**

Click an element in the browser using a CSS selector.

**Example:**
```javascript
click_element({ selector: "#submit-button" })
```

**Tips:**
- Use specific selectors to avoid ambiguity
- Wait for elements before clicking if page is still loading
- Check console for click event errors
- Combine with wait_for_element for reliable automation
- Use get_dom_snapshot first to identify correct selectors

**Performance:**
- Speed: 100-500ms (depends on element and page state)

---


### Browser Testing Helpers - 5 Tools

High-level testing utilities that combine multiple operations:

---

#### `test_react_component`
**Complete React component testing workflow**

Complete React component testing workflow with automatic error detection and performance analysis

**Tests Automatically:**
- Component mounting and rendering
- React DevTools availability
- DOM element presence
- Console errors during render
- Component lifecycle execution

**Saves Time By:**
- No need to manually open DevTools
- Automatically captures errors and warnings
- Verifies React fiber structure
- Checks for common React antipatterns
- Provides structured test results

---

#### `test_form_validation`
**Complete form validation testing workflow**

Complete form validation testing workflow with automatic error detection and accessibility checks

**Tests Automatically:**
- Form field validation (client-side)
- HTML5 validation constraints
- Custom validation error messages
- Form submission behavior
- Success/error state handling
- Page redirection after submit
- Console errors during validation

**Saves Time By:**
- No need to manually fill forms repeatedly
- Automatically captures all validation states
- Tests both valid and invalid scenarios
- Detects validation edge cases
- Verifies error message display
- Checks form accessibility

---

#### `test_api_endpoint`
**Complete API endpoint testing workflow from browser context**

Complete API endpoint testing workflow from browser context with CORS validation and timing analysis

**Tests Automatically:**
- HTTP response status and headers
- Response body parsing (JSON/text)
- CORS configuration and headers
- Network timing and performance
- Authentication context preservation
- Error handling and status codes

**Saves Time By:**
- No need to manually open DevTools Network tab
- Automatically checks CORS configuration
- Preserves browser session/cookies
- Tests from actual client context
- Captures timing metrics automatically
- Validates response format

---

#### `debug_javascript_error`
**Complete JavaScript error debugging and analysis workflow**

Complete JavaScript error debugging and analysis workflow with stack trace analysis and fix recommendations

**Tests Automatically:**
- Runtime error capture and stack traces
- Console error collection and categorization
- Unhandled promise rejection detection
- Error source file identification
- Framework-specific error patterns
- Memory usage during errors
- Source map availability
- Environment debugging features

**Saves Time By:**
- No need to manually monitor console constantly
- Automatically captures all error types
- Categorizes errors by common patterns
- Identifies error source files
- Provides debugging recommendations
- Checks for debugging tool availability

---

#### `check_page_performance`
**Complete page performance analysis and optimization workflow**

Complete page performance analysis and optimization workflow with Core Web Vitals and resource breakdown

**Tests Automatically:**
- Page load timing metrics (DOM, resources, paint)
- Core Web Vitals (LCP, FID, CLS)
- Resource breakdown by type (JS, CSS, images, fonts)
- Memory usage and heap analysis
- DOM complexity and node count
- Network timing and resource sizes
- Slowest loading resources identification

**Saves Time By:**
- No need to manually open DevTools Performance tab
- Automatically captures all performance metrics
- Generates optimization recommendations
- Compares against performance budgets
- Identifies performance bottlenecks
- Provides actionable insights

---


### System Tools - 4 Tools

---

#### `retrieve_buffer`
**Retrieve complete data from a buffered response**

Retrieve the full data from a buffered response using its buffer ID

**Example:**
```javascript
retrieve_buffer({ bufferId: "search_12345" })
```

**Tips:**
- Only needed when tools return buffered responses (large datasets)
- Buffer IDs are automatically generated and included in buffered responses
- Buffers expire after 60 seconds for memory management
- Check buffer_stats to see what buffers are available

---

#### `get_supported_languages`
**List all VSCode language registrations and workspace activity**

Get a list of all languages registered in VSCode, organized by category (programming, web, data, etc.). Also shows which languages are currently active in the workspace.

**Example:**
```javascript
get_supported_languages()
```

**Tips:**
- Shows all registered languages (~150+ including extensions)
- Categorizes languages: programming, web, data, config, etc.
- Lists which languages are active in current workspace
- Useful for understanding LSP feature availability
- Programming languages get full LSP support (completions, navigation, etc.)
- Other file types may have limited features

---

#### `get_instructions`
**Get this documentation**

Get comprehensive instructions for ALL Token Saver MCP tools (both LSP and CDP). Returns a complete guide with tool descriptions, decision trees, examples, and workflows for both code navigation and browser control.

**Example:**
```javascript
get_instructions()
```

**Tips:**
- This returns the complete INSTRUCTIONS.md file
- Contains all tool documentation, examples, and workflows
- No need to read any other documentation files

---

#### `get_buffer_stats`
**Monitor buffer system status and available buffers**

Get statistics about currently buffered responses

**Example:**
```javascript
get_buffer_stats()
```

**Tips:**
- Shows all currently available buffer IDs
- Displays buffer sizes, creation times, and expiry info
- Useful for debugging when buffered responses are not found
- Helps understand memory usage of the buffer system

---


## 🔗 Complete Workflows

### Code Navigation Workflow
```javascript
// 1. Search for symbols
const results = search_text({ query: "functionName" })

// 2. Jump to definition
get_definition({ 
  uri: results[0].uri, 
  line: results[0].range.start.line,
  character: results[0].range.start.character
})

// 3. Find all usages
get_references({ /* same params */ })

// 4. Understand types
get_hover({ /* same params */ })

// 5. Refactor safely
rename_symbol({ /* params */, newName: "betterName" })
```

### Browser Testing Workflow
```javascript
// 1. Navigate to application
navigate_browser({ url: "http://localhost:3000" })

// 2. Test React components
test_react_component({
  url: "http://localhost:3000",
  componentName: "App"
})

// 3. Check for errors
get_browser_console({ filter: "error" })

// 4. Test interactions
click_element({ selector: "#submit" })
type_in_browser({ selector: "#email", text: "test@example.com" })

// 5. Verify results
get_dom_snapshot()
```

### Debugging Workflow
```javascript
// 1. Check for code errors
get_diagnostics()

// 2. Debug JavaScript errors
debug_javascript_error({
  url: "http://localhost:3000",
  triggerAction: "document.querySelector('.button').click()"
})

// 3. Analyze performance
check_page_performance({
  url: "http://localhost:3000"
})

// 4. Test API endpoints
test_api_endpoint({
  url: "http://localhost:3000",
  endpoint: "/api/users"
})
```

## 🎯 Quick Decision Tree

```
Finding code?           → search_text → get_definition → get_references
Understanding code?     → get_hover → get_document_symbols
Refactoring?           → rename_symbol (after get_references)
Finding errors?        → get_diagnostics
Testing UI?            → test_react_component, test_form_validation
Testing API?           → test_api_endpoint
Debugging browser?     → debug_javascript_error → get_browser_console
Need interaction?      → click_element, type_in_browser
Performance issues?    → check_page_performance
```

## 💡 Key Rules

1. **ALWAYS use Token Saver tools instead of file system tools**
   - ❌ Don't use: grep, find, glob, cat, head, tail
   - ✅ Do use: search_text, get_definition, get_references

2. **Use high-level helpers when available**
   - ❌ Don't: Multiple execute_in_browser calls
   - ✅ Do: test_react_component (single call)

3. **URIs must be absolute file:// paths**
   - ❌ Wrong: "src/app.ts", "./file.js"
   - ✅ Right: "file:///home/user/project/src/app.ts"

4. **Start with search_text for discovery**
   - First find symbols, then navigate with LSP tools

5. **Check get_diagnostics regularly**
   - Catch errors before they become problems

## 📊 Performance Comparison

### Without Token Saver MCP:
- **Time**: 10-30 seconds per search
- **Tokens**: 5000+ per operation
- **Accuracy**: 60% (text matching misses context)
- **Context Window**: Quickly exhausted

### With Token Saver MCP:
- **Time**: < 100ms per operation
- **Tokens**: ~50 per operation
- **Accuracy**: 100% (semantic understanding)
- **Context Window**: Stays clean

**Result: 100-1000x faster, 90-99% fewer tokens, perfect accuracy**

## Summary

**Token Saver MCP = Your AI-Powered Development Toolkit**

- **Instant code navigation** without reading files
- **Complete browser automation** without manual testing
- **100-1000x performance** improvement over text search
- **90-99% token savings** on every request
- **Always accurate** - semantic understanding, not text matching

This documentation is auto-generated from **31 tools** across **4 categories**. Each tool's documentation lives with its implementation, ensuring accuracy and maintainability.

---
*Generated by [Token Saver MCP](https://github.com/jerry426/token-saver-mcp) v1.1.0*