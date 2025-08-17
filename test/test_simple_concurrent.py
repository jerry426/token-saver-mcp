#!/usr/bin/env python3
"""Simple test for concurrent connections"""

import json
import requests
import time

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

def main():
    print("=" * 60)
    print("TESTING MULTIPLE CONNECTIONS (SEQUENTIAL)")
    print("=" * 60)
    print()
    
    # Get the session info
    print("1. Getting current session info...")
    session_response = requests.get(SESSION_INFO_URL)
    session_data = session_response.json()
    print(f"   Current session: {session_data}")
    
    if not session_data.get('initialized'):
        print("\n2. Server not initialized, sending initialize...")
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
        print(f"   Initialize status: {init_response.status_code}")
        
        # Get session info again
        session_response = requests.get(SESSION_INFO_URL)
        session_data = session_response.json()
        print(f"   New session: {session_data}")
    
    session_id = session_data.get('sessionId')
    if not session_id:
        print("❌ No session ID available")
        return
    
    print(f"\n3. Testing with session ID: {session_id}")
    
    # Simulate Instance 1
    print("\n[Instance 1] Making request with correct session ID...")
    response1 = requests.post(
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
    if response1.status_code == 200:
        data = parse_event_stream(response1.text)
        if data and 'result' in data:
            print("   ✅ Success")
    else:
        print(f"   ❌ Failed: {response1.status_code}")
    
    # Simulate Instance 2 (with wrong session ID to test fallback)
    print("\n[Instance 2] Making request with WRONG session ID...")
    response2 = requests.post(
        BASE_URL,
        headers={**HEADERS, 'mcp-session-id': 'wrong-session-id'},
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_buffer_stats",
                "arguments": {}
            },
            "id": 3
        }
    )
    if response2.status_code == 200:
        data = parse_event_stream(response2.text)
        if data and 'result' in data:
            print("   ✅ Success (fallback worked!)")
    else:
        print(f"   ❌ Failed: {response2.status_code}")
        print(f"   Response: {response2.text[:200]}")
    
    # Simulate Instance 3 (no session ID)
    print("\n[Instance 3] Making request with NO session ID...")
    response3 = requests.post(
        BASE_URL,
        headers=HEADERS,  # No session ID header
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_buffer_stats",
                "arguments": {}
            },
            "id": 4
        }
    )
    if response3.status_code == 200:
        data = parse_event_stream(response3.text)
        if data and 'result' in data:
            print("   ✅ Success (sessionless worked!)")
    else:
        print(f"   ❌ Failed: {response3.status_code}")
        print(f"   Response: {response3.text[:200]}")
    
    print("\n" + "=" * 60)
    print("CONCLUSION")
    print("=" * 60)
    
    success_count = 0
    if response1.status_code == 200: success_count += 1
    if response2.status_code == 200: success_count += 1
    if response3.status_code == 200: success_count += 1
    
    if success_count == 3:
        print("✅ All connection patterns work!")
        print("  • Correct session ID: ✓")
        print("  • Wrong session ID with fallback: ✓")
        print("  • No session ID (sessionless): ✓")
    elif success_count == 1:
        print("⚠️  Only correct session ID works")
        print("  Fallback mechanism needs improvement")
    else:
        print(f"⚠️  {success_count}/3 connection patterns work")

if __name__ == "__main__":
    main()