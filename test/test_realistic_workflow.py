#!/usr/bin/env python3
"""Test the realistic workflow for multiple Claude Code instances"""

import json
import requests

PORT = 9527
BASE_URL = f"http://127.0.0.1:{PORT}/mcp"
SESSION_INFO_URL = f"http://127.0.0.1:{PORT}/session-info"

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

def parse_event_stream(response_text):
    """Parse the event stream response format"""
    for line in response_text.split('\n'):
        if line.startswith('data: '):
            return json.loads(line[6:])
    return None

def simulate_claude_instance(instance_id):
    """Simulate how Claude Code would actually connect"""
    print(f"\n[Claude Code Instance {instance_id}]")
    print("-" * 40)
    
    # Step 1: Try to initialize (may fail if already initialized)
    print("1. Attempting to initialize...")
    init_response = requests.post(
        BASE_URL,
        headers=HEADERS,
        json={
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "0.1.0",
                "capabilities": {}
            },
            "id": 1
        }
    )
    
    session_id = None
    
    if init_response.status_code == 200:
        print("   ✅ Initialize succeeded (first instance)")
        # Get session from response headers if available
        session_id = init_response.headers.get('mcp-session-id')
        if not session_id:
            # Try to parse from response
            data = parse_event_stream(init_response.text)
            if data and 'result' in data:
                print("   Initialize response received")
    else:
        print(f"   ⚠️  Initialize failed with {init_response.status_code}")
        print("   (Expected for instances 2+ with singleton)")
    
    # Step 2: Get session info (fallback for getting session ID)
    if not session_id:
        print("\n2. Getting session info from /session-info...")
        session_response = requests.get(SESSION_INFO_URL)
        if session_response.status_code == 200:
            session_data = session_response.json()
            session_id = session_data.get('sessionId')
            if session_id:
                print(f"   ✅ Got session ID: {session_id}")
            else:
                print("   ❌ No session ID available")
                return False
    
    # Step 3: Use the session ID to make tool calls
    if session_id:
        print(f"\n3. Making tool call with session ID: {session_id}")
        tool_response = requests.post(
            BASE_URL,
            headers={**HEADERS, 'mcp-session-id': session_id},
            json={
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "get_buffer_stats",
                    "arguments": {}
                },
                "id": 2
            }
        )
        
        if tool_response.status_code == 200:
            data = parse_event_stream(tool_response.text)
            if data and 'result' in data:
                print("   ✅ Tool call succeeded!")
                return True
        else:
            print(f"   ❌ Tool call failed: {tool_response.status_code}")
            return False
    
    return False

def main():
    print("=" * 60)
    print("REALISTIC WORKFLOW FOR MULTIPLE CLAUDE CODE INSTANCES")
    print("=" * 60)
    print()
    print("This simulates how Claude Code would actually connect:")
    print("1. Try to initialize")
    print("2. If that fails, get session from /session-info")
    print("3. Use the session ID for all subsequent requests")
    
    # Simulate 3 Claude Code instances
    results = []
    for i in range(1, 4):
        success = simulate_claude_instance(i)
        results.append(success)
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    successful = sum(results)
    total = len(results)
    
    if successful == total:
        print(f"✅ SUCCESS: All {total} Claude Code instances connected!")
        print("\nHow it works:")
        print("• First instance initializes the singleton")
        print("• Other instances get 'already initialized' error")
        print("• All instances retrieve session ID from /session-info")
        print("• All instances share the same singleton session")
        print("• No complex session management needed!")
    else:
        print(f"⚠️  Only {successful}/{total} instances succeeded")
        print("\nClause Code would need to:")
        print("1. Handle initialize failures gracefully")
        print("2. Use /session-info endpoint to get existing session")

if __name__ == "__main__":
    main()