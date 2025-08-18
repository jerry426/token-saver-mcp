# GEMINI.md: Token Saver MCP Project

## Project Overview

This project, "Token Saver MCP," is a Visual Studio Code extension that acts as a Multi-Context Proxy (MCP). Its primary purpose is to revolutionize AI-assisted development by providing AI assistants with direct, high-speed access to both backend code intelligence and frontend browser control.

It exposes two main toolsets via a local HTTP server:
1.  **Language Server Protocol (LSP) Tools:** Gives the AI direct access to VSCode's indexed code intelligence (e.g., definitions, references, hover info). This is significantly faster and more token-efficient (90-99% savings) than traditional text-based search commands like `grep`.
2.  **Chrome DevTools Protocol (CDP) Tools:** Gives the AI full control over a web browser (preferring Microsoft Edge for performance) for automated testing, debugging, and frontend interaction.

The goal is to transform an AI assistant from a simple code suggester into a true full-stack development partner capable of writing, testing, and verifying its own code across the entire stack.

The project is written in **TypeScript** and runs on **Node.js**. It uses `tsup` to bundle the extension into a single file for distribution.

## Building and Running

The project uses `pnpm` for package management.

### Key Commands

*   **Install Dependencies:**
    ```bash
    pnpm install
    ```

*   **Build the Extension:**
    ```bash
    pnpm run build
    ```
    This command uses `tsup` to compile the TypeScript source into a single `dist/index.js` file, bundling all necessary dependencies.

*   **Run Unit Tests:**
    ```bash
    pnpm run test
    ```
    This executes the test suite using `vitest`.

*   **Linting and Type Checking:**
    ```bash
    # Run ESLint
    pnpm run lint

    # Run TypeScript compiler for type checking
    pnpm run typecheck
    ```

### Running the Extension

The project is a VSCode extension. To run it:
1.  Build the project (`pnpm run build`).
2.  Package it into a `.vsix` file using `pnpm exec vsce package --no-dependencies`.
3.  Install the `.vsix` file into VSCode.
4.  Reload VSCode. The extension activates automatically (`onStartupFinished`) and starts the MCP server on port 9527 by default.

A real-time monitoring dashboard is available at `http://127.0.0.1:9527/dashboard` when the extension is running.

## Development Conventions

*   **Code Style:** The project uses ESLint with `@antfu/eslint-config` for consistent code style. Run `pnpm run lint` to check for issues.
*   **Modularity:** The source code is well-structured, with clear separation of concerns:
    *   `src/index.ts`: Extension entry point.
    *   `src/mcp/`: Core MCP server logic and tool registration.
    *   `src/lsp/`: Implementation of all LSP-based tools.
    *   `src/cdp-bridge/`: Logic for connecting to and controlling the browser.
    *   `src/utils/`: Shared utility functions.
*   **AI Interaction:** The intended way for an AI to learn how to use this project's tools is by calling the `get_instructions` tool. This tool provides up-to-date documentation on all available tools and their usage, which is more efficient than reading documentation files from the filesystem.
*   **Testing:** The project has unit tests (`pnpm run test`) and a comprehensive integration test script (`python3 test/test_mcp_tools.py`) that verifies the functionality of all exposed MCP tools.
