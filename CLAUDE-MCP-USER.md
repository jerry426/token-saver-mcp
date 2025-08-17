# Token Saver MCP Tools Usage Guide

> **Note for Claude Code**: You can always retrieve the latest version of this guide using the `get_instructions` tool. This ensures you have the most up-to-date usage information.

## 🚨 CRITICAL: Use Token Saver MCP Tools for Code Navigation

**This project has Token Saver MCP tools available. These MUST be your PRIMARY method for code navigation and understanding.**

The Token Saver MCP server provides direct access to VSCode's Language Server Protocol features, offering 100-1000x performance improvements over text-based searching with semantic understanding of code.

## Token Saver MCP Buffer System

The extension includes an intelligent buffer system to prevent token overflow:

### Key Features
- **Automatic Size Detection**: Estimates token count (~4 chars/token)
- **Smart Previews**: Tool-specific intelligent data summaries
- **Depth Truncation**: Automatically limits deeply nested structures
- **Buffer Storage**: Large responses stored with unique IDs for retrieval

### Token Limits
- **Maximum**: 2,500 tokens per response (~10KB JSON)
- **Buffered responses return**: metadata + preview + bufferId
- **Retrieve full data**: Use `retrieve_buffer` tool with the bufferId

### Smart Preview Examples
- **search_text**: Shows first, middle, and last results for better distribution
- **get_document_symbols**: Prioritizes top-level symbols
- **get_references**: Groups by file with counts
- **get_completions**: Categorizes by completion type (method, property, etc.)

## Token Saver MCP Server Connection

### Single VSCode Window
- **Server URL**: `http://127.0.0.1:9527/mcp`

### Multiple VSCode Windows
Each VSCode window runs on a different port. To find your workspace's port:

```bash
python3 test/find_mcp_servers.py
```

This shows all running Token Saver MCP servers with their workspace paths. Use the URL for your specific project.

## Required: Use These Token Saver MCP Tools FIRST

**ALWAYS attempt to use Token Saver MCP tools before falling back to grep/glob/find/read commands.**

### Tool Priority Map

| Task | USE THIS Token Saver MCP Tool | NOT grep/glob/find |
|------|------------------|-------------------|
| **Search for any symbol/text** | `search_text` | ❌ Don't grep for text patterns |
| Find where a function/variable/class is defined | `get_definition` | ❌ Don't grep for "function name" |
| Find where a type is defined | `get_type_definition` | ❌ Don't search for type definitions |
| Find all places where something is used | `get_references` | ❌ Don't grep for text matches |
| Find implementations of an interface/class | `find_implementations` | ❌ Don't grep for "implements" |
| Understand file structure/symbols | `get_document_symbols` | ❌ Don't manually parse files |
| Trace function calls (who calls/called by) | `get_call_hierarchy` | ❌ Don't grep for function calls |
| Check for errors/warnings | `get_diagnostics` | ❌ Don't parse compiler output |
| Get quick fixes for errors | `get_code_actions` | ❌ Don't manually fix issues |
| Understand what a symbol is/does | `get_hover` | ❌ Don't read multiple files |
| Get code suggestions at a position | `get_completions` | ❌ Don't guess what's available |
| Rename a symbol throughout codebase | `rename_symbol` | ❌ Don't find/replace text |
| Get syntax highlighting info | `get_semantic_tokens` | ❌ Don't parse syntax manually |

### Why Token Saver MCP Tools Are Superior

1. **Type-aware**: Understands language semantics, not just text
2. **Instant**: Leverages VSCode's pre-computed indexes
3. **Accurate**: Handles imports, scopes, overloads correctly
4. **Complete**: Finds ALL references, not just text matches
5. **Safe**: Refactoring tools ensure consistency

## Workflow Examples

### When Exploring a Codebase

```
WRONG ❌:
1. Use grep to search for class name
2. Read multiple files to understand structure
3. Use find to locate implementations

RIGHT ✅:
1. Use get_definition to jump to the class
2. Use get_hover to understand its purpose and API
3. Use get_references to see usage patterns
```

### When Refactoring Code

```
WRONG ❌:
1. Search for all occurrences with grep
2. Manually edit each file
3. Hope you didn't miss any

RIGHT ✅:
1. Use get_references to find ALL usages
2. Use rename_symbol for automatic refactoring
3. Let the language server handle it safely
```

### When Understanding Complex Code

```
WRONG ❌:
1. Read file after file trying to trace logic
2. Grep for function calls
3. Manually trace through imports

RIGHT ✅:
1. Use get_hover for instant documentation
2. Use get_definition to jump to implementations
3. Use get_references to understand usage context
```

## Token Saver MCP Tool Parameters

### Tools that DON'T need location:

```json
{
  "query": "ProxyClient"  // Just the symbol name or partial name
}
```
- `search_text` - Search for text patterns, returns locations

```json
{
  "uri": "file:///absolute/path/to/file.ts"  // Just needs file path
}
```
- `get_document_symbols` - Get all symbols in a file (classes, methods, properties)
- `get_semantic_tokens` - Get syntax highlighting tokens for a file

```json
{
  "uri": "file:///absolute/path/to/file.ts"  // Optional - omit for all files
}
```
- `get_diagnostics` - Get errors/warnings (URI is optional)

### Tools that DO need precise location:

```json
{
  "uri": "file:///absolute/path/to/file.ts",  // Full file:// URI
  "line": 42,                                  // 0-indexed line number
  "character": 15                              // 0-indexed character position
}
```
- `get_definition` - Needs position of symbol
- `get_type_definition` - Needs position of symbol  
- `get_references` - Needs position of symbol
- `get_hover` - Needs position to hover over
- `get_completions` - Needs cursor position
- `get_code_actions` - Needs position for available actions
- `rename_symbol` - Needs position of symbol to rename
- `find_implementations` - Needs position of interface/class
- `get_call_hierarchy` - Needs position of function + direction

### Typical Workflow

1. **Start with name search** (no location needed):
   ```
   search_text("ProxyClient")  // Returns all matches with locations
   ```

2. **Use returned locations** with other tools:
   - `get_definition` with a location to see the implementation
   - `get_references` with a location to find all usages
   - `get_hover` with a location for documentation

## Tool Descriptions

### search_text 🆕 PRIMARY ENTRY POINT  
- **Purpose**: Search for text patterns across entire workspace
- **Use when**: Looking for any text, symbols, function names, etc.
- **Returns**: All matching locations with file paths and line numbers
- **Example**: `search_text("ProxyClient")` finds all occurrences of ProxyClient
- **Note**: Replaced find_workspace_symbols (which couldn't be made to work with VSCode API)

### get_definition
- **Purpose**: Jump directly to where something is defined
- **Use when**: You need to find the source/implementation
- **Returns**: Location(s) where the symbol is defined

### get_type_definition 🆕
- **Purpose**: Navigate to type definitions
- **Use when**: You need to find where a type is defined (interfaces, classes, types)
- **Returns**: Location(s) where the type is defined

### get_references
- **Purpose**: Find ALL places where something is used
- **Use when**: Understanding impact, refactoring, or tracing usage
- **Returns**: Every location that references the symbol

### get_hover
- **Purpose**: Get type info, documentation, and signatures
- **Use when**: Understanding what something is/does
- **Returns**: Documentation, types, and relevant information

### get_completions
- **Purpose**: Get context-aware code suggestions
- **Use when**: Need to know available methods/properties
- **Returns**: List of valid completions at position

### get_code_actions 🆕
- **Purpose**: Get available quick fixes and refactorings
- **Use when**: Need to fix errors, apply suggestions, or refactor code
- **Returns**: Available code actions (quick fixes, refactorings) at the position

### rename_symbol
- **Purpose**: Safely rename across entire codebase
- **Use when**: Refactoring names consistently
- **Returns**: All locations that were updated

### find_implementations
- **Purpose**: Find all implementations of an interface or abstract class
- **Use when**: Need to find concrete implementations
- **Returns**: Locations of all implementing classes/methods

### get_document_symbols
- **Purpose**: Get hierarchical structure of all symbols in a file
- **Use when**: Understanding file organization, finding methods in a class
- **Returns**: Tree structure of classes, methods, properties, etc.
- **Note**: Only needs file URI, no position required

### get_call_hierarchy
- **Purpose**: Trace function calls - who calls this function or what it calls
- **Use when**: Understanding call flow, impact analysis
- **Returns**: Incoming calls (callers) or outgoing calls (callees)
- **Parameters**: Needs position + direction ("incoming" or "outgoing")

### get_diagnostics 🆕
- **Purpose**: Get errors, warnings, and hints for files
- **Use when**: Need to check for code issues, compilation errors, or linting problems
- **Returns**: Diagnostics with severity, message, source, and location
- **Parameters**: Optional URI - if not provided, gets diagnostics for all files

### get_semantic_tokens 🆕
- **Purpose**: Get detailed syntax highlighting information
- **Use when**: Need to understand semantic token types and modifiers in code
- **Returns**: Decoded tokens with line, character, length, token type and modifiers
- **Parameters**: File URI required

### retrieve_buffer
- **Purpose**: Retrieve full data from a buffered response
- **Use when**: A response was too large and returned a bufferId
- **Returns**: The complete original data
- **Parameters**: Just needs the bufferId from the buffered response

### get_buffer_stats
- **Purpose**: Get statistics about currently buffered responses
- **Use when**: Monitoring buffer usage or debugging
- **Returns**: Active buffer count, total size, oldest buffer age
- **Parameters**: None required

### get_instructions
- **Purpose**: Get comprehensive usage instructions for all Token Saver MCP tools
- **Use when**: Need to understand how to use the tools, best practices, or workflows
- **Returns**: Complete contents of this guide (CLAUDE-MCP-USER.md)
- **Parameters**: None required
- **Note**: This is the single source of truth for tool usage

### get_supported_languages 🆕
- **Purpose**: Get all languages registered in VSCode and their current status
- **Use when**: Need to understand available language support or debug LSP issues
- **Returns**: Total languages, active languages in workspace, languages by category
- **Parameters**: None required
- **Note**: Shows which languages have potential LSP support and which are currently active

## Decision Tree

```
Need to find something in code?
├─ Is it a symbol (function/class/variable)?
│  ├─ YES → Start with search_text
│  │  ├─ Don't know location? → search_text FIRST
│  │  ├─ Have location, need definition? → get_definition
│  │  ├─ Have location, need usages? → get_references
│  │  ├─ Have location, need implementations? → find_implementations
│  │  ├─ Have location, need call flow? → get_call_hierarchy
│  │  ├─ Have location, need docs? → get_hover
│  │  └─ Want to rename? → rename_symbol
│  └─ NO → Is it a text pattern?
│     ├─ YES → Try search_text first, then grep
│     └─ NO → Use appropriate tool
└─ Need to browse/explore?
   ├─ Looking for file structure? → get_document_symbols
   ├─ Looking for symbols? → search_text
   └─ Looking for files? → Use glob/ls
```

## Performance Comparison

| Operation | Token Saver MCP Time | Grep/Search Time | Improvement |
|-----------|--------------|------------------|-------------|
| Find definition | ~10ms | 1-10s | 100-1000x |
| Find all references | ~50ms | 10-60s | 200-1200x |
| Find implementations | ~30ms | 5-30s | 200-1000x |
| Get file structure | ~20ms | 1-5s (parsing) | 50-250x |
| Trace call hierarchy | ~50ms | Minutes (manual) | 1000x+ |
| Get documentation | ~5ms | N/A (manual) | ∞ |
| Safe rename | ~100ms | Minutes (manual) | 1000x+ |

## ⚠️ Important Reminders

1. **Token Saver MCP tools work on any file in the workspace** - The language server has already indexed your entire project
2. **Most tools need a starting position** - You must provide a file location where the symbol appears (line/character). Use `search_text` to find symbols by name across the workspace
3. **URIs must be absolute** - Always use full file:// paths
4. **Try Token Saver MCP first, fall back to search** - Even if unsure, try Token Saver MCP tools first
5. **Port auto-increment** - If 9527 is busy, the extension tries 9528, 9529, etc.

## Integration Instructions for Your Project

To enable Token Saver MCP tools for your project:

1. Install the Token Saver MCP extension in VSCode
2. Ensure the extension is running (check status bar)
3. Add this guide to your project's CLAUDE.md or AI instructions
4. The Token Saver MCP server will be available at `http://127.0.0.1:9527/mcp`

---

**Remember**: Every time you use grep/find instead of Token Saver MCP tools, you're choosing the slow, inaccurate path. The language server has already indexed and understood your code - use it!