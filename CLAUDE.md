# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when DEVELOPING the Token Saver MCP extension.

## For MCP Tool Usage

**See [AI-instructions/INSTRUCTIONS_COMBINED.md](./AI-instructions/INSTRUCTIONS_COMBINED.md) for the complete guide on using MCP tools.**

When working on THIS codebase, you MUST follow the MCP tool usage guidelines. The MCP server at `http://127.0.0.1:9700/mcp` provides direct access to VSCode's language intelligence and browser control.

## 🚨 CRITICAL: MCP Connection Requirements for Claude Code

**For Token Saver MCP to work with Claude Code, ALL of the following MUST be true:**

1. **IPv4 Binding**: Server MUST bind to `127.0.0.1` (IPv4), NOT `localhost` or `::1` (IPv6)
   ```javascript
   app.listen(port, '127.0.0.1', callback) // ✅ CORRECT
   app.listen(port, callback)              // ❌ WRONG - may bind to IPv6
   ```

2. **Endpoint Path**: MCP endpoint MUST be at `/mcp` for Claude Code
   ```
   http://127.0.0.1:9700/mcp           ✅ CORRECT for Claude Code
   http://127.0.0.1:9700/mcp-gemini    ✅ For Gemini CLI
   http://127.0.0.1:9700/mcp-streaming ✅ Alternative streaming endpoint
   http://127.0.0.1:9700/mcp/simple    ✅ REST API for testing
   http://127.0.0.1:9700/mcp/http      ❌ WRONG - not a valid endpoint
   ```

3. **Input Schema**: ALL tools MUST include `inputSchema` in their definitions
   ```javascript
   {
     name: 'tool_name',
     description: 'Tool description',
     inputSchema: {           // ✅ REQUIRED
       type: 'object',
       properties: {},
       required: []
     }
   }
   ```

4. **Response Format**: MUST return JSON-RPC format, NOT Server-Sent Events (SSE)
   ```javascript
   res.json({ jsonrpc: '2.0', id, result })  // ✅ CORRECT
   // NOT text/event-stream or streaming      // ❌ WRONG
   ```

**Testing**: Run `node mcp-server/test-mcp-connectivity.js` to verify all requirements are met.

**Debugging**: Check `mcp-server/server.log` for Claude Code requests (user-agent: claude-code/x.x.x)

## Project Overview

Token Saver MCP is a Visual Studio Code extension that bridges Language Server Protocol (LSP) features with Model Context Protocol (MCP), enabling AI assistants to access VSCode's language intelligence with 100-1000x performance improvements over text-based searching, saving thousands of tokens per query.

**Mission**: Expose VSCode's already-computed code intelligence to AI assistants, eliminating the need for expensive text-based searching while leveraging local machine's indexed language features.

## Essential Commands

### Development
- `pnpm install` - Install dependencies
- `pnpm run dev` - Start development build with watch mode
- `pnpm run build` - Production build
- `pnpm run lint` - Run ESLint
- `pnpm run test` - Run Vitest tests
- `pnpm run update` - Generate extension metadata from package.json

### Debugging
- Press F5 in VSCode to launch Extension Development Host
- The extension automatically builds before launching (configured in .vscode/tasks.json)

### Publishing
- `pnpm run publish` - Publish to VSCode marketplace
- `pnpm run release` - Version bump and publish

## Architecture

### Core Components

1. **Extension Entry** (`src/index.ts`): Minimal activation using reactive-vscode that starts the MCP server

2. **MCP Server** (`src/mcp/index.ts`): Express HTTP server with MCP integration
   - Session management with UUID-based IDs
   - Port conflict resolution (default 9527)
   - Streamable HTTP transport support

3. **LSP Bridge** (`src/lsp/*.ts`): Each file wraps a VSCode LSP command
   - `hover.ts` - Symbol hover information
   - `completion.ts` - Code completions
   - `definition.ts` - Find definitions
   - `references.ts` - Find references
   - `implementations.ts` - Find implementations
   - `document-symbols.ts` - File structure/symbols
   - `call-hierarchy.ts` - Function call tracing
   - `rename.ts` - Symbol renaming
   - `text-search.ts` - Text pattern search

4. **Tools Registry** (`src/mcp/tools.ts`): Registers LSP functions as MCP tools with Zod validation

### Key Design Patterns

- **LSP Wrapper Pattern**: Each LSP feature is wrapped in its own module under `src/lsp/`
- **Tool Registration**: All MCP tools are centralized in `src/mcp/tools.ts` using a consistent registration pattern
- **URI Handling**: Always encode/decode URIs when passing between VSCode and MCP layers
- **Session Management**: Each MCP client gets a unique session ID for isolation

## MCP Tool Usage Workflows

### Refactoring Workflow Example
When asked to refactor code (e.g., rename a function, extract a method, reorganize imports):

1. **First**: Use `get_definition` to locate the symbol's definition
2. **Then**: Use `get_references` to find all usages
3. **Finally**: Use `rename_symbol` or make edits with full context

### Understanding Code Workflow
When asked to understand or explain code:

1. **First**: Use `get_hover` on key symbols to understand types and documentation
2. **Then**: Use `get_definition` to jump to implementations
3. **Optional**: Use `get_references` to see how it's used elsewhere

### Navigation Workflow
When navigating the codebase:

1. **NEVER** start with grep/glob for symbols
2. **ALWAYS** use `get_definition` to jump directly to definitions
3. **ALWAYS** use `get_references` to find all usages

### Required MCP Tool Parameters

Most MCP tools require:
- `uri`: Full file:// URI (e.g., `file:///home/user/project/src/file.ts`)
- `line`: Line number (0-indexed)
- `character`: Character position in line (0-indexed)

Exceptions:
- `search_text`: Only needs query string
- `get_document_symbols`: Only needs URI, no position

## Development Guidelines

### Adding New LSP Features

1. Create a new file in `src/lsp/` (e.g., `src/lsp/implementations.ts`)
2. Wrap the VSCode command (e.g., `vscode.commands.executeCommand('vscode.executeImplementationProvider', ...)`)
3. Register the tool in `src/mcp/tools.ts` with appropriate Zod schema
4. Follow existing patterns for error handling and URI encoding

### Build System

- Uses `tsup` for fast TypeScript bundling
- CommonJS output format for VSCode compatibility
- All dependencies bundled except VSCode APIs
- Source maps enabled for debugging

### Testing

- Vitest for unit testing
- Test files should use `.test.ts` suffix
- Run individual tests with `pnpm test -- path/to/test`

## Configuration

Extension settings (in VSCode settings.json):
- `lsp-mcp.enabled`: Enable/disable server (default: true)
- `lsp-mcp.port`: Server port (default: 9527)
- `lsp-mcp.maxRetries`: Port retry attempts (default: 10)

## Important Notes

- The extension automatically handles port conflicts by trying successive ports
- Multiple VSCode instances can run simultaneously with different ports
- The MCP server URL for AI tools: `http://127.0.0.1:{port}/mcp`
- All LSP operations automatically activate the required Language Server if needed
- URI parameters in MCP tools must be properly encoded file:// URIs
- Python test clients available in `test/` directory for debugging

## API Conventions

### Line Numbers
- **All tools use 1-indexed line numbers** (line 1 is the first line)
- This matches how developers think about code and how editors display line numbers
- The conversion from 1-indexed to 0-indexed (for VSCode internals) happens automatically

### Character Positions
- **Character positions are 0-indexed** (character 0 is the first character)
- This is consistent with most programming APIs and VSCode

### Symbol Positions
- `find_symbols` returns the **exact character position** where the symbol name begins
- Example: For `export function normalizeParams`, it returns the position of the 'n' in 'normalizeParams', not the 'e' in 'export'
- This ensures `get_hover` and other position-sensitive tools work correctly when chaining operations

### Multi-Client Support
The server supports multiple AI assistant clients simultaneously:
- **Claude Code**: Uses `/mcp` endpoint with standard JSON-RPC
- **Gemini CLI**: Uses `/mcp-gemini` endpoint with streaming support
- **Other clients**: Can use `/mcp-streaming` or implement their own endpoints

## Complete Feature Set - All 31 Tools

### LSP Tools (15 tools)
1. ✅ **get_hover** - Documentation and type information
2. ✅ **get_completions** - Code completion suggestions
3. ✅ **get_definition** - Jump to symbol definitions
4. ✅ **get_type_definition** - Navigate to type definitions
5. ✅ **get_references** - Find all usages
6. ✅ **find_implementations** - Find interface/class implementations
7. ✅ **get_document_symbols** - File structure/outline
8. ✅ **get_call_hierarchy** - Trace function calls
9. ✅ **rename_symbol** - Safe refactoring across workspace
10. ✅ **get_code_actions** - Get available quick fixes and refactorings
11. ✅ **get_diagnostics** - Get errors/warnings
12. ✅ **get_semantic_tokens** - Semantic highlighting info
13. ✅ **find_text** - Text pattern search across workspace
14. ✅ **find_symbols** - Symbol search across workspace

### CDP Tools (8 tools)
15. ✅ **execute_in_browser** - Execute JavaScript in browser context
16. ✅ **get_browser_console** - Get console messages from browser
17. ✅ **navigate_browser** - Navigate browser to URL and wait for load
18. ✅ **get_dom_snapshot** - Get current DOM including forms, links, images
19. ✅ **click_element** - Click element using CSS selector
20. ✅ **type_in_browser** - Type text into input field using CSS selector
21. ✅ **take_screenshot** - Take screenshot of current browser page
22. ✅ **wait_for_element** - Wait for element to appear in DOM

### Helper Tools (5 tools)
23. ✅ **test_react_component** - Test React component rendering with props/state
24. ✅ **test_api_endpoint** - Test API endpoint from browser context with CORS
25. ✅ **test_form_validation** - Test form validation by filling and submitting
26. ✅ **check_page_performance** - Analyze page performance with optimization tips
27. ✅ **debug_javascript_error** - Capture and analyze JavaScript errors

### System Tools (4 tools)
28. ✅ **retrieve_buffer** - Retrieve full data from buffered responses
29. ✅ **get_buffer_stats** - Monitor buffer system status
30. ✅ **get_instructions** - Self-documenting API guide
31. ✅ **get_supported_languages** - List all VSCode languages and their status

All tools feature automatic Language Server activation - no manual file opening required!

## 🔴 REMINDER: Token Saver MCP Tools Are Your Primary Navigation Method

**You have direct access to VSCode's Language Server via Token Saver MCP tools. USE THEM!**

Before using ANY file search or reading tools:
1. Check if a Token Saver MCP tool can do it better (it usually can)
2. Token Saver MCP tools understand types, imports, and language semantics
3. They're 100-1000x faster than text search

The MCP server at `http://127.0.0.1:9527/mcp` is running and ready. The proxy will route to the correct VSCode instance automatically.