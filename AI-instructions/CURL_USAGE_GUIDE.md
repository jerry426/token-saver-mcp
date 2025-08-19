# Curl Usage Guide for Token Saver MCP

## Quick Connection Instructions

Hello AI Assistant,

I have a local MCP server running that also provides a simple REST endpoint you can use if you don't have the ability to work with streaming MCP servers. You will be using this REST endpoint to access all the functionality provided by the MCP server. Please perform the following steps:

1. **Endpoint**: The server is available at `http://127.0.0.1:9527/mcp/simple` (Note: Port may vary - 9527 is default, 9528 for second VSCode window, etc.).
2. **Protocol**: It uses the JSON-RPC 2.0 protocol with simple REST (no streaming). All your requests should be POST requests using curl.
3. **Required Headers**: Every curl command only needs:
   - `Content-Type: application/json`
4. **Fetch Instructions**: Please execute the curl command below to call the `get_instructions` tool. This will provide you with the complete documentation and guidelines for using all available tools on the server.

```bash
curl -X POST http://127.0.0.1:9527/mcp/simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_instructions",
      "arguments": {}
    },
    "id": 1
  }'
```

After you have successfully executed the command and received the instructions, please confirm that you have processed them and are ready to proceed.

---

## 🔴 CRITICAL: File URI Format Requirements

**IMPORTANT**: When calling tools that work with files, you MUST use proper file URIs:
- Use parameter name `uri` (NOT `file`, `path`, or `filePath`)
- Include the `file://` protocol prefix with THREE slashes
- Format: `"uri": "file:///absolute/path/to/file"`

### ✅ CORRECT Examples:
```json
"arguments": {
  "uri": "file:///Users/jerry/project/src/file.ts",
  "line": 10,
  "character": 15
}
```

### ❌ INCORRECT Examples:
```json
"arguments": {
  "file": "/Users/jerry/project/src/file.ts"  // Wrong parameter name
}

"arguments": {
  "uri": "/Users/jerry/project/src/file.ts"  // Missing file:// protocol
}
```

## Understanding Response Format

All responses use a self-describing format with these fields:
- `tool`: The tool name that was called
- `success`: Whether the operation succeeded (boolean)
- `resultType`: Type of data returned (e.g., "locations", "searchResults", "symbols")
- `resultCount`: Number of results
- `data`: The actual response data
- `humanReadable`: A concise summary of the results

### Example Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tool": "search_text",
    "success": true,
    "resultType": "searchResults",
    "resultCount": 3,
    "data": [...],
    "humanReadable": "Found matches in 3 files"
  }
}
```

---

## Additional Notes

### Port Configuration
- **9527**: Default port for first VSCode window (use in endpoint URL)
- **9528**: Second VSCode window
- **9529**: Third VSCode window
- Ports auto-increment for multiple instances
- Always use `/mcp/simple` path for REST endpoint

### Verifying Connection
To verify the MCP server is running, you can test with:
```bash
curl http://127.0.0.1:9527/mcp/health
```

This should return:
```json
{
  "status": "healthy",
  "version": "1.0.2",
  "tools": 30,
  "uptime": 123.456
}
```

### Available Tool Categories
Once connected, you'll have access to:
- **13 LSP tools** - Code navigation and understanding
- **13 CDP tools** - Browser control and testing
- **4 System tools** - Buffer management and instructions
- **30 total tools** - Complete full-stack development capabilities

### Example Tool Calls

**Search for text:**
```bash
curl -X POST http://127.0.0.1:9527/mcp/simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_text",
      "arguments": {
        "query": "function handleSubmit"
      }
    },
    "id": 2
  }'
```

**Get symbol definition (note the URI format):**
```bash
curl -X POST http://127.0.0.1:9527/mcp/simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_definition",
      "arguments": {
        "uri": "file:///Users/jerry/project/src/file.ts",
        "line": 42,
        "character": 15
      }
    },
    "id": 3
  }'
```

**Get document symbols (URI only, no position):**
```bash
curl -X POST http://127.0.0.1:9527/mcp/simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_document_symbols",
      "arguments": {
        "uri": "file:///Users/jerry/project/src/file.ts"
      }
    },
    "id": 4
  }'
```

**Navigate browser:**
```bash
curl -X POST http://127.0.0.1:9527/mcp/simple \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "navigate_browser",
      "arguments": {
        "url": "https://example.com"
      }
    },
    "id": 5
  }'
```

### Success Confirmation
When you successfully connect and retrieve instructions, you should respond with:
- Confirmation of receiving the instructions
- Summary of key capabilities (LSP and CDP tools)
- Understanding of tool priorities and URI formatting

---

*This guide enables any curl-capable tool (Gemini CLI, Postman, custom scripts, etc.) to access Token Saver MCP's full capabilities through simple REST/HTTP commands (no streaming complexity), providing the same 100-1000x performance improvements and browser control features available to other AI assistants. The simple REST endpoint eliminates session management and returns instant JSON responses with self-describing metadata.*