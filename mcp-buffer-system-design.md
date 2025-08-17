# MCP Buffer System Design

## Overview
Implement a smart buffering system in the MCP server to prevent token overflow and optimize API usage by pre-analyzing response sizes and allowing Claude to make informed decisions about data retrieval.

## Architecture

### 1. Response Buffer Manager
```typescript
interface BufferedResponse {
  metadata: {
    totalTokens: number;
    totalBytes: number;
    itemCount: number;
    maxDepth: number;
    truncatedAtDepth?: number;
    wouldExceedLimit: boolean;
  };
  preview?: any;  // Small sample of actual data
  bufferId?: string;  // ID to retrieve full results if needed
}
```

### 2. Depth Truncation System
```typescript
interface DepthConfig {
  maxDepth: number;  // Default: 3
  truncationIndicator: string;  // e.g., "[truncated]"
  preserveArrayLength: boolean;  // Show array size even if truncated
}

// Per-tool depth configurations
const toolDepthLimits = {
  'search_text': 2,  // Shallow for search results
  'get_document_symbols': 4,  // Deeper for code structure
  'get_references': 3,  // Medium depth
  'get_diagnostics': 3,
  // etc.
};
```

### 3. Token Estimation
```typescript
function estimateTokens(data: any): number {
  // Rough estimation: ~4 characters per token
  const jsonString = JSON.stringify(data);
  return Math.ceil(jsonString.length / 4);
}
```

### 4. Response Flow

#### Phase 1: Buffer & Analyze
1. MCP server receives request from Claude
2. Execute the actual LSP operation
3. Buffer the complete response in memory
4. Analyze response size, depth, and structure
5. Apply depth truncation if needed

#### Phase 2: Return Metadata
```typescript
// Example response for large result set
{
  "type": "buffered_response",
  "metadata": {
    "totalTokens": 61011,
    "totalMatches": 245,
    "fileCount": 47,
    "maxDepth": 8,
    "wouldExceedLimit": true,
    "suggestedRefinements": [
      "Add file type filter: *.ts",
      "Exclude node_modules",
      "Limit to 10 results"
    ]
  },
  "preview": {
    "firstMatches": [/* 3 truncated results */],
    "topFiles": ["src/server/trpc.ts", "src/components/navbar.tsx"]
  },
  "bufferId": "search_1234567890"
}
```

#### Phase 3: Claude Decision
Claude can then:
1. Accept the truncated preview
2. Request the full buffered data (if under threshold)
3. Refine the search with new parameters
4. Cancel and try different approach

### 5. Implementation Examples

#### Depth Truncation Function
```typescript
function truncateDepth(obj: any, maxDepth: number, currentDepth = 0): any {
  if (currentDepth >= maxDepth) {
    if (Array.isArray(obj)) {
      return `[Array: ${obj.length} items, truncated]`;
    }
    if (typeof obj === 'object' && obj !== null) {
      return `[Object: ${Object.keys(obj).length} properties, truncated]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => truncateDepth(item, maxDepth, currentDepth + 1));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateDepth(value, maxDepth, currentDepth + 1);
    }
    return result;
  }

  return obj;
}
```

#### Smart Search Example
```typescript
// Original search returns too much
const results = await searchText("trpc");
const tokens = estimateTokens(results);

if (tokens > TOKEN_LIMIT) {
  // Return metadata instead
  return {
    type: "buffered_response",
    metadata: {
      totalTokens: tokens,
      totalMatches: results.length,
      exceedsLimit: true
    },
    preview: truncateDepth(results.slice(0, 3), 2),
    suggestions: generateRefinementSuggestions(results)
  };
}
```

### 6. Configuration Options

```typescript
interface MCPBufferConfig {
  maxTokensPerResponse: number;  // Default: 25000
  defaultMaxDepth: number;  // Default: 3
  enableBuffering: boolean;  // Default: true
  bufferTTL: number;  // Buffer expiry in ms, default: 60000
  autoTruncate: boolean;  // Auto-truncate without asking
  
  // Per-tool overrides
  toolConfigs: {
    [toolName: string]: {
      maxTokens?: number;
      maxDepth?: number;
      alwaysBuffer?: boolean;
    }
  }
}
```

### 7. Benefits

1. **Token Efficiency**: Prevents token overflow, reduces API costs
2. **Faster Iterations**: Claude can refine searches without receiving huge payloads
3. **Better UX**: No more abrupt failures from token limits
4. **Smart Previews**: See representative samples before committing to full data
5. **Depth Control**: Eliminate unnecessary nested data automatically

### 8. Example Scenarios

#### Scenario 1: Large Search Result
```
Claude: search_text("useState")
MCP: [Buffers 85,000 tokens of results]
MCP Returns: "Found 312 matches across 89 files (85K tokens). 
              Preview shows first 3 matches. Refine search?"
Claude: "Let me search only in src/components"
Claude: search_text("useState", {includes: ["src/components/**"]})
MCP: [Returns 8,000 tokens - acceptable]
```

#### Scenario 2: Deep JSON Structure
```
Claude: get_document_symbols("complex-file.ts")
MCP: [Detects 12-level deep nesting]
MCP: [Auto-truncates to 3 levels]
MCP Returns: Symbols with "[+9 levels truncated]" indicators
Claude: Can work with the truncated version effectively
```

### 9. Implementation Priority

1. **Phase 1**: Basic buffering and size detection
2. **Phase 2**: Depth truncation system  
3. **Phase 3**: Smart preview generation
4. **Phase 4**: Refinement suggestions
5. **Phase 5**: Buffer management and retrieval

### 10. Success Metrics

- 90% reduction in token overflow errors
- 60% reduction in average tokens per search operation
- Ability to handle searches returning 100K+ tokens
- No loss of functionality for Claude's tasks