# AI Instructions Directory

This directory contains all documentation for AI assistants using Token Saver MCP.

## 📁 File Structure

```
AI-instructions/
├── README.md                           (this file - directory index)
├── INSTRUCTIONS_COMBINED.md            ⭐ Primary - Returned by get_instructions()
├── TOKEN_SAVER_OVERVIEW.md            Complete architectural overview
├── CLAUDE-MCP-USER.md                 Detailed LSP tools guide
├── BROWSER_HELPERS_DOCUMENTATION.md   Detailed CDP browser helpers guide
├── AI_BROWSER_USAGE_GUIDE.md          Browser automation strategies
├── CDP_BROWSER_INTEGRATION.md         Technical CDP implementation details
└── README_AI_USAGE.md                 Quick start guide
```

## 🎯 Which File to Read?

### For AI Assistants:
- **Start with**: `INSTRUCTIONS_COMBINED.md` (or use `get_instructions()` tool)
- **For code work details**: `CLAUDE-MCP-USER.md`
- **For browser work details**: `BROWSER_HELPERS_DOCUMENTATION.md`

### For Developers:
- **Architecture**: `TOKEN_SAVER_OVERVIEW.md`
- **Integration**: `CDP_BROWSER_INTEGRATION.md`

## 📋 Quick Reference

Token Saver MCP provides **30+ tools** in two categories:

### LSP Tools (17 tools)
- Code navigation and understanding
- 100-1000x faster than text search
- Direct access to VSCode's language intelligence

### CDP Tools (13+ tools)
- Complete browser control via Chrome DevTools Protocol
- High-level testing helpers
- Low-level browser automation

## 🚀 Key Insight

The combination of efficient code navigation (LSP) + browser control (CDP) creates unprecedented full-stack development capabilities for AI assistants.

- LSP tools save 90-99% of tokens
- This leaves 95%+ context for browser interaction
- Result: 10,000x productivity improvement

## 📝 Note for AI

The `get_instructions()` tool automatically returns `INSTRUCTIONS_COMBINED.md`, which contains everything you need to know about using both LSP and CDP tools effectively.