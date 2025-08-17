#!/usr/bin/env python3
"""
Comprehensive test suite for Token Saver MCP extension
Tests all MCP tools after installation
"""
import requests
import json
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
    for line in response.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith('data: '):
                data = json.loads(decoded[6:])
                if 'result' in data:
                    content = data['result'].get('content', [])
                    if content and content[0].get('type') == 'text':
                        # Parse the nested JSON
                        try:
                            return json.loads(content[0]['text'])
                        except:
                            return content[0]['text']
                return None

def test_all_tools():
    """Test all MCP tools"""
    print("="*50)
    print("Token Saver MCP Extension Test Suite v0.0.6")
    print("="*50)
    
    results = {}
    
    # Test hover
    print("\n1. Testing get_hover...")
    hover = call_mcp_tool("get_hover", {
        "uri": get_test_uri('package'),
        "line": 1,
        "character": 4
    })
    if hover and len(hover) > 0:
        print("   ✓ Hover works - returned documentation")
        results['hover'] = True
    else:
        print("   ✗ Hover failed")
        results['hover'] = False
    
    # Test completions
    print("\n2. Testing get_completions...")
    completions = call_mcp_tool("get_completions", {
        "uri": get_test_uri('index'),
        "line": 5,
        "character": 7
    })
    if completions and len(completions) > 0:
        print(f"   ✓ Completions works - returned {len(completions)} items")
        results['completions'] = True
    else:
        print("   ✗ Completions failed")
        results['completions'] = False
    
    # Test definition
    print("\n3. Testing get_definition...")
    definition = call_mcp_tool("get_definition", {
        "uri": get_test_uri('hover'),
        "line": 1,  # On vscode import
        "character": 15
    })
    if definition and len(definition) > 0:
        print(f"   ✓ Definition works - found {len(definition)} location(s)")
        results['definition'] = True
    else:
        print("   ✗ Definition failed")
        results['definition'] = False
    
    # Test references
    print("\n4. Testing get_references...")
    references = call_mcp_tool("get_references", {
        "uri": get_test_uri('hover'),
        "line": 2,
        "character": 10
    })
    if references and len(references) > 0:
        print(f"   ✓ References works - found {len(references)} reference(s)")
        results['references'] = True
    else:
        print("   ✗ References failed")
        results['references'] = False
    
    # Test implementations (new in v0.0.6)
    print("\n5. Testing find_implementations...")
    implementations = call_mcp_tool("find_implementations", {
        "uri": get_test_uri('errors'),
        "line": 5,  # On LSPError class
        "character": 15
    })
    # Implementations might be empty for concrete classes, that's OK
    if implementations is not None:
        if len(implementations) > 0:
            print(f"   ✓ Implementations works - found {len(implementations)} implementation(s)")
        else:
            print("   ✓ Implementations works - no implementations (expected for concrete class)")
        results['implementations'] = True
    else:
        print("   ✗ Implementations failed")
        results['implementations'] = False
    
    # Test document symbols (new in v0.0.10)
    print("\n6. Testing get_document_symbols...")
    doc_symbols = call_mcp_tool("get_document_symbols", {
        "uri": get_test_uri('index')
    })
    if doc_symbols is not None and len(doc_symbols) > 0:
        print(f"   ✓ Document symbols works - found {len(doc_symbols)} top-level symbol(s)")
        # Show symbol types
        symbol_types = {}
        for sym in doc_symbols:
            kind = sym.get('kind', 'Unknown')
            symbol_types[kind] = symbol_types.get(kind, 0) + 1
        print(f"     Symbol types: {symbol_types}")
        results['document_symbols'] = True
    else:
        print("   ✗ Document symbols failed")
        results['document_symbols'] = False
    
    # Test text search
    print("\n7. Testing search_text...")
    search = call_mcp_tool("search_text", {
        "query": "getHover",
        "maxResults": 5
    })
    if search and len(search) > 0:
        print(f"   ✓ Text search works - found {len(search)} match(es)")
        results['search'] = True
    else:
        print("   ✗ Text search failed")
        results['search'] = False
    
    # Test 8: CALL HIERARCHY
    print("\n8. Testing get_call_hierarchy...")
    call_hierarchy = call_mcp_tool("get_call_hierarchy", {
        "uri": get_test_uri('mcp_index'),
        "line": 50,  # startMcp function
        "character": 17,
        "direction": "incoming"
    })
    if call_hierarchy is not None:
        if isinstance(call_hierarchy, dict) and 'target' in call_hierarchy:
            target_name = call_hierarchy.get('target', {}).get('name', 'unknown')
            calls_count = len(call_hierarchy.get('calls', []))
            print(f"   ✓ Call hierarchy works - target: {target_name}, {calls_count} call(s)")
            results['call_hierarchy'] = True
        elif isinstance(call_hierarchy, list):
            print(f"   ✓ Call hierarchy works - returned {len(call_hierarchy)} item(s)")
            results['call_hierarchy'] = True
        else:
            print(f"   ✓ Call hierarchy works - returned result")
            results['call_hierarchy'] = True
    else:
        print("   ✗ Call hierarchy failed")
        results['call_hierarchy'] = False
    
    # Test rename
    print("\n9. Testing rename_symbol...")
    rename = call_mcp_tool("rename_symbol", {
        "uri": get_test_uri('hover'),
        "line": 14,  # function parameter
        "character": 3,
        "newName": "documentUri"
    })
    if rename:
        if isinstance(rename, dict) and 'changes' in rename:
            print(f"   ✓ Rename works - would affect {len(rename['changes'])} file(s)")
            results['rename'] = True
        elif isinstance(rename, list):
            print("   ✓ Rename works - returned edit operations")
            results['rename'] = True
        else:
            print("   ✓ Rename works - returned result")
            results['rename'] = True
    else:
        print("   ✗ Rename failed")
        results['rename'] = False
    
    # Test buffer system
    print("\n10. Testing buffer system...")
    # Trigger a large response
    large_symbols = call_mcp_tool("get_document_symbols", {
        "uri": get_test_uri('buffer_manager')
    })
    if large_symbols:
        if isinstance(large_symbols, dict) and large_symbols.get('type') == 'buffered_response':
            print(f"   ✓ Buffer system works - response buffered ({large_symbols.get('metadata', {}).get('totalTokens', 0)} tokens)")
            results['buffer_system'] = True
            
            # Test retrieve_buffer
            bufferId = large_symbols.get('bufferId')
            if bufferId:
                full_data = call_mcp_tool("retrieve_buffer", {"bufferId": bufferId})
                if full_data:
                    print(f"   ✓ retrieve_buffer works - retrieved {len(full_data)} items")
                    results['retrieve_buffer'] = True
                else:
                    print("   ✗ retrieve_buffer failed")
                    results['retrieve_buffer'] = False
        else:
            print("   ✓ Response not buffered (small enough)")
            results['buffer_system'] = True
            results['retrieve_buffer'] = True
    else:
        print("   ✗ Buffer system test failed")
        results['buffer_system'] = False
        results['retrieve_buffer'] = False
    
    # Test buffer stats
    print("\n11. Testing get_buffer_stats...")
    stats = call_mcp_tool("get_buffer_stats", {})
    if stats:
        print(f"   ✓ Buffer stats works - {stats.get('activeBuffers', 0)} active buffer(s)")
        results['buffer_stats'] = True
    else:
        print("   ✗ Buffer stats failed")
        results['buffer_stats'] = False
    
    # Summary
    print("\n" + "="*50)
    print("TEST RESULTS SUMMARY")
    print("="*50)
    
    tools = [
        ('get_hover', results.get('hover', False)),
        ('get_completions', results.get('completions', False)),
        ('get_definition', results.get('definition', False)),
        ('get_references', results.get('references', False)),
        ('find_implementations', results.get('implementations', False)),
        ('get_document_symbols', results.get('document_symbols', False)),
        ('search_text', results.get('search', False)),
        ('get_call_hierarchy', results.get('call_hierarchy', False)),
        ('rename_symbol', results.get('rename', False)),
        ('buffer_system', results.get('buffer_system', False)),
        ('retrieve_buffer', results.get('retrieve_buffer', False)),
        ('get_buffer_stats', results.get('buffer_stats', False))
    ]
    
    for tool_name, passed in tools:
        status = "✓ WORKING" if passed else "✗ NEEDS FIX"
        print(f"{tool_name:25} {status}")
    
    passed_count = sum(1 for _, p in tools if p)
    total_count = len(tools)
    
    print("="*50)
    if passed_count == total_count:
        print(f"🎉 SUCCESS! All {total_count} tools are working!")
    elif passed_count >= 5:
        print(f"✓ GOOD: {passed_count}/{total_count} tools working")
    else:
        print(f"⚠️  NEEDS WORK: Only {passed_count}/{total_count} tools working")
    
    return results

if __name__ == "__main__":
    test_all_tools()