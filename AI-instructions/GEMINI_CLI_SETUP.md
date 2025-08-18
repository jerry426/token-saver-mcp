# Gemini CLI Setup for Token Saver MCP

## Quick Connection Instructions

Hello Gemini,

I have a local MCP server running that you need to connect to. Please perform the following steps:

1. **Endpoint**: The server is available at `http://127.0.0.1:9528/mcp`.
2. **Protocol**: It uses the JSON-RPC 2.0 protocol. All your requests should be POST requests using curl.
3. **Required Headers**: Every curl command must include these two headers:
   - `Content-Type: application/json`
   - `Accept: application/json, text/event-stream`
4. **Fetch Instructions**: Please execute the curl command below to call the `get_instructions` tool. This will provide you with the complete documentation and guidelines for using all available tools on the server.

```bash
curl -X POST http://127.0.0.1:9528/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
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

## Additional Notes

### Port Configuration
- **9527**: Default port for first VSCode window
- **9528**: Second VSCode window
- **9529**: Third VSCode window
- Ports auto-increment for multiple instances

### Verifying Connection
To verify the MCP server is running, you can test with:
```bash
curl http://127.0.0.1:9528/workspace-info
```

### Available Tool Categories
Once connected, you'll have access to:
- **17 LSP tools** - Code navigation and understanding
- **13+ CDP tools** - Browser control and testing

### Example Tool Calls

**Search for text:**
```bash
curl -X POST http://127.0.0.1:9528/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
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

**Navigate browser:**
```bash
curl -X POST http://127.0.0.1:9528/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "navigate_browser",
      "arguments": {
        "url": "https://example.com"
      }
    },
    "id": 3
  }'
```

### Success Confirmation
When Gemini successfully connects and retrieves instructions, it should respond with:
- Confirmation of receiving the instructions
- Summary of key capabilities (LSP and CDP tools)
- Understanding of tool priorities and URI formatting

---

*This setup enables Gemini CLI to access Token Saver MCP's full capabilities through HTTP/curl commands, providing the same 100-1000x performance improvements and browser control features available to other AI assistants.*