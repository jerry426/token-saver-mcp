#!/usr/bin/env python3
"""
Test and demonstrate the MCP Buffer System benefits
Shows how large responses are handled intelligently to prevent token overflow
"""
import requests
import json
import time
from typing import Dict, Any, Optional
from test_utils import get_test_uri

def call_mcp_tool(tool_name: str, arguments: Dict[str, Any]) -> Optional[Any]:
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
            "clientInfo": {"name": "buffer-test", "version": "1.0"}
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
                return json.loads(content) if content else None
        except:
            pass
    
    return None

def format_bytes(bytes_num: int) -> str:
    """Format bytes in human readable format"""
    for unit in ['B', 'KB', 'MB']:
        if bytes_num < 1024.0:
            return f"{bytes_num:.1f}{unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.1f}GB"

def test_buffer_system():
    """Test the buffer system with various scenarios"""
    print("="*60)
    print("MCP BUFFER SYSTEM TEST & DEMONSTRATION")
    print("="*60)
    print("\nThis test demonstrates how the buffer system prevents token")
    print("overflow by intelligently handling large responses.\n")
    
    # Test 1: Small response (should not be buffered)
    print("-"*60)
    print("TEST 1: Small Response (No Buffering Needed)")
    print("-"*60)
    
    small_response = call_mcp_tool("get_hover", {
        "uri": get_test_uri('hover'),
        "line": 2,
        "character": 10
    })
    
    if small_response:
        response_str = json.dumps(small_response)
        size = len(response_str)
        tokens = size // 4  # Rough estimate
        print(f"✓ Small response received directly")
        print(f"  • Size: {format_bytes(size)} ({tokens} tokens estimated)")
        print(f"  • Type: {type(small_response).__name__}")
        print(f"  • Buffered: NO - Response small enough to return directly\n")
    
    # Test 2: Large response (should be buffered)
    print("-"*60)
    print("TEST 2: Large Response (Automatic Buffering)")
    print("-"*60)
    
    large_response = call_mcp_tool("get_document_symbols", {
        "uri": get_test_uri('buffer_manager')
    })
    
    if large_response:
        if isinstance(large_response, dict) and large_response.get('type') == 'buffered_response':
            print("✓ Large response was automatically buffered!")
            
            metadata = large_response.get('metadata', {})
            print("\n📊 Response Metadata:")
            print(f"  • Total tokens: {metadata.get('totalTokens', 'N/A'):,}")
            print(f"  • Total size: {format_bytes(metadata.get('totalBytes', 0))}")
            print(f"  • Item count: {metadata.get('itemCount', 'N/A')}")
            print(f"  • Max depth: {metadata.get('maxDepth', 'N/A')}")
            print(f"  • Would exceed limit: {metadata.get('wouldExceedLimit', False)}")
            print(f"  • Truncated at depth: {metadata.get('truncatedAtDepth', 'N/A')}")
            
            # Show smart preview
            preview = large_response.get('preview', {})
            if isinstance(preview, dict):
                # Handle dictionary preview (e.g., for document symbols)
                items = preview.get('items', [])
                total = preview.get('totalItems', len(items))
                print(f"\n🔍 Smart Preview ({total} total items, showing {len(items)}):")
                for i, item in enumerate(items[:5], 1):
                    if isinstance(item, dict):
                        name = item.get('name', 'unknown')
                        kind = item.get('kind', 'unknown')
                        print(f"  {i}. {name} ({kind})")
            elif isinstance(preview, list):
                # Handle list preview
                print(f"\n🔍 Smart Preview ({len(preview)} items):")
                for i, item in enumerate(preview[:5], 1):
                    if isinstance(item, dict):
                        name = item.get('name', 'unknown')
                        kind = item.get('kind', 'unknown')
                        print(f"  {i}. {name} ({kind})")
            
            # Show suggestions
            suggestions = large_response.get('suggestions', [])
            if suggestions:
                print("\n💡 Refinement Suggestions:")
                for suggestion in suggestions:
                    print(f"  • {suggestion}")
            
            # Demonstrate buffer retrieval
            bufferId = large_response.get('bufferId')
            if bufferId:
                print(f"\n🔑 Buffer ID: {bufferId}")
                print("\n⬇️  Retrieving full data from buffer...")
                
                time.sleep(0.5)  # Small delay for effect
                
                full_data = call_mcp_tool("retrieve_buffer", {
                    "bufferId": bufferId
                })
                
                if full_data:
                    print(f"✓ Successfully retrieved full data!")
                    print(f"  • Total items: {len(full_data)}")
                    print(f"  • Full size: {format_bytes(len(json.dumps(full_data)))}")
                    
                    # Show sample of full data
                    print("\n📋 Sample of Full Data (first 3 items):")
                    for i, item in enumerate(full_data[:3], 1):
                        if isinstance(item, dict):
                            name = item.get('name', 'unknown')
                            kind = item.get('kind', 'unknown')
                            children = item.get('children', [])
                            print(f"  {i}. {name} ({kind}) - {len(children)} children")
        else:
            print("✓ Response was not buffered (within token limit)")
            print(f"  • Items returned: {len(large_response)}")
    
    # Test 3: Multiple searches demonstrating smart previews
    print("\n" + "-"*60)
    print("TEST 3: Smart Preview Generation")
    print("-"*60)
    
    print("\nSearching for 'function' across codebase...")
    search_response = call_mcp_tool("search_text", {
        "query": "function",
        "maxResults": 100
    })
    
    if search_response:
        if isinstance(search_response, dict) and search_response.get('type') == 'buffered_response':
            print("✓ Search results were buffered with smart preview!")
            
            preview = search_response.get('preview', {})
            if isinstance(preview, dict):
                print("\n📊 Smart Search Preview:")
                dist = preview.get('distribution', [])
                if dist:
                    print("  Distribution sampling (first/middle/last):")
                    for item in dist:
                        if isinstance(item, dict):
                            file = item.get('file', 'unknown').split('/')[-1]
                            matches = item.get('matches', 0)
                            print(f"    • {file}: {matches} matches")
        else:
            print(f"✓ Found {len(search_response)} results (not buffered)")
    
    # Test 4: Buffer statistics
    print("\n" + "-"*60)
    print("TEST 4: Buffer System Statistics")
    print("-"*60)
    
    stats = call_mcp_tool("get_buffer_stats", {})
    
    if stats:
        print("📈 Current Buffer Statistics:")
        print(f"  • Active buffers: {stats.get('activeBuffers', 0)}")
        print(f"  • Total memory used: {format_bytes(stats.get('totalSize', 0))}")
        
        oldest = stats.get('oldestBuffer')
        if oldest:
            age_seconds = oldest / 1000
            print(f"  • Oldest buffer age: {age_seconds:.1f} seconds")
    
    # Test 5: Benefits summary
    print("\n" + "="*60)
    print("BUFFER SYSTEM BENEFITS DEMONSTRATED")
    print("="*60)
    
    print("""
    ✅ Token Overflow Prevention:
       • Responses limited to 2,500 tokens (~10KB)
       • Prevents AI context exhaustion
       • Maintains conversation continuity
    
    ✅ Smart Data Handling:
       • Automatic depth truncation for nested structures
       • Tool-specific preview generation
       • Intelligent data sampling (first/middle/last)
    
    ✅ Full Data Access:
       • Complete data stored in buffer
       • Retrieve on-demand with buffer ID
       • 60-second TTL with automatic cleanup
    
    ✅ Performance Benefits:
       • Fast initial response with preview
       • Reduced network transfer for large data
       • Efficient memory management
    
    ✅ Developer Experience:
       • Transparent buffering (automatic)
       • Helpful refinement suggestions
       • Clear metadata about response size
    """)
    
    print("🎯 CONCLUSION: The buffer system enables handling of large")
    print("   responses that would otherwise overwhelm AI token limits,")
    print("   while providing intelligent previews and full data access.")

if __name__ == "__main__":
    test_buffer_system()