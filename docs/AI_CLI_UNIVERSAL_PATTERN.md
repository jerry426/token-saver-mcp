# Universal AI CLI Interaction Pattern

## Discovery

Through extensive testing with various AI command-line interfaces (Claude, ChatGPT, Gemini), we discovered that **ALL terminal-based AI tools** work best with the same interaction pattern:

1. **Bulk text injection** - Send the entire message at once
2. **Manual submission** - User presses Enter when ready

This pattern perfectly mirrors natural human interaction with terminals and is compatible with:
- Voice dictation (Wispr Flow, etc.)
- Copy-paste workflows
- Programmatic text injection
- Manual typing

## The Pattern

### Step 1: Inject Text (Bulk)
```javascript
// Send complete message without auto-submitting
await orchestrator.injectToAgent(agentId, messageText, {
  manualSubmit: true  // Don't add Enter automatically
});
```

### Step 2: Submit When Ready
```javascript
// User presses Enter (or programmatically submit)
await orchestrator.injectToAgent(agentId, '\r', {
  raw: true  // Send raw carriage return
});
```

## Why This Works Universally

1. **Natural Flow**: Matches how humans type - compose, review, submit
2. **AI Agnostic**: Works with Claude, ChatGPT, Gemini, and any terminal AI
3. **Edit Friendly**: Allows users to review/edit before submission
4. **Speech Compatible**: Perfect for voice-to-text workflows
5. **Simple Implementation**: Just two API calls

## Implementation Details

### Input Injector Options

```typescript
interface InjectionOptions {
  manualSubmit?: boolean  // Bulk text without auto-Enter
  raw?: boolean          // Send raw input (for CR)
  // ... other options
}
```

### Voice Dictation Workflow (e.g., Wispr Flow)

1. User speaks into microphone
2. Speech converted to text
3. Text injected with `manualSubmit: true`
4. User reviews text (can edit if needed)
5. User presses Enter to submit
6. System sends `'\r'` with `raw: true`

### Programmatic Workflow

```javascript
// Send a prepared prompt
await inject(prompt, { manualSubmit: true });

// Wait for user confirmation or timeout
await waitForUserConfirmation();

// Submit
await inject('\r', { raw: true });
```

## Migration from Character-by-Character

Initially, we thought some AIs (like Claude) needed character-by-character input. However, testing revealed that:

- ❌ **Old assumption**: Claude needs each character sent individually
- ✅ **Reality**: Claude (and all AIs) accept bulk text fine
- ✅ **Key insight**: Only the Enter key needs special handling (`\r` not `\n`)

## API Examples

### JavaScript/TypeScript
```javascript
// Using the orchestrator
const orchestrator = new Orchestrator();

// Send message
await orchestrator.injectToAgent('claude-1', 'What is quantum computing?', {
  manualSubmit: true
});

// Submit when ready
await orchestrator.injectToAgent('claude-1', '\r', { raw: true });
```

### HTTP API
```bash
# Send text
curl -X POST http://localhost:9801/api/agents/claude-1/inject \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is quantum computing?", "manualSubmit": true}'

# Submit with Enter
curl -X POST http://localhost:9801/api/agents/claude-1/inject \
  -H "Content-Type: application/json" \
  -d '{"prompt": "\r", "raw": true}'
```

## Compatibility

Tested and confirmed working with:
- ✅ Claude CLI
- ✅ ChatGPT CLI
- ✅ Gemini CLI
- ✅ Custom shell scripts
- ✅ Any terminal-based AI tool

## Best Practices

1. **Always use `manualSubmit: true`** for user-facing text injection
2. **Use `'\r'` (carriage return)** for Enter, not `'\n'` (newline)
3. **Allow review time** between text injection and submission
4. **Handle errors** - AI might not be ready or might timeout
5. **Check readiness** before injecting (use AIReadinessDetector)

## Conclusion

The manual submit pattern (`manualSubmit: true` + raw `\r`) is the universal solution for AI CLI interaction. It's simple, reliable, and works with every terminal AI tool we've tested.