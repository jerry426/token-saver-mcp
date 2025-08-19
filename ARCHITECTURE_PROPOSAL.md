# Token Saver MCP - New Architecture Proposal

## Overview

Restructure the tool definitions from a monolithic `tools.ts` file into a modular architecture where each tool has its own file with embedded documentation.

## Current Architecture (Monolithic)

```
src/mcp/
├── tools.ts           (1000+ lines, all tools)
├── browser-tools.ts   (CDP tools)
└── browser-helpers.ts (Helper tools)

AI-instructions/
└── INSTRUCTIONS.md    (Manually maintained)
```

**Problems:**
- Single massive file is hard to maintain
- Documentation separated from implementation
- Easy for docs to drift from reality
- Difficult to find specific tool implementations

## Proposed Architecture (Modular)

```
src/mcp/tools/
├── index.ts          (Registry and loader)
├── lsp/
│   ├── get-definition.ts
│   ├── get-references.ts
│   ├── search-text.ts
│   └── ... (13 more LSP tools)
├── cdp/
│   ├── navigate-browser.ts
│   ├── click-element.ts
│   ├── execute-in-browser.ts
│   └── ... (10 more CDP tools)
├── helper/
│   ├── test-react-component.ts
│   ├── test-api-endpoint.ts
│   └── ... (3 more helpers)
└── system/
    ├── get-instructions.ts
    ├── retrieve-buffer.ts
    └── ... (2 more system tools)
```

## Benefits

### 1. Maintainability
- Each tool in its own file (~100 lines vs 1000+ line file)
- Documentation lives with implementation
- Easy to find and modify specific tools
- Clear separation of concerns

### 2. Documentation Always Accurate
- Docs embedded in tool definition
- Single source of truth
- Auto-generated INSTRUCTIONS.md from code
- Rich metadata for each tool

### 3. Developer Experience
- Easy to add new tools (copy template, modify)
- IDE navigation works better
- Easier to test individual tools
- Better code organization

### 4. Extensibility
- Plugin architecture possible
- Third-party tools can follow same pattern
- Easy to disable/enable specific tools
- Category-based organization

## Tool File Template

Each tool file follows this structure:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { z } from 'zod'

export const metadata = {
  name: 'tool_name',
  title: 'Human Readable Name',
  category: 'lsp' as const,
  description: 'Full description...',
  
  docs: {
    brief: 'One-line summary',
    
    parameters: {
      param1: 'Description of param1',
      param2: 'Description of param2'
    },
    
    examples: [
      {
        title: 'Basic usage',
        code: `tool_name({ param1: "value" })`
      }
    ],
    
    workflow: {
      usedWith: ['other_tool1', 'other_tool2'],
      followedBy: ['next_tool1', 'next_tool2'],
      description: 'How this fits in workflows'
    },
    
    tips: [
      'Tip 1',
      'Tip 2'
    ],
    
    performance: {
      speed: '< 50ms',
      tokenSavings: '95-99%'
    }
  }
}

export const schema = z.object({
  param1: z.string().describe(metadata.docs.parameters.param1),
  param2: z.number().describe(metadata.docs.parameters.param2)
})

export function register(server: Server) {
  server.registerTool(
    metadata.name,
    {
      title: metadata.title,
      description: metadata.description,
      inputSchema: schema,
    },
    async (params) => {
      // Implementation
      return { content: [{ type: 'text', text: 'Result' }] }
    }
  )
}
```

## Documentation Generation

The `generate-instructions.ts` script:
1. Scans all tool files
2. Extracts metadata from each
3. Generates comprehensive INSTRUCTIONS.md
4. Includes all examples, tips, workflows
5. Creates decision trees from relationships
6. Outputs formatted markdown

## Migration Plan

### Phase 1: Proof of Concept ✅
- Create tools directory structure
- Implement 3 example tools (1 per category)
- Update generate-instructions script
- Test documentation generation

### Phase 2: Full Migration
1. Convert all 30+ tools to new format
2. Update MCP server to use new registry
3. Test all tools still work
4. Generate new INSTRUCTIONS.md
5. Remove old monolithic files

### Phase 3: Enhancement
- Add tool testing framework
- Add tool validation
- Add plugin support
- Add tool versioning

## Implementation Status

✅ **Completed:**
- Created modular directory structure
- Implemented example tools with rich metadata
- Created tool registry system
- Updated documentation generator
- Successfully generated docs from new structure

🚧 **Next Steps:**
- Migrate remaining tools
- Update MCP server integration
- Add backwards compatibility
- Full testing suite

## Example Output

The new system generates documentation like:

```markdown
#### `get_definition`
**Jump to where something is defined**

Get the definition location of a symbol.

**Parameters:**
- `uri`: The file URI in encoded format
- `line`: The line number (0-based)
- `character`: The character position

**Examples:**
[Full examples with code]

**Often used with:** `search_text`, `get_references`
**Workflow:** Typically used after search_text

**Tips:**
- Always use absolute file:// URIs
- Use search_text first to find symbols

**Performance:**
- speed: < 50ms
- tokenSavings: 95-99%
```

## Conclusion

This new architecture provides:
- **Better maintainability** - Each tool in its own file
- **Accurate documentation** - Generated from code
- **Better developer experience** - Easy to find and modify
- **Future extensibility** - Plugin architecture possible

The proof of concept demonstrates this works well and can generate even richer documentation than the current manual approach.