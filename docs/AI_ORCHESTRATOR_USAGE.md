# AI Terminal Orchestrator - Usage Guide

## Overview

The AI Terminal Orchestrator is a production-ready system for managing multiple AI CLI tools (Claude, ChatGPT, Gemini, etc.) with full terminal visibility and programmatic control.

## Port Management

The orchestrator uses a smart port allocation system with these defaults:
- **HTTP API**: Port 9800 (primary) with automatic fallback
- **WebSocket**: Port 9801 (primary) with automatic fallback
- **Port File**: `~/.ai-orchestrator-port` tracks the running instance

### How It Works

1. **Single Instance**: Only one orchestrator runs at a time by default
2. **Port Persistence**: Allocated ports are saved to `~/.ai-orchestrator-port`
3. **Process Detection**: Checks if existing process is still running
4. **Automatic Fallback**: If default ports are busy, finds next available (up to 10 attempts)
5. **Clean Shutdown**: Releases ports and cleans up on termination

## Starting the Orchestrator

### Method 1: NPM Scripts (Recommended)
```bash
# Start the orchestrator
npm run orchestrator

# Check status
npm run orchestrator:status

# Stop the orchestrator
npm run orchestrator:stop

# Start development test server
npm run orchestrator:dev
```

### Method 2: Direct Script
```bash
# Start
npx tsx ai-orchestrator-server.ts

# Status
npx tsx ai-orchestrator-server.ts --status

# Stop
npx tsx ai-orchestrator-server.ts --stop
```

### Method 3: Shell Script
```bash
# Make executable (first time only)
chmod +x start-orchestrator.sh

# Start
./start-orchestrator.sh

# Stop
./start-orchestrator.sh stop
```

## Web Interface

Once started, access the orchestrator at:
- **Production**: http://127.0.0.1:9800 (or check status for actual port)
- **WebSocket**: ws://127.0.0.1:9801 (for programmatic access)

### UI Features

1. **Multi-Tab Interface**
   - Each agent gets its own tab
   - Switch between agents easily
   - Close tabs to terminate agents

2. **Agent Management**
   - Spawn new agents (Shell, Claude CLI, ChatGPT CLI, Gemini CLI)
   - View agent status (ready, processing, error)
   - Terminate agents individually

3. **Terminal Interaction**
   - Manual typing in each terminal
   - Real-time output streaming
   - Clear terminal output
   - Command history (per session)

## API Endpoints

### Health Check
```http
GET http://127.0.0.1:9800/health
```

### Spawn Agent
```http
POST http://127.0.0.1:9800/api/agents/spawn
Content-Type: application/json

{
  "name": "my-agent",
  "type": "claude",
  "command": "claude",
  "args": [],
  "env": {},
  "tags": ["gpt", "coding"]
}
```

### List Agents
```http
GET http://127.0.0.1:9800/api/agents
```

### Get Agent Info
```http
GET http://127.0.0.1:9800/api/agents/{id}
```

### Inject Command
```http
POST http://127.0.0.1:9800/api/agents/{id}/inject
Content-Type: application/json

{
  "prompt": "Hello, how are you?",
  "waitForResponse": true
}
```

### Terminate Agent
```http
DELETE http://127.0.0.1:9800/api/agents/{id}
```

### Execute Workflow
```http
POST http://127.0.0.1:9800/api/workflows
Content-Type: application/json

{
  "id": "workflow-1",
  "name": "Multi-Agent Task",
  "steps": [
    {
      "id": "step1",
      "name": "Ask Claude",
      "agent": "claude-agent-id",
      "prompt": "What is the weather?"
    }
  ]
}
```

## WebSocket Events

Connect to `ws://127.0.0.1:9801` to receive real-time events:

### Incoming Events
- `agent-spawned`: New agent created
- `agent-output`: Terminal output from agent
- `state-change`: Agent state changed
- `agent-error`: Error occurred
- `agent-terminated`: Agent terminated
- `initial-state`: Initial agent list (on connection)

### Event Format
```json
{
  "type": "agent-output",
  "agentId": "custom-1234567890",
  "data": "$ echo hello\nhello\n",
  "timestamp": 1234567890
}
```

## Programmatic Usage

### JavaScript/TypeScript
```javascript
// Connect to orchestrator
const ws = new WebSocket('ws://127.0.0.1:9801');

// Listen for events
ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event.type, event);
});

// Spawn agent via API
const response = await fetch('http://127.0.0.1:9800/api/agents/spawn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'claude-1',
    type: 'claude',
    command: 'claude'
  })
});

const { agent } = await response.json();
console.log('Spawned agent:', agent.id);
```

### Python
```python
import requests
import websocket
import json

# Spawn agent
response = requests.post('http://127.0.0.1:9800/api/agents/spawn', 
  json={
    'name': 'python-agent',
    'type': 'custom',
    'command': 'python3'
  })
  
agent = response.json()['agent']

# Connect WebSocket
ws = websocket.WebSocket()
ws.connect('ws://127.0.0.1:9801')

# Listen for output
while True:
    msg = ws.recv()
    event = json.loads(msg)
    if event['type'] == 'agent-output' and event['agentId'] == agent['id']:
        print(event['data'], end='')
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Web Browser UI                   │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  Tab 1   │ │  Tab 2   │ │  Tab 3   │        │
│  │ Claude   │ │ ChatGPT  │ │  Shell   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
└────────────────┬───────────────────────────────┘
                 │
                 │ WebSocket (9801)
                 ▼
┌─────────────────────────────────────────────────┐
│           AI Terminal Orchestrator               │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │          Port Manager                    │   │
│  │  • Allocates ports (9800/9801)          │   │
│  │  • Tracks in ~/.ai-orchestrator-port    │   │
│  │  • Ensures single instance              │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │          Event System                    │   │
│  │  • agent-spawned                        │   │
│  │  • agent-output                         │   │
│  │  • state-change                         │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │   PTY     │ │   PTY     │ │   PTY     │      │
│  │  Manager  │ │  Manager  │ │  Manager  │      │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘        │
│        │            │            │               │
└────────┼────────────┼────────────┼──────────────┘
         │            │            │
         ▼            ▼            ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ Claude  │ │ ChatGPT │ │  Shell  │
    │   CLI   │ │   CLI   │ │         │
    └─────────┘ └─────────┘ └─────────┘
```

## State Management

Each agent tracks its state:
- `initializing`: Starting up
- `ready`: Waiting for input
- `processing`: Executing command
- `responding`: Generating response
- `error`: Error occurred
- `terminated`: Agent shut down

States are detected using pattern matching on terminal output.

## Best Practices

1. **Port Conflicts**: If you see port conflicts, check running processes:
   ```bash
   npm run orchestrator:status
   lsof -i :9800  # Check what's using the port
   ```

2. **Clean Shutdown**: Always use proper shutdown:
   ```bash
   npm run orchestrator:stop
   # or Ctrl+C in the terminal
   ```

3. **Logs**: Check logs for debugging:
   ```bash
   tail -f logs/ai-orchestrator.log
   # or for development
   tail -f orchestrator.log
   ```

4. **Multiple Projects**: The orchestrator uses the hidden file pattern to ensure only one instance runs. If you need multiple instances for different projects, you can:
   - Stop the current instance: `npm run orchestrator:stop`
   - Start in your new project directory
   - The port file tracks which project is using the orchestrator

## Troubleshooting

### Port Already in Use
```bash
# Check what's running
npm run orchestrator:status

# Force stop if needed
npm run orchestrator:stop

# Remove stale port file if process crashed
rm ~/.ai-orchestrator-port
```

### WebSocket Connection Failed
- Check firewall settings
- Ensure ports 9800-9801 are not blocked
- Verify orchestrator is running: `npm run orchestrator:status`

### Agent Not Responding
- Check agent state in UI
- Verify the CLI tool is installed
- Check terminal output for errors
- Try restarting the specific agent

## Security Notes

- The orchestrator binds to `127.0.0.1` (localhost only)
- Not accessible from external networks by default
- Each agent runs in isolated PTY session
- Input sanitization prevents control sequence injection

## Future Enhancements

- [ ] Agent templates and presets
- [ ] Response caching and history
- [ ] Token usage tracking
- [ ] Multi-model conversations
- [ ] Workflow templates
- [ ] Performance metrics dashboard
- [ ] Agent health monitoring
- [ ] Auto-restart on failure
- [ ] Rate limiting and quotas