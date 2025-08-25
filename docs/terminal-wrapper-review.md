# Terminal Wrapper Review

This note summarizes a focused review of `src/terminal-wrapper` and related integration points. It highlights high‑impact fixes first, then reliability and QoL improvements.

## High-Impact Fixes
- PTY terminal type: `orchestrator.ts` → `spawnAgent` sets `ptyConfig.name = ${config.type}-${config.name}` which is passed to `node-pty` as the terminal type. Use a valid term (e.g., `xterm-256color`) instead of an identifier.
  - Files: `src/terminal-wrapper/orchestrator.ts`, `src/terminal-wrapper/pty-manager.ts`.
- Ready-state semantics: `PTYManager.spawn()` calls `setState('ready')` immediately after spawn. This can mask startup issues and cause `waitForReady` to return too early. Prefer detecting readiness via actual prompt patterns (`StateDetector`).
  - File: `src/terminal-wrapper/pty-manager.ts`.
- Memory namespace consistency: `saveToMemory`/`loadFromMemory` prefix keys with `memoryNamespace`, but workflow step results and `buildPrompt` use un-namespaced keys. Choose one convention and apply consistently (either store results under the namespace and look them up with it, or avoid namespacing here and use a prefix pattern).
  - File: `src/terminal-wrapper/orchestrator.ts` (`saveToMemory`, `loadFromMemory`, `executeWorkflowStep`, `buildPrompt`).

## Reliability Improvements
- Injection retry backoff: In `InputInjector.processQueue`, failed items are re‑queued without delay, creating tight retry loops under persistent failures. Add jittered backoff before re‑queueing.
  - File: `src/terminal-wrapper/input-injector.ts`.
- Public status API: `mcp-integration.ts` reaches into a private method via `this.orchestrator['getAgentStatuses']()`. Expose a public getter (e.g., `listAgentStatuses()`) and call that instead.
  - Files: `src/terminal-wrapper/orchestrator.ts`, `src/terminal-wrapper/mcp-integration.ts`.
- Output sanitization: `SafeTerminalHandler`/`AICLIHandler` exist, but `agent-output` currently broadcasts raw PTY data. Sanitize before broadcasting to prevent ANSI/control sequence issues in dashboards.
  - Files: `src/terminal-wrapper/orchestrator.ts`, `src/terminal-wrapper/safe-terminal-handler.ts`.

## Quality of Life
- Clearer spawn errors: When `node-pty` fails (e.g., ENOENT), include command and args in `agent-error` broadcast to speed diagnosis.
  - File: `src/terminal-wrapper/orchestrator.ts` (error handler in `setupAgentEventHandlers`).
- Prompt readiness flexibility: Allow UI/clients to register CLI‑specific ready patterns (via `StateDetector.addStatePattern`) or pass `waitForReady: false` for CLIs without prompts.
  - Files: `src/terminal-wrapper/state-detector.ts`, `src/terminal-wrapper/mcp-integration.ts` (optional input to add pattern).
- WebSocket output pacing: Coalesce/throttle `agent-output` bursts to avoid overwhelming clients on large streams.
  - File: `src/terminal-wrapper/orchestrator.ts`.

## Minor Notes
- Agent selection: Scoring multiplies success rate and inverse response time; consider small epsilon/decay to stabilize early metrics.
- Cleanup: `PTYManager.cleanup()` uses `removeAllListeners()`; acceptable here, but be mindful it nukes external listeners if any are ever attached directly to PTYManager.

If desired, I can submit a small follow‑up patch implementing:
- Correct terminal type (`xterm-256color`).
- Public agent status getter.
- Retry backoff in `InputInjector`.
- Optional sanitization before broadcasting `agent-output`.
