#!/usr/bin/env python3
"""Test that multiple Claude Code instances can connect and work simultaneously"""

import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

PORT = 9527
BASE_URL = f"http://127.0.0.1:{PORT}/mcp"
SESSION_INFO_URL = f"http://127.0.0.1:{PORT}/session-info"

# Use proper headers that MCP expects
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
    """Simulate a Claude Code instance connecting and using MCP"""
    results = {
        'instance_id': instance_id,
        'steps': [],
        'session_id': None
    }
    
    try:
        # Step 1: First instance initializes, others may get "already initialized"
        print(f"[Instance {instance_id}] Attempting to initialize...")
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
        
        if init_response.status_code == 200:
            # Parse event stream response
            data = parse_event_stream(init_response.text)
            if data and 'result' in data:
                print(f"[Instance {instance_id}] ✅ Initialize succeeded")
                results['steps'].append({
                    'step': 'initialize',
                    'status': 200,
                    'success': True
                })
        else:
            print(f"[Instance {instance_id}] ⚠️  Initialize returned {init_response.status_code}")
            # This is expected for instances 2+ due to singleton
            results['steps'].append({
                'step': 'initialize',
                'status': init_response.status_code,
                'success': False,
                'note': 'Expected for singleton pattern'
            })
        
        # Step 2: Get the session info (all instances should do this)
        time.sleep(0.1)  # Small delay to ensure singleton is initialized
        session_response = requests.get(SESSION_INFO_URL)
        if session_response.status_code == 200:
            session_data = session_response.json()
            if session_data.get('initialized') and session_data.get('sessionId'):
                results['session_id'] = session_data['sessionId']
                print(f"[Instance {instance_id}] Got session ID: {results['session_id']}")
            else:
                print(f"[Instance {instance_id}] ❌ No session available")
                return results
        
        # Step 3: Use the session ID to make actual tool calls
        if results['session_id']:
            # Test 1: Get buffer stats
            tool_response = requests.post(
                BASE_URL,
                headers={**HEADERS, 'mcp-session-id': results['session_id']},
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
                    print(f"[Instance {instance_id}] ✅ Tool call succeeded")
                    results['steps'].append({
                        'step': 'tool_call_buffer_stats',
                        'status': 200,
                        'success': True
                    })
            else:
                print(f"[Instance {instance_id}] ❌ Tool call failed: {tool_response.status_code}")
                results['steps'].append({
                    'step': 'tool_call_buffer_stats',
                    'status': tool_response.status_code,
                    'success': False
                })
            
            # Test 2: Search for text (more realistic operation)
            search_response = requests.post(
                BASE_URL,
                headers={**HEADERS, 'mcp-session-id': results['session_id']},
                json={
                    "jsonrpc": "2.0",
                    "method": "tools/call",
                    "params": {
                        "name": "search_text",
                        "arguments": {
                            "query": "MCP"
                        }
                    },
                    "id": 3
                }
            )
            
            if search_response.status_code == 200:
                data = parse_event_stream(search_response.text)
                if data and 'result' in data:
                    print(f"[Instance {instance_id}] ✅ Search succeeded")
                    results['steps'].append({
                        'step': 'tool_call_search',
                        'status': 200,
                        'success': True
                    })
            
    except Exception as e:
        results['error'] = str(e)
        print(f"[Instance {instance_id}] ❌ Error: {e}")
    
    return results

def main():
    print("=" * 60)
    print("TESTING CONCURRENT CLAUDE CODE CONNECTIONS")
    print("=" * 60)
    print()
    
    # First, check if server is running and get initial state
    try:
        initial_session = requests.get(SESSION_INFO_URL).json()
        print(f"Initial server state: {initial_session}")
        print()
    except:
        print("❌ MCP server not running at port 9527")
        return
    
    # Test with 5 simulated instances connecting concurrently
    num_instances = 5
    
    print(f"Simulating {num_instances} Claude Code instances connecting concurrently...")
    print("(This simulates multiple VSCode windows with Claude Code)")
    print()
    
    with ThreadPoolExecutor(max_workers=num_instances) as executor:
        futures = [executor.submit(simulate_claude_instance, i+1) for i in range(num_instances)]
        
        all_results = []
        for future in as_completed(futures):
            result = future.result()
            all_results.append(result)
    
    # Analyze results
    print()
    print("=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    
    successful_instances = 0
    all_using_same_session = True
    first_session_id = None
    
    for result in sorted(all_results, key=lambda x: x['instance_id']):
        instance_id = result['instance_id']
        print(f"\nInstance {instance_id}:")
        
        if 'error' in result:
            print(f"  ❌ Error: {result['error']}")
            continue
        
        print(f"  Session ID: {result['session_id']}")
        
        # Check if all instances use the same session
        if first_session_id is None:
            first_session_id = result['session_id']
        elif result['session_id'] != first_session_id:
            all_using_same_session = False
        
        # Count successful operations
        successful_ops = sum(1 for step in result['steps'] 
                           if step.get('success') and 'tool_call' in step['step'])
        
        if successful_ops >= 2:  # Both tool calls succeeded
            successful_instances += 1
            print(f"  ✅ All operations successful")
        else:
            print(f"  ⚠️  Only {successful_ops}/2 tool operations succeeded")
    
    print()
    print("=" * 60)
    print("CONCLUSION")
    print("=" * 60)
    
    if successful_instances == num_instances and all_using_same_session:
        print(f"✅ SUCCESS: All {num_instances} instances connected and worked properly!")
        print(f"✅ All instances share the same session ID: {first_session_id}")
        print()
        print("Key achievements:")
        print("  • Singleton pattern ensures single server instance")
        print("  • All Claude Code instances can connect simultaneously")
        print("  • All instances share the same session (no conflicts)")
        print("  • Multiple concurrent operations work correctly")
        print("  • No session management complexity for users")
    else:
        print(f"⚠️  {successful_instances}/{num_instances} instances worked properly")
        if not all_using_same_session:
            print("⚠️  Instances are using different session IDs (unexpected)")

if __name__ == "__main__":
    main()