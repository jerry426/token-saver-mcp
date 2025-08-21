# Token Saver MCP - Setup Tools

This directory contains all setup and management tools for the Token Saver MCP extension.

## Main Entry Point

Use the `mcp` script in the project root for all operations:

```bash
# From project root
./mcp setup      # Set up current directory
./mcp status     # View all projects status  
./mcp claude     # Get Claude configuration
./mcp find       # Find all running servers
./mcp test       # Test a specific server
```

## Configuration Files

The extension uses specific configuration files to avoid conflicts with other MCP-related tools:

- `.mcp_server_port` - Contains the port number for this project's MCP server
- `.lsp_mcp_workspace_id` - Unique identifier for the workspace
- `.lsp_mcp_status.json` - Status information and metadata

These files are prefixed with `lsp_mcp` to distinguish them from other MCP-related files that may exist in your project.

## Individual Scripts

### auto_setup_mcp.sh
Automatic setup script that:
- Finds an available port
- Creates all configuration files
- Tests the MCP server connection
- Optionally configures Claude

### mcp_status.py
Status dashboard showing:
- All MCP-enabled projects
- Server running status
- Which project Claude is connected to
- Quick actions and troubleshooting

### setup_claude_mcp.py
Generates the Claude MCP configuration command for a specific project.

### find_mcp_servers.py (in test/)
Discovers all running MCP servers on the system.

## Port Management

Each project needs a unique port. The extension supports two modes:

1. **Fixed Port Mode** (recommended for multiple projects):
   - Create `.mcp_server_port` file with a unique port number
   - Extension uses this exact port
   - Allows multiple projects to coexist

2. **Dynamic Port Mode** (default):
   - No `.mcp_server_port` file
   - Uses configuration or finds next available port
   - May change between sessions

## Troubleshooting

If MCP tools aren't working:

1. Check server is running: `./mcp status`
2. Verify port configuration: `cat .mcp_server_port`
3. Test server directly: `curl http://127.0.0.1:PORT/workspace-info`
4. Check VSCode output panel for "Token Saver MCP"
5. Reload VSCode window if needed

## File Naming Convention

All configuration files use the `lsp_mcp` prefix to avoid conflicts:
- `.mcp_server_port` (not `.mcp_port`)
- `.lsp_mcp_workspace_id` (not `mcp_workspace_id`)
- `.lsp_mcp_status.json` (not `.mcp_status.json`)

This ensures they don't conflict with other MCP-related tools or configurations in your projects.