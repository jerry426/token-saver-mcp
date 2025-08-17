# Buffer Handling Guide for AI Assistants

This guide explains how to handle buffered responses from the Token Saver MCP extension.

## Understanding Buffered Responses

When a response would exceed 2,500 tokens (~10KB), it's automatically buffered to prevent token overflow. This ensures AI assistants can continue working without context exhaustion.

## Recognizing a Buffered Response

A buffered response has this structure:

```json
{
  "type": "buffered_response",
  "metadata": {
    "totalTokens": 8744,
    "totalBytes": 34975,
    "itemCount": 21,
    "maxDepth": 10,
    "wouldExceedLimit": true,
    "truncatedAtDepth": 4
  },
  "preview": [...],  // Smart summary of the data
  "bufferId": "get_document_symbols_1754955026362_z2ksv6t8z",
  "suggestions": [...],  // Helpful refinement suggestions
  "_instructions": "This response was buffered to prevent token overflow..."
}
```

## How Claude Code Should Handle Buffered Responses

### 1. Check Response Type

```python
if response.get('type') == 'buffered_response':
    # This is a buffered response
    handle_buffered_response(response)
else:
    # Normal response
    handle_normal_response(response)
```

### 2. Use the Preview

The `preview` field contains an intelligent summary:

- **search_text**: Shows first, middle, and last results for distribution
- **get_document_symbols**: Prioritizes top-level symbols
- **get_references**: Groups by file with counts
- **get_completions**: Categorizes by completion type

Example:
```python
preview = response.get('preview', [])
print(f"Preview shows {len(preview)} items")
for item in preview[:5]:
    print(f"- {item.get('name', item)}")
```

### 3. Retrieve Full Data When Needed

If you need the complete data:

```python
# Get the buffer ID
buffer_id = response.get('bufferId')

# Retrieve full data
full_data = call_mcp_tool('retrieve_buffer', {
    'bufferId': buffer_id
})

# Now you have all the data
print(f"Retrieved {len(full_data)} complete items")
```

### 4. Follow Suggestions

The `suggestions` field provides helpful hints:

```python
suggestions = response.get('suggestions', [])
for suggestion in suggestions:
    print(f"Tip: {suggestion}")
```

## Example Scenarios

### Scenario 1: Large Document Symbols

**User**: "Show me all symbols in buffer-manager.ts"

**Claude Code response**:
```
I found the document symbols for buffer-manager.ts. The response was large 
(8,744 tokens), so it was automatically buffered to prevent overwhelming 
the context.

Here's a preview of the main symbols:
1. BufferedResponse (Interface) - 4 children
2. BufferConfig (Interface) - 5 children  
3. DEFAULT_CONFIG (Variable) - 5 children

The file contains 21 total symbols with deep nesting (up to depth 10).
Would you like me to:
- Show more specific symbols?
- Retrieve the complete symbol tree?
- Search for a particular symbol by name?
```

### Scenario 2: Many Search Results

**User**: "Find all uses of 'function' in the codebase"

**Claude Code response**:
```
I found many matches for 'function' across the codebase. The results were
buffered due to size. Here's a summary:

Files with matches:
- test_mcp_tools.py: 2 matches
- test_call_hierarchy.py: 10 matches
- buffer-manager.ts: 10 matches
- (and more...)

Total: 24 files containing 'function'

Would you like me to:
- Show matches from specific files?
- Narrow the search with a more specific pattern?
- Filter by file type (e.g., only TypeScript files)?
```

## Best Practices for AI Assistants

### DO:
1. **Always check for `type: 'buffered_response'`** before processing
2. **Use the preview** to give users immediate useful information
3. **Mention that data was buffered** so users understand what happened
4. **Offer to retrieve full data** when it would be helpful
5. **Use suggestions** to guide users toward better queries

### DON'T:
1. **Don't ignore buffered responses** - They contain valuable previews
2. **Don't always retrieve full data** - Often the preview is sufficient
3. **Don't overwhelm users** - Summarize the preview, don't dump it all
4. **Don't forget the buffer ID** - You need it to retrieve full data

## Technical Details

### Token Limits
- Maximum: 2,500 tokens per response (~10KB JSON)
- Estimation: ~4 characters per token
- Safety margin: Responses are buffered before reaching the limit

### Depth Truncation
Different tools have different depth limits:
- `search_text`: 5 levels
- `get_document_symbols`: 4 levels  
- `get_references`: 5 levels
- `get_completions`: 3 levels

### Buffer Lifetime
- Buffers expire after 60 seconds
- Accessing a buffer refreshes its timestamp
- Old buffers are automatically cleaned up

## Example Claude Code Implementation

When Claude Code receives a response from an MCP tool:

```typescript
function handleMcpResponse(response: any) {
  // Check if it's buffered
  if (response?.type === 'buffered_response') {
    const { metadata, preview, bufferId, suggestions } = response
    
    // Inform the user
    console.log(`Response was large (${metadata.totalTokens} tokens), showing preview`)
    
    // Show preview
    if (Array.isArray(preview)) {
      console.log(`Preview of ${preview.length} items:`)
      preview.slice(0, 5).forEach(item => {
        console.log(`- ${item.name || item}`)
      })
    }
    
    // Offer to get full data
    console.log(`\nFull data available with buffer ID: ${bufferId}`)
    console.log('Use retrieve_buffer tool to get complete results')
    
    // Show suggestions
    if (suggestions?.length > 0) {
      console.log('\nSuggestions for better results:')
      suggestions.forEach(s => console.log(`- ${s}`))
    }
  } else {
    // Handle normal response
    processNormalResponse(response)
  }
}
```

## Summary

The buffer system ensures Claude Code can handle large responses gracefully:

1. **Automatic detection** - Responses over 2,500 tokens are buffered
2. **Smart previews** - Tool-specific intelligent summaries
3. **Full access** - Complete data available via `retrieve_buffer`
4. **Clear instructions** - The `_instructions` field explains what happened
5. **Helpful suggestions** - Guide users to better queries

This system prevents token overflow while maintaining full functionality, allowing Claude Code to work with large codebases effectively.