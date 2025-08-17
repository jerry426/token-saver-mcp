#!/usr/bin/env python3
"""Test multiple Claude Code instances connecting to sessionless MCP server"""

import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

PORT = 9527
BASE_URL = f"http://127.0.0.1:{PORT}/mcp"

def simulate_claude_instance(instance_id):
    """Simulate a Claude Code instance connecting and using MCP"""
    results = {
        'instance_id': instance_id,
        'steps': []
    }
    
    try:
        # Step 1: Send initialize request
        print(f"[Instance {instance_id}] Sending initialize request...")
        init_response = requests.post(
            BASE_URL,
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
        
        session_id = init_response.headers.get('mcp-session-id')
        results['steps'].append({
            'step': 'initialize',
            'status': init_response.status_code,
            'session_id': session_id,
            'response': init_response.json() if init_response.status_code == 200 else init_response.text
        })
        
        if init_response.status_code != 200:
            print(f"[Instance {instance_id}] ⚠️  Initialize returned {init_response.status_code}")
            # Even if initialize fails (e.g., already initialized), try to get session info
            
        # Step 2: Try to use a tool with the session ID (if we got one)
        if session_id:
            print(f"[Instance {instance_id}] Using session ID: {session_id}")
            tool_response = requests.post(
                BASE_URL,
                headers={'mcp-session-id': session_id},
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
            results['steps'].append({
                'step': 'tool_call',
                'status': tool_response.status_code,
                'success': tool_response.status_code == 200
            })
        
        # Step 3: Try with an invalid session ID to test fallback
        print(f"[Instance {instance_id}] Testing fallback with invalid session...")
        fallback_response = requests.post(
            BASE_URL,
            headers={'mcp-session-id': f'invalid-session-{instance_id}'},
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
        results['steps'].append({
            'step': 'fallback_test',
            'status': fallback_response.status_code,
            'success': fallback_response.status_code == 200,
            'comment': 'Should succeed with fallback to singleton'
        })
        
    except Exception as e:
        results['error'] = str(e)
    
    return results

def main():
    print("=" * 60)
    print("TESTING MULTIPLE CLAUDE CODE INSTANCES")
    print("=" * 60)
    print()
    
    # Test with 3 simulated instances
    num_instances = 3
    
    print(f"Simulating {num_instances} Claude Code instances connecting...")
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
    for result in sorted(all_results, key=lambda x: x['instance_id']):
        instance_id = result['instance_id']
        print(f"\nInstance {instance_id}:")
        
        if 'error' in result:
            print(f"  ❌ Error: {result['error']}")
            continue
            
        for step in result['steps']:
            if step['step'] == 'initialize':
                if step['status'] == 200:
                    print(f"  ✅ Initialize succeeded (session: {step['session_id']})")
                else:
                    print(f"  ⚠️  Initialize returned {step['status']} (expected with singleton)")
            elif step['step'] == 'tool_call':
                if step['success']:
                    print(f"  ✅ Tool call succeeded")
                else:
                    print(f"  ❌ Tool call failed")
            elif step['step'] == 'fallback_test':
                if step['success']:
                    print(f"  ✅ Fallback to singleton worked!")
                    successful_instances += 1
                else:
                    print(f"  ❌ Fallback failed (status: {step['status']})")
    
    print()
    print("=" * 60)
    print("CONCLUSION")
    print("=" * 60)
    
    if successful_instances == num_instances:
        print(f"✅ SUCCESS: All {num_instances} instances can connect and use MCP!")
        print()
        print("Key improvements:")
        print("  • Singleton pattern ensures single server instance")
        print("  • Invalid session IDs fall back to singleton")
        print("  • Multiple Claude Code instances share same server")
        print("  • No session management complexity")
    else:
        print(f"⚠️  Only {successful_instances}/{num_instances} instances worked properly")
        print("Check the logs for issues")

if __name__ == "__main__":
    main()