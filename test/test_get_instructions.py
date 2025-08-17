#!/usr/bin/env python3
"""Test the get_instructions tool"""
import requests
import json

def test_get_instructions():
    port = 9527
    base_url = f"http://127.0.0.1:{port}/mcp"
    
    # Initialize session
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
    }
    
    init_request = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "id": 0,
        "params": {
            "protocolVersion": "1.0.0",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0"}
        }
    }
    
    response = requests.post(base_url, json=init_request, headers=headers)
    session_id = response.headers.get('mcp-session-id')
    
    if not session_id:
        print("Failed to get session ID")
        return
    
    # List available tools
    list_request = {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "id": 1
    }
    
    headers['mcp-session-id'] = session_id
    response = requests.post(base_url, json=list_request, headers=headers, stream=True)
    
    # Handle streaming response
    full_response = ""
    for line in response.iter_lines():
        if line:
            line_str = line.decode('utf-8')
            if line_str.startswith("data: "):
                full_response += line_str[6:]
    
    try:
        result = json.loads(full_response)
    except:
        print(f"Failed to parse response: {full_response[:200]}")
        return
    
    if 'result' in result and 'tools' in result['result']:
        tools = result['result']['tools']
        print(f"Found {len(tools)} tools:")
        for tool in tools:
            print(f"  - {tool['name']}")
        
        # Check if get_instructions exists
        has_get_instructions = any(t['name'] == 'get_instructions' for t in tools)
        if has_get_instructions:
            print("\n✓ get_instructions tool is available!")
            
            # Test the tool
            tool_request = {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "id": 2,
                "params": {
                    "name": "get_instructions",
                    "arguments": {}
                }
            }
            
            response = requests.post(base_url, json=tool_request, headers=headers, stream=True)
            
            if response.status_code == 200:
                full_response = ""
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith("data: "):
                            full_response += line_str[6:]
                
                try:
                    result = json.loads(full_response)
                    if 'result' in result and 'content' in result['result']:
                        content = result['result']['content'][0].get('text', '')
                        print(f"\nInstructions returned: {len(content)} characters")
                        print("\nFirst 500 characters:")
                        print("-" * 50)
                        print(content[:500])
                        print("-" * 50)
                        print("\n✓ get_instructions tool works!")
                except Exception as e:
                    print(f"Error parsing response: {e}")
        else:
            print("\n✗ get_instructions tool NOT found")
    else:
        print("Failed to list tools")

if __name__ == "__main__":
    test_get_instructions()