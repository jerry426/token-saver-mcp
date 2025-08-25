# AI CLI Orchestrator Terminal - Functional Specification

## Executive Summary
Create a system that enables programmatic orchestration of multiple AI CLI tools (Claude, ChatGPT, Gemini, etc.) with full visibility into their terminal sessions, allowing for automated prompt injection, response capture, and multi-agent coordination.

## Core Objectives

### 1. Terminal Session Management
- Spawn and manage multiple pseudo-terminal (PTY) sessions for AI CLI tools
- Each session must maintain isolation while allowing central orchestration
- Support for both AI CLIs and regular shell commands for testing
- Graceful handling of process lifecycle (spawn, terminate, restart)

### 2. Real-time Visibility
- Stream all terminal output in real-time to connected clients
- Preserve ANSI color codes for readability while filtering dangerous sequences
- Provide both raw and sanitized output streams
- Maintain scrollback buffer per agent for historical analysis

### 3. State Detection & Management
- Detect AI CLI states: `initializing`, `ready`, `thinking`, `responding`, `error`
- Pattern-based recognition of different AI CLI prompts:
  - Claude: `>`, `Human:`, `Assistant:`
  - ChatGPT: `You:`, `ChatGPT:`, `User:`
  - Gemini: `>`, `User:`, `Model:`
  - Shell: `$`, `#`, `>` prompts
- Automatic state transitions based on output patterns
- Event emission for state changes

### 4. Programmatic Interaction
- **Prompt Injection**: Queue-based system for sending prompts to AI CLIs
  - Wait for "ready" state before injection
  - Support for immediate and wait-for-response modes
  - Automatic newline handling
- **Response Capture**: 
  - Detect response boundaries
  - Extract and store complete responses
  - Token estimation for usage tracking

### 5. Multi-Agent Orchestration
- **Agent Selection**: Smart routing based on:
  - Agent availability and state
  - Success rate history
  - Average response time
  - Specialization tags
- **Workflow Execution**:
  - Sequential and parallel step execution
  - Context passing between agents
  - Result aggregation
  - Error handling with fallback agents

### 6. Safety & Reliability
- **Terminal Control Sequence Filtering**:
  - Remove cursor positioning commands
  - Filter alternate screen buffer switches
  - Escape dangerous control characters
  - Prevent terminal hijacking
- **Error Recovery**:
  - Automatic restart on crash
  - Exponential backoff for retries
  - Dead agent detection and cleanup
- **Resource Management**:
  - Output buffer size limits
  - Rate limiting for high-volume output
  - Memory cleanup on agent termination

## Technical Requirements

### Architecture Components

1. **PTY Manager**
   - Wraps node-pty for process spawning
   - Handles I/O streams
   - Environment variable management
   - Terminal size configuration

2. **State Detector**
   - Pattern matching engine for CLI outputs
   - State machine for transitions
   - Extensible pattern registration

3. **Input Injector**
   - FIFO queue with retry logic
   - Backoff mechanism for failures
   - Priority queue support

4. **Stream Handler**
   - Output coalescing for performance
   - ANSI code preservation/stripping
   - Line buffering

5. **Orchestrator Core**
   - Agent lifecycle management
   - Event bus for component communication
   - Memory system for context persistence
   - Workflow engine

6. **WebSocket Server**
   - Real-time bidirectional communication
   - Multiple client support
   - Automatic reconnection handling

7. **Web UI Dashboard**
   - Individual terminal views per agent
   - State indicators
   - Manual command injection
   - Response highlighting
   - Performance metrics display

## API Endpoints

### REST API
```typescript
POST /api/agents/spawn
  body: { name, type, command?, args? }
  response: { agentId, state }

POST /api/agents/:id/inject
  body: { prompt, waitForResponse? }
  response: { success, response? }

GET /api/agents/:id/status
  response: { state, metrics, lastActivity }

DELETE /api/agents/:id
  response: { success }

POST /api/workflows/execute
  body: { steps[], context }
  response: { results[], success }
```

### WebSocket Events
```typescript
// Client -> Server
spawn-agent: { name, type, command? }
inject-prompt: { agentId, prompt }
terminate-agent: { agentId }

// Server -> Client
agent-spawned: { agent }
agent-output: { agentId, data, timestamp }
state-change: { agentId, newState, oldState }
agent-error: { agentId, error }
response-complete: { agentId, response }
```

## Performance Requirements
- Support 10+ concurrent AI CLI sessions
- Sub-100ms latency for prompt injection
- Handle 10KB/s output per agent
- WebSocket broadcast to 50+ clients
- 99% uptime with automatic recovery

## Security Considerations
- Sanitize all terminal output before broadcasting
- Validate commands before execution
- Rate limit API endpoints
- Escape control sequences that could affect client terminals
- No storage of sensitive prompts/responses without encryption

## Success Metrics
- Successfully orchestrate conversations between 3+ AI agents
- Capture 100% of AI responses accurately
- Achieve <1% prompt injection failure rate
- Maintain state accuracy >99% of the time
- Zero terminal hijacking incidents

## Bonus Features (Optional)
- Conversation branching and merging
- A/B testing with multiple agents
- Response quality scoring
- Automatic prompt optimization
- Load balancing across multiple instances
- Plugin system for custom AI CLIs

## Example Use Case
```
1. User requests: "Compare approaches to implementing auth"
2. System spawns Claude and ChatGPT agents
3. Injects same prompt to both
4. Captures both responses
5. Spawns third agent to synthesize
6. Returns unified analysis to user
```

## Implementation Notes

### Directory Structure
```
src/terminal-wrapper/
├── orchestrator.ts       # Main orchestrator class
├── pty-manager.ts        # PTY wrapper
├── state-detector.ts     # State detection engine
├── input-injector.ts     # Input queue management
├── stream-handler.ts     # Output stream processing
├── safe-terminal.ts      # Security filters
└── mcp-integration.ts    # MCP tool integration

ai-cli-orchestrator.ts    # Standalone server implementation
launch-*.ts              # Various launcher configurations
```

### Key Design Decisions
1. **Event-Driven Architecture**: Use EventEmitter for loose coupling between components
2. **State Machine**: Explicit state transitions with validation
3. **Queue-Based Input**: Prevent race conditions in prompt injection
4. **Memory System**: Persistent context across agent restarts
5. **WebSocket for Real-time**: Binary frames for efficiency, JSON for structure

### Testing Strategy
1. **Unit Tests**: Each component in isolation
2. **Integration Tests**: Component interactions
3. **E2E Tests**: Full workflow execution
4. **Stress Tests**: Multiple agents, high throughput
5. **Security Tests**: Injection attempts, terminal escapes

### Deployment Considerations
1. **Docker Container**: Isolated environment per orchestrator
2. **Process Monitoring**: PM2 or systemd for restart
3. **Logging**: Structured logs with correlation IDs
4. **Metrics**: Prometheus/Grafana for monitoring
5. **Scaling**: Horizontal scaling with session affinity

---

This specification provides a complete blueprint for implementing a production-ready AI CLI orchestrator. The key is balancing comprehensive functionality with clean architecture and reliable execution.