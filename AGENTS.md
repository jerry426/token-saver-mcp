# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Core TypeScript modules (terminal wrapper, orchestrator, utils). Generated metadata lives in `src/generated/`.
- `vscode-internals-gateway/`: VS Code extension source and build output (`dist/`).
- `mcp-server/`: Standalone MCP server (Node) and dashboard assets.
- `test/`: Tests and examples (primarily Vitest; some legacy Python/JS helpers).
- `scripts/`: Maintenance and docs generation utilities. Assets in `res/`. Docs in `docs/`.

## Build, Test, and Development Commands
- `pnpm i`: Install dependencies (root and workspaces).
- `pnpm dev`: Start extension dev build (watches `vscode-internals-gateway`).
- `pnpm build`: Compile the VS Code extension.
- `pnpm test`: Run unit tests with Vitest.
- `pnpm lint`: Lint repo via ESLint.
- `pnpm typecheck`: Strict TypeScript checks with `tsc --noEmit`.
- `pnpm vsix`: Package the extension (`.vsix`).
Tip: Repo uses `@antfu/ni`; `nr <script>` works too (e.g., `nr build`).

## Coding Style & Naming Conventions
- TypeScript, ES2022; 2‑space indentation; semicolonless per config.
- Filenames: kebab-case (`pty-manager.ts`, `state-detector.ts`).
- Types/classes: PascalCase; variables/functions: camelCase; constants: UPPER_SNAKE.
- Linting: ESLint with `@antfu/eslint-config` (`eslint.config.mjs`). Run `pnpm lint --fix` before PRs.

## Testing Guidelines
- Framework: Vitest. Put specs as `*.test.ts` under `test/` or co‑located near code.
- Aim to cover orchestrator logic, PTY integration, and utilities. Mock external processes where possible.
- Run locally with `pnpm test`. Snapshot tests are acceptable for protocol payloads.

## Commit & Pull Request Guidelines
- Commits: Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) as in current history.
- PRs: Include a clear summary, linked issues, reproduction steps, and screenshots/GIFs for UI changes (e.g., dashboard, VS Code UX).
- Keep PRs focused; update docs when changing behavior (README_* and `docs/`).

## Security & Configuration Tips
- VS Code settings keys: `lsp-mcp.enabled`, `lsp-mcp.port`, `lsp-mcp.maxRetries`.
- VSCode Internals Gateway: tries `9600`, falls back to `9601+`; writes the chosen port to `.vscode_gateway_port`.
- MCP Server: tries `9700`, falls back to `9701+`; writes the chosen port to `.mcp_server_port`.
- Avoid hardcoding ports; read from the above files or environment where applicable.
- Use `AgentConfig.env` for per‑agent secrets/config; never commit secrets or sensitive logs.
