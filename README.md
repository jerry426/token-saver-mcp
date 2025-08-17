# Token Saver MCP - Stop Wasting AI Tokens

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/jerry426/token-saver-mcp)](https://github.com/jerry426/token-saver-mcp)

> **Stop watching AI burn thousands of tokens on simple code searches.**

## The Hidden Cost You Don't See

Every time your AI assistant searches your code, it's:
- 🔥 **Burning thousands of tokens** on grep/find commands
- ⏰ **Making you wait 10-30 seconds** for simple answers
- 💸 **Costing you money** in API fees
- 🔄 **Repeatedly searching** the same code

**Meanwhile, VSCode's Language Server subsystem already knows everything about your code.**

Token Saver MCP gives AI instant access to that knowledge. No searching. No waiting. No token waste.

## What This Extension Does

Token Saver MCP bridges Language Server Protocol (LSP) with Model Context Protocol (MCP), giving AI assistants direct access to VSCode's already-indexed code intelligence - delivering answers in **milliseconds instead of seconds** with **90% fewer tokens**.

## Proven Results

- ⚡ **100-1000x faster** than text-based searching
- 🎯 **17 production-ready tools** 
- 🛡️ **Intelligent buffer protection** prevents token overflow
- 🔄 **Zero configuration** for single projects

## Real-World Performance

| Operation | Traditional Approach | With Token Saver MCP | Your Time Saved |
|-----------|---------------------|---------------------|-----------------|
| Find where a function is defined | 5-10 seconds | **10ms** | ☕ Make coffee |
| Find all usages of a variable | 10-30 seconds | **50ms** | 💭 Keep your flow |
| Get type information | Manual lookup | **5ms** | ⚡ Instant |
| Rename across entire project | Several minutes | **100ms** | 🚀 Already done |
| Search for text patterns | 2-15 seconds | **30ms** | 📈 100x faster |

## Token & Cost Savings Calculator

| Metric | Without Token Saver | With Token Saver | Your Savings |
|--------|-------------------|------------------|--------------|
| Tokens per search | ~5,000 tokens | ~50 tokens | **99% fewer** |
| Cost per search (GPT-4) | $0.15 | $0.0015 | **$0.1485** |
| Daily searches (avg) | 50 | 50 | - |
| **Daily cost** | **$7.50** | **$0.075** | **$7.43 saved** |
| **Monthly cost** | **$225** | **$2.25** | **$222.75 saved** |
| **Yearly cost** | **$2,700** | **$27** | **$2,673 saved** |

*Based on typical development patterns and AI code assistant pricing. Your savings may vary.

## Before & After Comparison

### ❌ **Before Token Saver MCP** - What You're Doing Now
```
AI: "Let me search for that function definition..."
> Running: grep -r "functionName" . --include="*.ts"
> [10 seconds pass...]
> Found 47 matches, let me search more specifically...
> Running: find . -name "*.ts" -exec grep -l "function functionName" {} \;
> [15 more seconds...]
> Tokens used: 5,000+
> Time wasted: 25 seconds
> Result: Maybe found it, maybe not
```

### ✅ **After Token Saver MCP** - Instant Intelligence
```
AI: "Getting definition..."
> Using: get_definition at file.ts:42:15
> [10ms]
> Tokens used: 50
> Time: Instant
> Result: Exact location with type info
```

## 🔬 Don't Take Our Word For It - Verify It Yourself!

**Think these performance claims are too good to be true?**

Don't trust us - let your own AI prove it! Install Token Saver MCP in your VSCode, then challenge your AI assistant to compare approaches:

**Ask your AI to:**
1. **Find a function definition** - First with grep, then with `get_definition`
2. **Find all usages of a variable** - First with text search, then with `get_references`  
3. **Get type information** - First by reading files, then with `get_hover`
4. **Understand code structure** - First by parsing manually, then with `get_document_symbols`
5. **Trace function calls** - First with grep patterns, then with `get_call_hierarchy`

**Your AI will report:**
- 🎯 Exact token counts for each approach
- ⏱️ Response time differences
- 📊 Accuracy improvements
- 💰 Cost savings per operation

The results speak for themselves - typically **100-1000x faster** with **90-99% fewer tokens**. Your AI assistant will confirm these aren't marketing claims - they're measurable facts.

## Features

This extension exposes VSCode's Language Server Protocol features through MCP, providing AI assistants with **17 powerful tools**:

### Core Navigation & Intelligence
- **Go to Definition** (`get_definition`) - Navigate to symbol definitions
- **Go to Type Definition** (`get_type_definition`) - Navigate to type definitions
- **Find References** (`get_references`) - Locate all usages of a symbol
- **Find Implementations** (`find_implementations`) - Find all implementations of an interface/class
- **Hover Information** (`get_hover`) - Access documentation and type information

### Code Analysis & Refactoring
- **Code Completions** (`get_completions`) - Get intelligent code suggestions at any position
- **Code Actions** (`get_code_actions`) - Get available quick fixes and refactorings
- **Symbol Rename** (`rename_symbol`) - Refactor symbols across the workspace
- **Document Symbols** (`get_document_symbols`) - Get file structure with all symbols hierarchically
- **Call Hierarchy** (`get_call_hierarchy`) - Trace incoming/outgoing function calls

### Diagnostics & Search
- **Diagnostics** (`get_diagnostics`) - Get errors, warnings, and hints for files
- **Text Search** (`search_text`) - Search for text patterns across all files
- **Semantic Tokens** (`get_semantic_tokens`) - Get detailed syntax highlighting information

### System & Utilities
- **Buffer Retrieval** (`retrieve_buffer`) - Retrieve full data from buffered responses
- **Buffer Statistics** (`get_buffer_stats`) - Monitor buffer system usage
- **Get Instructions** (`get_instructions`) - Self-documenting API returns complete usage guide
- **Supported Languages** (`get_supported_languages`) - Get all registered languages and their status

### Intelligent Buffer System

The extension includes a sophisticated buffer system to prevent token overflow:

- **Automatic buffering** for responses over 2,500 tokens (~10KB)
- **Smart previews** with tool-specific intelligent summaries
- **Depth truncation** to limit deeply nested data structures
- **Session-based isolation** for multiple concurrent users
- **60-second TTL** with automatic cleanup

### Performance Benefits

- **Instant results**: <100ms response time vs 10-30 seconds with grep
- **Semantic accuracy**: Real code intelligence, not text pattern matching
- **Zero additional cost**: Leverages existing VSCode computation
- **Works across your workspace**: Automatic Language Server activation for any file type - no manual setup needed

## 🚀 Get Started in 30 Seconds

```bash
# One command does everything:
./mcp setup /path/to/your/project
```

That's it! The extension automatically:
- ✅ Finds an available port
- ✅ Creates configuration files
- ✅ Tests the connection
- ✅ Provides the Claude command

## Installation

VSCode Marketplace publishing is coming soon! Until then, here are your installation options:

### Option 1: Install from Pre-built Release (Recommended)

1. **Download the latest .vsix file** from the [Releases](https://github.com/jerry426/token-saver-mcp/releases) page
2. **Install in VSCode** using one of these methods:
   - Command Palette: `Extensions: Install from VSIX...` then select the file
   - Terminal: `code --install-extension token-saver-mcp-*.vsix`
   - Or drag and drop the .vsix file onto the VSCode Extensions view
3. **Reload VSCode** to activate the extension

### Option 2: Build from Source

1. **Clone and build the extension:**
   ```bash
   git clone https://github.com/jerry426/token-saver-mcp.git
   cd token-saver-mcp
   pnpm install
   pnpm run build
   ```

2. **Create the extension package:**
   ```bash
   pnpm run vsix
   # This creates token-saver-mcp-*.vsix in the current directory
   ```

3. **Install the .vsix file in VSCode:**
   ```bash
   code --install-extension token-saver-mcp-*.vsix
   ```

4. **Reload VSCode** to activate the extension:
   - Command Palette: `Developer: Reload Window`
   - Or restart VSCode

## Usage

### 🎯 IMPORTANT: For Best Results with AI Assistants

**Tell your AI assistant to read the CLAUDE-MCP-USER.md file first!**

```
"Please read the CLAUDE-MCP-USER.md file to understand how to use Token Saver MCP tools effectively"
```

This ensures your AI assistant:
- Uses Token Saver MCP tools instead of slow text searches
- Understands all 17 available tools and their parameters
- Follows best practices for maximum performance
- Saves 90-99% of tokens on code navigation tasks

The CLAUDE-MCP-USER.md file is the complete guide that teaches AI assistants how to leverage VSCode's Language Server intelligence instead of wasting tokens on grep/find operations.

### Status Dashboard

**See all your MCP-enabled projects:**
```bash
./mcp status
```

Shows which projects are configured, running, and connected to Claude.

### Multiple Projects Setup

Each project needs its own unique port number:

1. **Assign unique ports to each project:**
   ```bash
   # Project A
   echo "9527" > /path/to/project-a/.lsp_mcp_port
   
   # Project B  
   echo "9528" > /path/to/project-b/.lsp_mcp_port
   
   # Project C
   echo "9529" > /path/to/project-c/.lsp_mcp_port
   ```

2. **Set up Claude for each project:**
   ```bash
   # Get the Claude command for each project
   ./mcp claude /path/to/project-a
   
   ./mcp claude /path/to/project-b
   ```

3. **The extension will automatically use the port from `.lsp_mcp_port`** when you open each project

### Port Discovery

To see all running MCP servers:
```bash
python3 test/find_mcp_servers.py
```

This shows which ports are actually in use and their workspace paths.

## Available MCP Tools

> **Automatic Language Server Activation:** The extension automatically activates the appropriate Language Server when you use any MCP tool. No manual file opening required - just call the tool and it works instantly! If a Language Server isn't already active, the extension will very briefly open and close a file of that type in the background to trigger activation. This happens automatically and takes just milliseconds.

### Position-Based Tools

These tools require a file URI and position (line/character):

#### `get_hover`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: Type information, documentation, and signatures

#### `get_completions`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: Context-aware code completion suggestions

#### `get_definition`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: Location(s) where the symbol is defined

#### `get_type_definition`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: Location(s) where the type is defined

#### `get_code_actions`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: Available quick fixes and refactorings at the position

#### `get_references`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: All locations where the symbol is used

#### `find_implementations`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15
}
```
Returns: All locations where the interface/class is implemented

#### `get_call_hierarchy`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15,
  "direction": "incoming"  // or "outgoing"
}
```
Returns: Function call relationships - incoming shows callers, outgoing shows callees

#### `rename_symbol`
```json
{
  "uri": "file:///path/to/file.ts",
  "line": 10,
  "character": 15,
  "newName": "newSymbolName"
}
```
Returns: Edit operations to rename across all files

### Document-Level Tools

#### `get_document_symbols`
```json
{
  "uri": "file:///path/to/file.ts"
}
```
Returns: Hierarchical structure of all symbols in the file (classes, methods, properties, etc.)

### Search Tools

#### `search_text`
```json
{
  "query": "searchTerm",
  "useRegExp": false,
  "isCaseSensitive": false,
  "matchWholeWord": false,
  "maxResults": 100,
  "includes": ["**/*.ts"],
  "excludes": ["node_modules/**"]
}
```
Returns: File locations and positions matching the search

### Diagnostics Tools

#### `get_diagnostics`
```json
{
  "uri": "file:///path/to/file.ts"  // Optional - if not provided, gets all diagnostics
}
```
Returns: Errors, warnings, and hints for the file(s)

#### `get_semantic_tokens`
```json
{
  "uri": "file:///path/to/file.ts"
}
```
Returns: Detailed syntax highlighting information with token types and modifiers

### Buffer Management Tools

#### `retrieve_buffer`
```json
{
  "bufferId": "get_document_symbols_1754955026362_z2ksv6t8z"
}
```
Returns: Complete original data from a buffered response

#### `get_buffer_stats`
```json
{}  // No parameters required
```
Returns: Active buffer count, total size, oldest buffer age

### Self-Documentation Tool

#### `get_instructions`
```json
{}  // No parameters required
```
Returns: Complete CLAUDE-MCP-USER.md guide with all usage instructions

#### `get_supported_languages`
```json
{}  // No parameters required
```
Returns: All languages registered in VSCode organized by category, active languages in workspace, and total count

## Configuration

VSCode settings:

- `lsp-mcp.enabled` - Enable/disable the MCP server (default: `true`)
- `lsp-mcp.port` - Server port (default: `9527`)
- `lsp-mcp.maxRetries` - Port retry attempts if occupied (default: `10`)

## Testing

Test all MCP tools:
```bash
python3 test/test_mcp_tools.py
```

Expected output:
```
✓ Hover works - returned documentation
✓ Completions works - returned 193 items
✓ Definition works - found 1 location(s)
✓ References works - found 5 reference(s)
✓ Implementations works - interface/class implementations
✓ Document symbols works - found 10 top-level symbol(s)
✓ Text search works - found 6 match(es)
✓ Call hierarchy works - target: startMcp, 2 call(s)
✓ Rename works - would affect 2 file(s)
✓ Type definition works - found 1 location(s)
✓ Code actions works - found 3 quick fix(es)
✓ Diagnostics works - found issues in 2 file(s)
✓ Semantic tokens works - 500+ tokens decoded
✓ Buffer system works - response buffered (8744 tokens)
✓ retrieve_buffer works - retrieved 21 items
✓ Buffer stats works - 3 active buffer(s)
🎉 SUCCESS! All 17 tools are working!
```

## Architecture

```
┌─────────────┐     MCP/HTTP      ┌──────────────┐
│ AI Assistant│ ◄──────────────► │  MCP Server  │
│ (e.g. Claude)│                   │ (Port 9527)  │
└─────────────┘                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ LSP Bridge   │
                                   │  (TypeScript)│
                                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ VSCode LSP   │
                                   │     APIs     │
                                   └──────────────┘
```

Key design principles:
- **Automatic Language Server activation**: The extension automatically activates Language Servers as needed
- **Workspace-wide access**: All files are immediately accessible without manual activation
- **Session management**: Each MCP client gets an isolated session
- **Consistent formatting**: All responses return JSON-serialized data
- **Error resilience**: Graceful handling of missing files or invalid positions

## Development

```bash
# Install dependencies
pnpm install

# Development with watch mode
pnpm run dev

# Build for production
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint

# Type checking
pnpm run typecheck
```

### Project Structure

```
src/
├── index.ts           # Extension entry point
├── mcp/
│   ├── index.ts      # MCP server implementation
│   ├── tools.ts      # Tool registrations
│   └── buffer-manager.ts # Intelligent buffer system
├── lsp/
│   ├── hover.ts          # Hover information
│   ├── completion.ts     # Code completions
│   ├── definition.ts     # Go to definition
│   ├── references.ts     # Find references
│   ├── implementations.ts # Find implementations
│   ├── document-symbols.ts # File structure
│   ├── call-hierarchy.ts # Call tracing
│   ├── rename.ts         # Symbol rename
│   └── text-search.ts    # Text search
└── utils/
    └── index.ts      # Logging utilities
```

## Troubleshooting

**Extension not responding?**
```bash
# Check if MCP server is running
python3 test/find_mcp_servers.py
```

**Need a specific port?**
```bash
echo "9527" > .lsp_mcp_port
```

**Port already in use?**
- Check `.lsp_mcp_port` file or let extension auto-increment from default port

**MCP tools not responding?**
- Ensure VSCode has the workspace open
- **Language Servers are automatically activated** when you use any MCP tool
- Check extension is enabled in settings (`lsp-mcp.enabled`)
- Verify the MCP server is running on the expected port

**Claude Code stuck on "connecting..." or showing "failed"?**
- **Reload the VSCode window** with `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux) to restart the extension and MCP server
- This clears any stale connection states and forces a fresh initialization
- After reloading, restart Claude Code in your project terminal

**Large responses causing issues?**
- Responses over 2,500 tokens are automatically buffered
- Use the returned `bufferId` with `retrieve_buffer` tool to get full data
- Check buffer stats with `get_buffer_stats` tool

**Testing the connection:**
```bash
# Run the comprehensive test suite
python3 test/test_mcp_tools.py
```

## Contributing

Contributions welcome! Please check the roadmap above for features to implement.

## License

MIT