# Build Instructions for Token Saver MCP

## Prerequisites

- Node.js 18+ 
- pnpm (`npm install -g pnpm`)
- VSCode
- vsce (`pnpm add -g @vscode/vsce`)

## Development Build

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint

# Type check
pnpm run typecheck
```

## Package as VSIX

### Important: Use --no-dependencies flag

Due to the complex dependency tree with dev dependencies, always use the `--no-dependencies` flag when packaging:

```bash
# Package the extension
pnpm exec vsce package --no-dependencies
```

This will create `token-saver-mcp-{version}.vsix` in the project root.

### Why --no-dependencies?

The extension bundles all runtime dependencies into `dist/index.js` during the build process. The `--no-dependencies` flag tells vsce to skip dependency validation, which often fails due to dev dependencies that aren't needed in the packaged extension.

## Install VSIX

### Option 1: Command Line
```bash
code --install-extension token-saver-mcp-1.0.0.vsix --force
```

### Option 2: VSCode UI
1. Open VSCode Command Palette (Cmd/Ctrl + Shift + P)
2. Run "Extensions: Install from VSIX..."
3. Select the .vsix file

### Option 3: Extensions View
1. Open Extensions view
2. Click "..." menu
3. Choose "Install from VSIX..."

## After Installation

**Important**: You must restart VSCode for the extension to fully activate:
- Reload Window: Cmd/Ctrl + R
- Or: Command Palette → "Developer: Reload Window"

## Verify Installation

After restarting VSCode:

1. Check extension is loaded:
```bash
code --list-extensions | grep token-saver
```

2. Check MCP server is running:
```bash
curl http://127.0.0.1:9527/workspace-info
```

3. In VSCode, you should see "Token Saver MCP" in the status bar

## Troubleshooting

### Extension not activating
- Ensure VSCode was restarted after installation
- Check Output panel → "Token Saver MCP" for error messages
- Verify no port conflicts on 9527

### Port already in use
The extension automatically tries ports 9527-9537 if the default is busy.

### Build errors
- Clear node_modules: `rm -rf node_modules && pnpm install`
- Clear build cache: `rm -rf dist`
- Rebuild: `pnpm run build`

## Release Build

For creating a release:

```bash
# Update version in package.json
# Then:
pnpm run build
pnpm exec vsce package --no-dependencies

# The VSIX file is ready for distribution
```

## Development Workflow

1. Make changes to source code
2. Run `pnpm run build`
3. Package with `pnpm exec vsce package --no-dependencies`
4. Install with `code --install-extension token-saver-mcp-*.vsix --force`
5. Restart VSCode
6. Test your changes