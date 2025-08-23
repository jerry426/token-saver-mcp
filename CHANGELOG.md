# Changelog

All notable changes to Token Saver MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] - 2025-08-23

### Fixed
- 🎯 **Critical Hover Fix** - VSCode MarkdownString content now properly extracted
  - Hover tool was returning empty objects despite VSCode showing content
  - Fixed by extracting non-enumerable properties from MarkdownString objects
  - VSCode extension update required (new release on GitHub)

### Added
- 📚 **AI Collaboration Concept Document** - Revolutionary multi-AI pair programming vision
  - Shared context repository for unified "mental model"
  - Persistent collaboration state with database schema
  - Genetic algorithms for evolving optimal collaboration patterns
  - Session management with intelligent resume capabilities
- 📊 **CDP Tools vs Playwright Comparison** - Clear guidance on when to use each
- 🤝 **Multi-Client Support** - Multiple AIs can connect simultaneously
  - Dedicated `/mcp-gemini` endpoint for Gemini CLI
  - Separate `/mcp-streaming` endpoint for other clients

### Changed
- 📐 **API Standardization** - All tools now use 1-indexed line numbers
  - Matches human-readable line numbers (there is no line 0)
  - Automatic conversion to 0-indexed for internal VSCode calls
  - `find_symbols` now returns exact character positions of symbol names
- 📖 **README Reorganization** - Split into focused documents
  - README.md: Concise landing page (~225 lines)
  - README_FULL.md: Complete technical documentation
  - README_USAGE_GUIDE.md: Tool usage with examples

### Improved
- Path resolution fallbacks for `get_instructions` tool
- Documentation clarity for AI reviewers
- Genetic algorithm concepts for self-improving collaboration

## [1.2.0] - 2025-08-21

### Added
- 🚀 **Intelligent Port Management** - Zero-config multi-instance support
  - Automatic port discovery and conflict resolution
  - Support for multiple VSCode instances
  - Smart port allocation with fallback options
  - Port testing before binding

### Changed
- 🏗️ **Complete Modular Architecture** - Full migration to 31 independent tools
  - Tools organized by category: lsp/, cdp/, helper/, system/
  - Each tool is self-documenting with metadata
  - Consistent error handling across all tools
  - Clean separation of concerns

### Fixed
- Architecture documentation accuracy regarding CDP integration
- Tool naming consistency across documentation

## [1.1.0] - 2025-08-20

### Added
- 📊 **Enhanced Dashboard** - Complete re-implementation
  - Real-time metrics visualization
  - Tool usage statistics
  - Performance monitoring
  - Cost savings calculator

### Changed
- 🔧 **Major Codebase Restructuring**
  - Migrated to fully modular tool architecture
  - 31 tools now independently implemented
  - Improved maintainability and testability

## [1.0.5] - 2025-08-19

### Added
- 📚 **Self-Documenting Tools** - Every tool includes comprehensive metadata
  - Built-in examples and usage patterns
  - Category organization (LSP, CDP, Helper, System)
  - Automatic documentation generation

### Improved
- Tool documentation readability with clean separators
- Modular architecture completion

## [1.0.4] - 2025-08-18

### Added
- 📚 **Context Conservation Messaging** - New compelling documentation
- 🔗 **Complete REST Endpoint Parity** - All 30 tools via REST
- 🔄 **Automatic Update Checker** - GitHub release notifications

### Fixed
- High-level browser helpers now work via REST endpoint
- `search_text` parameter destructuring for REST endpoint

### Changed
- Renamed documentation files for inclusivity:
  - `CLAUDE-MCP-USER.md` → `AI-MCP-USER.md`
  - `GEMINI_CLI_SETUP.md` → `CURL_USAGE_GUIDE.md`

## [1.0.3] - 2025-08-18

### Added
- 🌐 **Simple REST Endpoint** (`/mcp/simple`) - Universal HTTP compatibility
- 📝 **Self-Describing Response Format** - Metadata in all responses

### Improved
- REST endpoint compatibility with any HTTP client
- No session management required for REST
- Instant JSON responses without streaming

## [1.0.2] - 2025-08-17

### Added
- 🎯 **Real-Time Developer Dashboard** at `/dashboard`
  - Live metrics and performance graphs
  - Token and cost savings tracking
  - Tool usage visualization
- 🚀 **Edge Browser Prioritization** - 0.5ms response times
- 🔄 **WebSocket Auto-Recovery** - No more VSCode restarts

### Performance
- 17,200+ tokens saved per typical session
- 100-1000x faster than text search
- $0.05+ saved per session

## [1.0.1] - 2025-08-17

### Added
- 🌐 **Chrome DevTools Protocol Integration**
  - 13 browser control tools
  - Frontend testing capabilities
  - React-aware event handling
  - Browser automation support

### Fixed
- Session management improvements
- Buffer system optimizations
- Instruction reading from extension directory

## [1.0.0] - 2025-08-16

### Initial Release
- 🔍 **17 Language Server Protocol Tools**
  - Direct access to VSCode's language intelligence
  - Go to Definition, Find References, Get Hover
  - Code Completions, Symbol Rename
  - Text Search, Diagnostics
  - And 10+ more LSP capabilities
- 🚀 **Revolutionary Dual Architecture**
  - Stable VSCode Gateway extension
  - Hot-reloadable MCP server
  - 60x faster development cycle
- 📊 **Intelligent Buffer System**
  - Handles large responses efficiently
  - Prevents token overflow
- ⚡ **Performance Metrics**
  - <100ms response time (vs 10-30s with grep)
  - 90-99% fewer tokens used
  - Zero additional cost

### Core Features
- Automatic Language Server activation
- Session-based isolation for multiple users
- MCP streaming protocol support
- Comprehensive documentation and examples

## Historical Note

Token Saver MCP was created to solve the fundamental problem of AI assistants wasting context window space with verbose search results. By providing direct access to VSCode's already-computed language intelligence and browser automation capabilities, it transforms AI from a code suggester into a true full-stack developer.

The project has evolved from a simple LSP bridge to a comprehensive development platform supporting multi-AI collaboration, genetic algorithm optimization, and persistent knowledge management.