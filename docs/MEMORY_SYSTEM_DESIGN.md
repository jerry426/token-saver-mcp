# Memory System Design for Token Saver MCP

## Overview

The memory system provides persistent context storage for AI assistants, enabling efficient session resumption and multi-AI collaboration without token waste.

## Architecture

### Storage Backend
- **SQLite** for local persistence (MVP)
- **PostgreSQL** support for production (future)
- **In-memory cache** for fast access

### Memory Structure
```typescript
interface Memory {
  id: string;           // UUID
  key: string;          // Hierarchical key (e.g., "project.architecture")
  value: any;           // JSON-serializable value
  scope: MemoryScope;   // global | project | session | shared
  metadata: {
    created_at: Date;
    updated_at: Date;
    accessed_at: Date;
    created_by: string;  // AI identifier (claude, gemini, etc.)
    ttl?: number;        // Time-to-live in seconds
    tags?: string[];     // For categorization
    access_count: number;
  };
}

enum MemoryScope {
  GLOBAL = 'global',      // Across all projects
  PROJECT = 'project',    // Current project only
  SESSION = 'session',    // Current session only
  SHARED = 'shared'       // Multi-AI collaboration
}
```

## API Design

### Core Tools

#### 1. write_memory
```typescript
write_memory({
  key: string,          // "project.architecture"
  value: any,           // "Microservices with event bus"
  scope?: MemoryScope,  // Default: 'project'
  ttl?: number,         // Optional expiration in seconds
  tags?: string[]       // Optional tags for categorization
})
```

#### 2. read_memory
```typescript
read_memory({
  key: string,          // Exact key or pattern with wildcards
  scope?: MemoryScope   // Default: all scopes
}) => Memory | Memory[] | null
```

#### 3. list_memories
```typescript
list_memories({
  scope?: MemoryScope,
  pattern?: string,     // Key pattern (e.g., "project.*")
  tags?: string[],      // Filter by tags
  limit?: number        // Max results
}) => Memory[]
```

#### 4. delete_memory
```typescript
delete_memory({
  key: string,
  scope?: MemoryScope
}) => boolean
```

#### 5. smart_resume
```typescript
smart_resume({
  project_path?: string,
  session_id?: string
}) => {
  briefing: string,     // Human-readable summary
  context: {            // Structured data
    project: Memory[],
    current: Memory[],
    shared: Memory[]
  },
  token_count: number   // Estimated tokens used
}
```

## Key Patterns

### Namespace Conventions
```
project.architecture     - Overall system design
project.conventions      - Coding standards, patterns
project.dependencies     - Key libraries and versions
project.structure        - Directory organization

current.task            - What AI is working on now
current.progress        - Completion percentage
current.blockers        - Issues preventing progress

discovered.issues       - Bugs and problems found
discovered.patterns     - Identified code patterns
discovered.todos        - Future work items

shared.findings         - Multi-AI discoveries
shared.decisions        - Agreed approaches
shared.context          - Common understanding

ai.claude.preferences   - Claude-specific settings
ai.gemini.preferences   - Gemini-specific settings
```

### Query Patterns
```typescript
// Get all project context
read_memory({ pattern: "project.*" })

// Get current work items
read_memory({ pattern: "current.*" })

// Get shared collaboration context
read_memory({ scope: 'shared' })

// Get recent discoveries
read_memory({ pattern: "discovered.*", tags: ['recent'] })
```

## Implementation Plan

### Phase 1: Core Memory Operations (MVP)
1. SQLite database setup
2. Basic CRUD operations
3. Simple key-value storage
4. Project scope only

### Phase 2: Advanced Features
1. Pattern matching and wildcards
2. Multiple scopes (global, session, shared)
3. TTL and expiration
4. Tags and metadata

### Phase 3: Intelligence Layer
1. Smart resume with briefing generation
2. Memory compression and summarization
3. Automatic memory suggestions
4. Cross-session learning

### Phase 4: Collaboration Features
1. Multi-AI shared memory
2. Memory synchronization
3. Conflict resolution
4. Memory versioning

## Database Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,  -- JSON
  scope TEXT NOT NULL,
  project_path TEXT,
  session_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  ttl INTEGER,
  tags TEXT,  -- JSON array
  access_count INTEGER DEFAULT 0,
  
  INDEX idx_key (key),
  INDEX idx_scope (scope),
  INDEX idx_project (project_path),
  INDEX idx_session (session_id)
);
```

## Usage Examples

### Solo AI Session
```typescript
// End of session - save key insights
await write_memory({ 
  key: "project.type", 
  value: "Next.js with TypeScript" 
});

await write_memory({ 
  key: "current.refactoring", 
  value: {
    module: "authentication",
    progress: 70,
    next_steps: ["Add tests", "Update docs"]
  }
});

// Next session - restore context
const briefing = await smart_resume();
// Returns: "Working on Next.js project. 70% through auth refactoring. 
//          Next: Add tests and update docs."
```

### Multi-AI Collaboration
```typescript
// Claude saves findings
await write_memory({
  key: "shared.bug_found",
  value: "Memory leak in websocket handler",
  scope: 'shared'
});

// Gemini reads Claude's findings
const shared = await read_memory({ scope: 'shared' });

// Gemini adds its findings
await write_memory({
  key: "shared.test_coverage",
  value: "45% - needs improvement",
  scope: 'shared'
});
```

## Benefits Over /resume

| Aspect | /resume | Memory System |
|--------|---------|---------------|
| Token Usage | 5000+ | 200-500 |
| Relevance | Includes old/outdated | Only current context |
| Structure | Conversation dump | Organized by keys |
| Speed | Slow to process | Instant access |
| Multi-AI | Not supported | Native support |
| Learning | Starts fresh | Builds over time |

## Success Metrics

- 90% reduction in context restoration tokens
- <100ms memory access time
- Support for 1000+ memories per project
- Zero data loss across sessions
- Seamless multi-AI context sharing