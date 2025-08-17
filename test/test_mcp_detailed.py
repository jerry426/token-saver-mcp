#!/usr/bin/env python3
"""
Detailed test suite for Token Saver MCP extension
Shows actual content returned by each tool
"""
import requests
import json
import textwrap
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

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def truncate(text, length=100):
    """Truncate long text with ellipsis"""
    if len(text) > length:
        return text[:length] + "..."
    return text

def test_all_tools_detailed():
    """Test all MCP tools with detailed output"""
    print("\n" + "="*60)
    print("  Token Saver MCP - DETAILED TEST RESULTS")
    print("="*60)
    
    # Test 1: HOVER
    print_section("1. GET_HOVER - Documentation & Type Info")
    hover = call_mcp_tool("get_hover", {
        "uri": get_test_uri('hover'),
        "line": 13,  # export async function getHover
        "character": 23  # On 'getHover'
    })
    
    if hover:
        if isinstance(hover, list) and len(hover) > 0:
            print(f"✓ Found {len(hover)} hover result(s)")
            for i, h in enumerate(hover[:2], 1):  # Show first 2
                print(f"\n  Hover #{i}:")
                if 'range' in h:
                    r = h['range']
                    print(f"    Range: Line {r['start']['line']}:{r['start']['character']} to {r['end']['line']}:{r['end']['character']}")
                if 'contents' in h:
                    contents = h['contents']
                    if isinstance(contents, list):
                        for j, content in enumerate(contents[:3], 1):  # First 3 contents
                            if isinstance(content, dict):
                                kind = content.get('kind', 'unknown')
                                value = content.get('value', '')
                                lang = content.get('language', '')
                                print(f"    Content {j} ({kind}{' ' + lang if lang else ''}):")
                                # Wrap long content
                                wrapped = textwrap.fill(value, width=50, initial_indent="      ", subsequent_indent="      ")
                                print(truncate(wrapped, 200))
                    elif isinstance(contents, str):
                        print(f"    Content: {truncate(contents, 200)}")
        elif isinstance(hover, dict):
            # Might be a buffered response or single hover item
            if hover.get('type') == 'buffered_response':
                print("✓ Hover results were buffered")
                print(f"    • Total items: {hover.get('metadata', {}).get('itemCount', 'unknown')}")
            else:
                print("✓ Found hover result")
                if 'contents' in hover:
                    print(f"    Content: {truncate(str(hover['contents']), 200)}")
        else:
            print("✗ Unexpected hover format")
    else:
        print("✗ No hover results")
    
    # Test 2: COMPLETIONS
    print_section("2. GET_COMPLETIONS - Code Suggestions")
    completions = call_mcp_tool("get_completions", {
        "uri": get_test_uri('hover'),
        "line": 18,  # const position = new vscode.Position
        "character": 37  # After 'new vscode.'
    })
    
    if completions:
        # Handle buffered response
        if isinstance(completions, dict) and completions.get('type') == 'buffered_response':
            print("✓ Completions were buffered")
            metadata = completions.get('metadata', {})
            print(f"    • Total items: {metadata.get('itemCount', 'unknown')}")
            preview = completions.get('preview', [])
            if isinstance(preview, dict):
                # Smart preview for completions
                print(f"    • Total completions: {preview.get('totalCompletions', 0)}")
                by_category = preview.get('byCategory', {})
                for category, items in list(by_category.items())[:5]:
                    print(f"    • {category}: {items.get('count', 0)} items")
            elif isinstance(preview, list):
                for i, comp in enumerate(preview[:10], 1):
                    label = comp.get('label', 'unknown')
                    print(f"    {i:2}. {label}")
        elif isinstance(completions, list) and len(completions) > 0:
            print(f"✓ Found {len(completions)} completion(s)")
            print("\n  Top 10 completions:")
            for i, comp in enumerate(completions[:10], 1):
                label = comp.get('label', 'unknown')
                kind = comp.get('kind', '')
                detail = comp.get('detail', '')
                print(f"    {i:2}. {label:30} {f'(kind: {kind})' if kind else ''}")
                if detail:
                    print(f"        Detail: {truncate(detail, 50)}")
        else:
            print("✗ Unexpected completion format")
    else:
        print("✗ No completions")
    
    # Test 3: DEFINITION
    print_section("3. GET_DEFINITION - Jump to Definition")
    # Test on logger import (using proper 0-based line numbers)
    definition = call_mcp_tool("get_definition", {
        "uri": get_test_uri('hover'),
        "line": 1,  # Line 2 in file (0-indexed as 1): import { logger } from '../utils'
        "character": 10  # On 'logger'
    })
    
    if definition:
        if isinstance(definition, list) and len(definition) > 0:
            print(f"✓ Found {len(definition)} definition(s)")
            for i, def_loc in enumerate(definition[:5], 1):  # Show first 5
                uri = def_loc['uri'].split('/')[-1]  # Just filename
                r = def_loc['range']
                print(f"    {i}. {uri}")
                print(f"       Line {r['start']['line']}:{r['start']['character']} to {r['end']['line']}:{r['end']['character']}")
        elif isinstance(definition, dict) and definition.get('type') == 'buffered_response':
            print("✓ Definitions were buffered")
            print(f"    • Total items: {definition.get('metadata', {}).get('itemCount', 'unknown')}")
        else:
            print("✗ Unexpected definition format")
    else:
        print("✗ No definitions found")
    
    # Test 4: REFERENCES
    print_section("4. GET_REFERENCES - Find All Usages")
    references = call_mcp_tool("get_references", {
        "uri": get_test_uri('hover'),
        "line": 2,  # import { logger }
        "character": 10  # On 'logger'
    })
    
    if references:
        if isinstance(references, list) and len(references) > 0:
            print(f"✓ Found {len(references)} reference(s) to 'logger'")
            # Group by file
            files = {}
            for ref in references:
                filename = ref['uri'].split('/')[-1]
                if filename not in files:
                    files[filename] = []
                r = ref['range']['start']
                files[filename].append(f"{r['line']}:{r['character']}")
            
            print("\n  References by file:")
            for filename, positions in list(files.items())[:5]:  # First 5 files
                # Sort positions by line number for readability
                sorted_positions = sorted(positions, key=lambda p: int(p.split(':')[0]))
                print(f"    • {filename}: {', '.join(sorted_positions[:5])}")
                if len(positions) > 5:
                    print(f"      ... and {len(positions) - 5} more")
        elif isinstance(references, dict) and references.get('type') == 'buffered_response':
            print("✓ References were buffered")
            metadata = references.get('metadata', {})
            print(f"    • Total references: {metadata.get('itemCount', 'unknown')}")
            preview = references.get('preview', {})
            if isinstance(preview, dict):
                print(f"    • Files affected: {preview.get('fileCount', 'unknown')}")
        else:
            print("✗ Unexpected references format")
    else:
        print("✗ No references found")
    
    # Test 5: IMPLEMENTATIONS
    print_section("5. FIND_IMPLEMENTATIONS - Interface Implementations")
    implementations = call_mcp_tool("find_implementations", {
        "uri": get_test_uri('errors'),
        "line": 5,  # export class LSPError extends Error
        "character": 32  # On 'Error'
    })
    
    if implementations:
        if isinstance(implementations, list) and len(implementations) > 0:
            print(f"✓ Found {len(implementations)} implementation(s) of Error class")
            print("\n  Sample implementations:")
            for i, impl in enumerate(implementations[:8], 1):  # Show first 8
                uri = impl['uri'].split('/')[-1]
                r = impl['range']
                line = r['start']['line']
                char = r['start']['character']
                print(f"    {i}. {uri:40} line {line}:{char}")
        elif isinstance(implementations, dict) and implementations.get('type') == 'buffered_response':
            print("✓ Implementations were buffered")
            print(f"    • Total items: {implementations.get('metadata', {}).get('itemCount', 'unknown')}")
        else:
            print("✗ Unexpected implementations format")
    else:
        print("✗ No implementations found")
    
    # Test 6: DOCUMENT SYMBOLS
    print_section("6. GET_DOCUMENT_SYMBOLS - File Structure")
    doc_symbols = call_mcp_tool("get_document_symbols", {
        "uri": get_test_uri('tools')
    })
    
    if doc_symbols:
        # Handle buffered response
        if isinstance(doc_symbols, dict) and doc_symbols.get('type') == 'buffered_response':
            print("✓ Document symbols were buffered")
            metadata = doc_symbols.get('metadata', {})
            print(f"    • Total symbols: {metadata.get('itemCount', 'unknown')}")
            print(f"    • Response size: {metadata.get('totalBytes', 0)} bytes")
            print(f"    • Truncated at depth: {metadata.get('truncatedAtDepth', 'N/A')}")
            
            preview = doc_symbols.get('preview', {})
            if isinstance(preview, dict):
                # Handle dictionary preview format
                items = preview.get('items', [])
                total = preview.get('totalItems', len(items))
                if items:
                    print(f"\n  Preview of top-level symbols ({len(items)} of {total} shown):")
                    for i, sym in enumerate(items[:5], 1):
                        if isinstance(sym, dict):
                            name = sym.get('name', 'unknown')
                            kind = sym.get('kind', 'unknown')
                            children_count = len(sym.get('children', []))
                            print(f"    {i}. {name} ({kind}) - {children_count} children")
            elif isinstance(preview, list) and preview:
                # Handle list preview format
                print(f"\n  Preview of top-level symbols ({len(preview)} shown):")
                for i, sym in enumerate(preview[:5], 1):
                    if isinstance(sym, dict):
                        name = sym.get('name', 'unknown')
                        kind = sym.get('kind', 'unknown')
                        children_count = len(sym.get('children', []))
                        print(f"    {i}. {name} ({kind}) - {children_count} children")
        elif isinstance(doc_symbols, list) and len(doc_symbols) > 0:
            print(f"✓ Found {len(doc_symbols)} top-level symbol(s)")
            
            # Count symbol types
            def count_symbols(symbols, counts=None):
                if counts is None:
                    counts = {}
                for sym in symbols:
                    if isinstance(sym, dict):
                        kind = sym.get('kind', 'Unknown')
                        counts[kind] = counts.get(kind, 0) + 1
                        if 'children' in sym and sym['children']:
                            count_symbols(sym['children'], counts)
                return counts
            
            type_counts = count_symbols(doc_symbols)
            print(f"\n  Symbol types: {type_counts}")
            
            # Show symbol hierarchy
            print("\n  File structure:")
            def print_symbol(sym, indent=0):
                if not isinstance(sym, dict):
                    return
                prefix = "  " * (indent + 2)
                kind = sym.get('kind', 'Unknown')
                name = sym.get('name', 'unnamed')
                line = sym.get('range', {}).get('start', {}).get('line', 0)
                
                # Truncate long names
                if len(name) > 40:
                    name = name[:37] + "..."
                
                print(f"{prefix}├─ {kind}: {name} (line {line + 1})")
                
                # Show first few children
                if 'children' in sym and sym['children']:
                    children = sym['children'][:3]  # Limit to first 3 children
                    for child in children:
                        print_symbol(child, indent + 1)
                    if len(sym['children']) > 3:
                        print(f"{prefix}  └─ ... and {len(sym['children']) - 3} more")
            
            # Show first few top-level symbols
            for symbol in doc_symbols[:5]:
                print_symbol(symbol)
            
            if len(doc_symbols) > 5:
                print(f"\n  ... and {len(doc_symbols) - 5} more top-level symbols")
        else:
            print("✗ Unexpected document symbols format")
    else:
        print("✗ No document symbols found")
    
    # Test 7: TEXT SEARCH
    print_section("7. SEARCH_TEXT - Find Text in Files")
    search = call_mcp_tool("search_text", {
        "query": "withErrorHandling",
        "maxResults": 10
    })
    
    if search and len(search) > 0:
        print(f"✓ Found {len(search)} file(s) containing 'withErrorHandling'")
        for i, result in enumerate(search, 1):
            filename = result.get('file', 'unknown')
            matches = result.get('matches', 0)
            preview = result.get('preview', '')
            first_match = result.get('firstMatch', {})
            print(f"\n    {i}. {filename} ({matches} match{'es' if matches != 1 else ''})")
            if first_match:
                print(f"       First at line {first_match.get('line', '?')}:{first_match.get('character', '?')}")
            if preview:
                print(f"       Preview: {truncate(preview.strip(), 60)}")
    else:
        print("✗ No search results")
    
    # Test 8: CALL HIERARCHY
    print_section("8. GET_CALL_HIERARCHY - Trace Function Calls")
    
    # First get exact position of getHover function
    doc_symbols_hover = call_mcp_tool("get_document_symbols", {
        "uri": get_test_uri('hover')
    })
    
    hover_line = 12  # Default fallback
    if doc_symbols_hover:
        for sym in doc_symbols_hover:
            if sym.get('name') == 'getHover':
                hover_line = sym.get('range', {}).get('start', {}).get('line', 12)
                break
    
    # Test incoming calls
    call_hierarchy_in = call_mcp_tool("get_call_hierarchy", {
        "uri": get_test_uri('hover'),
        "line": hover_line,
        "character": 17,  # On 'getHover'
        "direction": "incoming"
    })
    
    if call_hierarchy_in:
        if isinstance(call_hierarchy_in, dict):
            if 'error' in call_hierarchy_in:
                print(f"✗ Error: {call_hierarchy_in['error']}")
            else:
                target = call_hierarchy_in.get('target', {})
                calls = call_hierarchy_in.get('calls', [])
                
                print(f"✓ INCOMING calls to {target.get('name', 'unknown')} ({target.get('kind', 'Unknown')})")
                
                if calls:
                    print(f"   Found {len(calls)} caller(s):")
                    for i, call in enumerate(calls[:5], 1):
                        from_item = call.get('from', {})
                        from_name = from_item.get('name', 'unknown')
                        from_file = from_item.get('uri', '').split('/')[-1]
                        from_ranges = call.get('fromRanges', [])
                        
                        print(f"\n    {i}. {from_name} in {from_file}")
                        if from_ranges:
                            for r in from_ranges[:2]:
                                line = r['start']['line']
                                char = r['start']['character']
                                print(f"       Call at line {line + 1}:{char}")
                else:
                    print("   No incoming calls found")
        else:
            print("✗ Unexpected response format")
    else:
        print("✗ Call hierarchy failed")
    
    # Test outgoing calls from addLspTools
    print("\n  OUTGOING calls from addLspTools:")
    call_hierarchy_out = call_mcp_tool("get_call_hierarchy", {
        "uri": get_test_uri('tools'),
        "line": 19,  # addLspTools function
        "character": 17,
        "direction": "outgoing"
    })
    
    if call_hierarchy_out:
        if isinstance(call_hierarchy_out, dict) and 'target' in call_hierarchy_out:
            target = call_hierarchy_out.get('target', {})
            calls = call_hierarchy_out.get('calls', [])
            
            print(f"  Target: {target.get('name', 'unknown')} ({target.get('kind', 'Unknown')})")
            
            if calls:
                print(f"  Found {len(calls)} outgoing call(s)")
                # Group by kind
                call_kinds = {}
                for call in calls:
                    from_item = call.get('from', {})
                    kind = from_item.get('kind', 'Unknown')
                    if kind not in call_kinds:
                        call_kinds[kind] = 0
                    call_kinds[kind] += 1
                
                print(f"  Call types: {call_kinds}")
            else:
                print("  No outgoing calls detected")
        else:
            print("  ✗ Could not get outgoing calls")
    else:
        print("  ✗ Outgoing call hierarchy failed")
    
    # Test 9: RENAME
    print_section("9. RENAME_SYMBOL - Refactor Across Files")
    rename = call_mcp_tool("rename_symbol", {
        "uri": get_test_uri('hover'),
        "line": 14,  # function parameter 'uri'
        "character": 3,
        "newName": "documentUri"
    })
    
    if rename:
        if isinstance(rename, dict) and 'changes' in rename:
            changes = rename['changes']
            print(f"✓ Rename would affect {len(changes)} file(s)")
            for change in changes:
                filename = change['uri'].split('/')[-1]
                edits = change.get('edits', [])
                print(f"\n    • {filename}: {len(edits)} edit(s)")
                for j, edit in enumerate(edits[:3], 1):  # Show first 3 edits
                    r = edit['range']
                    print(f"      Edit {j}: Line {r['start']['line']}:{r['start']['character']} → '{edit['newText']}'")
                if len(edits) > 3:
                    print(f"      ... and {len(edits) - 3} more edits")
        else:
            print("✓ Rename returned result (different format)")
    else:
        print("✗ Rename failed")
    
    # Test 10: BUFFER SYSTEM
    print_section("10. BUFFER SYSTEM - Large Response Handling")
    
    # First, trigger a large response that should be buffered
    print("\n  Testing buffered response with large document symbols...")
    large_doc_symbols = call_mcp_tool("get_document_symbols", {
        "uri": get_test_uri('buffer_manager')
    })
    
    if large_doc_symbols:
        # Check if it's a buffered response
        if isinstance(large_doc_symbols, dict) and large_doc_symbols.get('type') == 'buffered_response':
            print("✓ Response was buffered!")
            metadata = large_doc_symbols.get('metadata', {})
            print(f"    • Total tokens: {metadata.get('totalTokens', 'unknown')}")
            print(f"    • Total bytes: {metadata.get('totalBytes', 'unknown')}")
            print(f"    • Item count: {metadata.get('itemCount', 'unknown')}")
            print(f"    • Truncated at depth: {metadata.get('truncatedAtDepth', 'N/A')}")
            
            bufferId = large_doc_symbols.get('bufferId')
            if bufferId:
                print(f"\n    Buffer ID: {bufferId}")
                
                # Test retrieve_buffer
                print("\n  Testing retrieve_buffer tool...")
                full_data = call_mcp_tool("retrieve_buffer", {
                    "bufferId": bufferId
                })
                
                if full_data:
                    print(f"✓ Successfully retrieved full data!")
                    print(f"    • Retrieved {len(full_data)} symbols")
                    # Show first few symbols
                    for i, sym in enumerate(full_data[:3], 1):
                        print(f"      {i}. {sym.get('name', 'unknown')} ({sym.get('kind', 'unknown')})")
                else:
                    print("✗ Failed to retrieve buffer")
            
            # Show preview
            preview = large_doc_symbols.get('preview', {})
            if isinstance(preview, dict):
                # Handle dictionary preview format
                items = preview.get('items', [])
                total = preview.get('totalItems', len(items))
                if items:
                    print(f"\n  Smart preview (first {min(3, len(items))} of {total} items):")
                    for i, item in enumerate(items[:3], 1):
                        if isinstance(item, dict):
                            print(f"    {i}. {item.get('name', 'unknown')} ({item.get('kind', 'unknown')})")
            elif isinstance(preview, list) and preview:
                # Handle list preview format
                print(f"\n  Smart preview (first {min(3, len(preview))} items):")
                for i, item in enumerate(preview[:3], 1):
                    if isinstance(item, dict):
                        print(f"    {i}. {item.get('name', 'unknown')} ({item.get('kind', 'unknown')})")
        else:
            print("✓ Response was not buffered (small enough)")
            print(f"    • Found {len(large_doc_symbols)} symbols")
    else:
        print("✗ No document symbols returned")
    
    # Test 11: BUFFER STATS
    print_section("11. GET_BUFFER_STATS - Buffer Statistics")
    stats = call_mcp_tool("get_buffer_stats", {})
    
    if stats:
        print("✓ Buffer statistics:")
        print(f"    • Active buffers: {stats.get('activeBuffers', 0)}")
        print(f"    • Total size: {stats.get('totalSize', 0)} bytes")
        oldest = stats.get('oldestBuffer')
        if oldest:
            print(f"    • Oldest buffer age: {oldest}ms")
    else:
        print("✗ No buffer statistics available")
    
    # Summary
    print_section("TEST SUMMARY")
    print("""
    All 11 tools tested with detailed output:
    • Hover: Shows documentation and type information
    • Completions: Lists available code suggestions
    • Definition: Locates symbol definitions
    • References: Finds all usages across codebase
    • Implementations: Finds interface/class implementations
    • Document Symbols: Shows file structure and symbol hierarchy
    • Text Search: Searches for text patterns in files
    • Call Hierarchy: Traces incoming/outgoing function calls
    • Rename: Shows refactoring changes across files
    • Buffer System: Handles large responses intelligently
    • Buffer Stats: Monitors buffer usage
    """)

if __name__ == "__main__":
    test_all_tools_detailed()