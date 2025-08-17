#!/usr/bin/env python3
"""Test the get_call_hierarchy MCP tool"""

import json
import requests
from test_utils import get_test_uri

def call_mcp_tool(tool_name, arguments):
    """Call an MCP tool and parse the response"""
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
        return None
    
    # Call tool
    tool_request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "id": 1,
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    
    headers['mcp-session-id'] = session_id
    response = requests.post(base_url, json=tool_request, headers=headers, stream=True)
    
    # Parse SSE response
    if 'text/event-stream' in response.headers.get('Content-Type', ''):
        for line in response.text.split('\n'):
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])
                    if 'result' in data:
                        content = data['result']['content'][0]['text']
                        return json.loads(content)
                except:
                    pass
    return None

def test_call_hierarchy():
    """Test call hierarchy on various functions"""
    
    print("="*70)
    print("Testing get_call_hierarchy - Function Call Tracing")
    print("="*70)
    
    # Test 1: Incoming calls to getHover function
    print("\n1. Testing INCOMING calls to getHover function")
    print("-" * 50)
    
    result = call_mcp_tool("get_call_hierarchy", {
        "uri": get_test_uri('hover'),
        "line": 13,  # getHover function definition
        "character": 10,
        "direction": "incoming"
    })
    
    if result:
        target = result.get('target', {})
        calls = result.get('calls', [])
        
        print(f"Target: {target.get('name')} ({target.get('kind')})")
        print(f"Location: {target.get('uri', '').split('/')[-1]}")
        
        if calls:
            print(f"\n✓ Found {len(calls)} incoming call(s):")
            for i, call in enumerate(calls[:5], 1):  # Show first 5
                from_item = call.get('from', {})
                from_name = from_item.get('name', 'unknown')
                from_file = from_item.get('uri', '').split('/')[-1]
                from_ranges = call.get('fromRanges', [])
                
                print(f"\n  {i}. Called by: {from_name}")
                print(f"     File: {from_file}")
                if from_ranges:
                    for r in from_ranges[:2]:  # Show first 2 call locations
                        line = r['start']['line']
                        char = r['start']['character']
                        print(f"     Call at: line {line + 1}:{char}")
        else:
            print("✗ No incoming calls found")
    else:
        print("✗ Failed to get call hierarchy")
    
    # Test 2: Outgoing calls from addLspTools function
    print("\n2. Testing OUTGOING calls from addLspTools function")
    print("-" * 50)
    
    result = call_mcp_tool("get_call_hierarchy", {
        "uri": get_test_uri('tools'),
        "line": 19,  # addLspTools function
        "character": 17,
        "direction": "outgoing"
    })
    
    if result:
        target = result.get('target', {})
        calls = result.get('calls', [])
        
        print(f"Target: {target.get('name')} ({target.get('kind')})")
        print(f"Location: {target.get('uri', '').split('/')[-1]}")
        
        if calls:
            print(f"\n✓ Found {len(calls)} outgoing call(s):")
            for i, call in enumerate(calls[:10], 1):  # Show first 10
                from_item = call.get('from', {})
                from_name = from_item.get('name', 'unknown')
                from_kind = from_item.get('kind', 'unknown')
                
                print(f"  {i}. Calls: {from_name} ({from_kind})")
        else:
            print("✗ No outgoing calls found")
    else:
        print("✗ Failed to get call hierarchy")
    
    # Test 3: Incoming calls to withErrorHandling
    print("\n3. Testing INCOMING calls to withErrorHandling utility")
    print("-" * 50)
    
    result = call_mcp_tool("get_call_hierarchy", {
        "uri": get_test_uri('errors'),
        "line": 88,  # withErrorHandling function
        "character": 27,
        "direction": "incoming"
    })
    
    if result:
        target = result.get('target', {})
        calls = result.get('calls', [])
        
        print(f"Target: {target.get('name')} ({target.get('kind')})")
        
        if calls:
            print(f"\n✓ Found {len(calls)} file(s) calling this function:")
            
            # Group by file
            files = {}
            for call in calls:
                from_item = call.get('from', {})
                from_file = from_item.get('uri', '').split('/')[-1]
                from_name = from_item.get('name', 'unknown')
                
                if from_file not in files:
                    files[from_file] = []
                files[from_file].append(from_name)
            
            for file, callers in files.items():
                print(f"\n  {file}:")
                for caller in set(callers):  # Unique callers
                    print(f"    - {caller}")
        else:
            print("✗ No incoming calls found")
    else:
        print("✗ Failed to get call hierarchy")
    
    print("\n" + "="*70)
    print("Call Hierarchy Test Complete")
    print("="*70)

if __name__ == "__main__":
    test_call_hierarchy()