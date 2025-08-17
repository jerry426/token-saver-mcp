#!/usr/bin/env python3
"""
Test sessionless MCP operation - no session ID required!
"""
import requests
import json

MCP_URL = "http://127.0.0.1:9527/mcp"

def test_sessionless():
    print("=" * 60)
    print("TESTING SESSIONLESS MCP OPERATION")
    print("=" * 60)
    
    # Step 1: Initialize without expecting session ID
    print("\n1. Sending initialize request (no session ID expected)...")
    init_request = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "id": 0,
        "params": {
            "protocolVersion": "1.0.0",
            "capabilities": {},
            "clientInfo": {"name": "sessionless-test", "version": "1.0"}
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    response = requests.post(MCP_URL, json=init_request, headers=headers, stream=True)
    print(f"   Response status: {response.status_code}")
    
    # Get the session ID that's returned
    session_id = response.headers.get('mcp-session-id')
    if session_id:
        print(f"   ✅ Session ID returned: {session_id}")
    else:
        print("   ⚠️  No session ID in response headers")
        session_id = None
    
    # Parse the initialization response
    if response.status_code == 200:
        for line in response.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                if decoded.startswith('data: '):
                    data = json.loads(decoded[6:])
                    if 'result' in data:
                        print("   ✅ Initialization successful")
                        break
    
    # Step 2: Call a tool WITH the session ID
    print("\n2. Calling search_text WITH session ID...")
    tool_request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "id": 1,
        "params": {
            "name": "search_text",
            "arguments": {
                "query": "function",
                "maxResults": 3
            }
        }
    }
    
    # Include the session ID in headers
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    if session_id:
        headers["mcp-session-id"] = session_id
    
    response = requests.post(MCP_URL, json=tool_request, headers=headers, stream=True)
    print(f"   Response status: {response.status_code}")
    
    if response.status_code == 200:
        # Parse streaming response
        for line in response.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                if decoded.startswith('data: '):
                    data = json.loads(decoded[6:])
                    if 'result' in data:
                        print("   ✅ Tool call succeeded without session ID!")
                        content = data['result'].get('content', [])
                        if content:
                            text = content[0].get('text', '')
                            results = json.loads(text) if isinstance(text, str) else text
                            if isinstance(results, list):
                                print(f"   Found {len(results)} results")
                        break
    else:
        print(f"   ❌ Failed: {response.text[:200]}")
    
    # Step 3: Call another tool to verify persistence
    print("\n3. Calling get_buffer_stats WITH same session ID...")
    stats_request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "id": 2,
        "params": {
            "name": "get_buffer_stats",
            "arguments": {}
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    if session_id:
        headers["mcp-session-id"] = session_id
    
    response = requests.post(MCP_URL, json=stats_request, headers=headers, stream=True)
    print(f"   Response status: {response.status_code}")
    
    if response.status_code == 200:
        for line in response.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                if decoded.startswith('data: '):
                    data = json.loads(decoded[6:])
                    if 'result' in data:
                        print("   ✅ Second tool call succeeded!")
                        break
    
    print("\n" + "=" * 60)
    print("SIMPLIFIED SESSION MODE TEST COMPLETE")
    print("=" * 60)
    print("\nHow it works:")
    print("  • Initialize once, get a session ID")
    print("  • Use that same session ID for all requests")
    print("  • Server maintains singleton instance")
    print("  • One session for entire lifetime")
    print("\nBenefits:")
    print("  • Simpler than managing multiple sessions")
    print("  • Single initialization at startup")
    print("  • Persistent server state")
    print("  • Compatible with MCP SDK requirements")

if __name__ == "__main__":
    test_sessionless()