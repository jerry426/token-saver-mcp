#!/usr/bin/env python3
"""
Helper script to generate the Claude MCP setup command for a project.
Reads the .mcp_port file and outputs the command to run.
"""
import os
import sys
from pathlib import Path

def get_project_port(project_path="."):
    """Read the port number from .mcp_port file"""
    port_file = Path(project_path) / ".mcp_port"
    
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
        print(f"❌ No .mcp_port file found in {project_path}")
        print("\nTo fix this:")
        print(f"1. Create a .mcp_port file in your project root")
        print(f"2. Add a unique port number (e.g., 9527, 9528, 9529)")
        print(f"\nExample:")
        print(f"   echo '9528' > {project_path}/.mcp_port")
        sys.exit(1)
    
    print(f"✅ Found port {port} for project: {project_name}")
    print("\n" + "="*60)
    print("Run this command to add the MCP server to Claude:")
    print("="*60 + "\n")
    
    # Generate the Claude command
    command = f"claude mcp add token-saver --transport http http://127.0.0.1:{port}/mcp"
    
    print(command)
    
    print("\n" + "="*60)
    print("After running the command above:")
    print("="*60)
    print("1. Make sure VSCode is running with this project open")
    print("2. The Token Saver MCP extension should show as active in the status bar")
    print(f"3. The MCP server will be available at port {port}")
    print("\nNote: Each project needs a unique port number in its .mcp_port file")

if __name__ == "__main__":
    main()