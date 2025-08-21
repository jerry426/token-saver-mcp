#!/usr/bin/env python3
"""
Helper script to generate the Claude MCP setup command for a project.
Reads the .mcp_server_port file and outputs the command to run.
"""
import os
import sys
from pathlib import Path

def get_project_port(project_path="."):
    """Read the port number from .mcp_server_port file"""
    port_file = Path(project_path) / ".mcp_server_port"
    
    if not port_file.exists():
        return None
    
    try:
        with open(port_file, 'r') as f:
            port = f.read().strip()
            return int(port)
    except (ValueError, IOError):
        return None

def main():
    # Get project path from argument or use current directory
    project_path = sys.argv[1] if len(sys.argv) > 1 else "."
    project_name = Path(project_path).resolve().name
    
    port = get_project_port(project_path)
    
    if port is None:
        print(f"❌ No .mcp_server_port file found in {project_path}")
        print("\nTo fix this:")
        print(f"1. Create a .mcp_server_port file in your project root")
        print(f"2. Add a unique port number (e.g., 9527, 9528, 9529)")
        print(f"\nExample:")
        print(f"   echo '9528' > {project_path}/.mcp_server_port")
        sys.exit(1)
    
    print(f"✅ Found port {port} for project: {project_name}")
    print("\n" + "="*60)
    print("Run this command to add/update the MCP server in Claude:")
    print("="*60 + "\n")
    
    # Generate the Claude command - use consistent name "token-saver" for all projects
    # This allows switching between projects by just updating the port
    command = f"claude mcp add --transport http token-saver http://127.0.0.1:{port}/mcp"
    
    print(command)
    print(f"\nNote: This will configure Claude to use the Token Saver MCP server on port {port}")
    print(f"      for the '{project_name}' project")
    
    print("\n" + "="*60)
    print("After running the command above:")
    print("="*60)
    print("1. Make sure VSCode is running with this project open")
    print("2. The Token Saver MCP extension should show as active in the status bar")
    print(f"3. The MCP server will be available at port {port}")
    print("\nNote: Each project needs a unique port number in its .mcp_server_port file")

if __name__ == "__main__":
    main()