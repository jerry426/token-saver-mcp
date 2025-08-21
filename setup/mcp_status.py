#!/usr/bin/env python3
"""
MCP Status Dashboard - Shows all configured MCP servers and their status
"""
import json
import os
import requests
from pathlib import Path
from datetime import datetime
import subprocess

# Colors for terminal output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
BOLD = '\033[1m'
NC = '\033[0m'  # No Color

def check_port_listener(port):
    """Check if something is listening on the port"""
    try:
        result = subprocess.run(
            ['lsof', '-Pi', f':{port}', '-sTCP:LISTEN'],
            capture_output=True,
            text=True,
            timeout=2
        )
        return result.returncode == 0
    except:
        return False

def check_mcp_server(port):
    """Check if MCP server is responding"""
    try:
        response = requests.get(f"http://127.0.0.1:{port}/workspace-info", timeout=2)
        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

def find_projects_with_mcp():
    """Find all projects with MCP configuration"""
    projects = []
    
    # Search common project directories
    search_dirs = [
        Path.home() / "VSCode",
        Path.home() / "Projects",
        Path.home() / "Development",
        Path.cwd()
    ]
    
    for base_dir in search_dirs:
        if not base_dir.exists():
            continue
            
        # Look for .mcp_server_port files
        for port_file in base_dir.rglob(".mcp_server_port"):
            project_dir = port_file.parent
            try:
                port = int(port_file.read_text().strip())
                
                # Check for status file
                status_file = project_dir / ".lsp_mcp_status.json"
                if status_file.exists():
                    status = json.loads(status_file.read_text())
                else:
                    status = {
                        "project": project_dir.name,
                        "path": str(project_dir),
                        "port": port
                    }
                
                projects.append(status)
            except:
                continue
    
    return projects

def display_dashboard():
    """Display the MCP status dashboard"""
    print(f"\n{BOLD}{'='*60}{NC}")
    print(f"{BOLD}Token Saver MCP - Status Dashboard{NC}")
    print(f"{BOLD}{'='*60}{NC}\n")
    
    projects = find_projects_with_mcp()
    
    if not projects:
        print(f"{YELLOW}No projects with MCP configuration found.{NC}")
        print("\nTo set up a project, run:")
        print("  ./auto_setup_mcp.sh /path/to/project")
        return
    
    # Check Claude configuration
    claude_config_path = Path.home() / ".claude.json"
    claude_configured_port = None
    
    if claude_config_path.exists():
        try:
            claude_config = json.loads(claude_config_path.read_text())
            for project_config in claude_config.get("projects", {}).values():
                mcp_servers = project_config.get("mcpServers", {})
                # Check for token-saver in MCP servers
                if "token-saver" in mcp_servers:
                    url = mcp_servers["token-saver"].get("url", "")
                    if "http://" in url:
                        claude_configured_port = int(url.split(":")[-1].replace("/mcp", ""))
                        break
        except:
            pass
    
    print(f"{BOLD}Configured Projects:{NC}\n")
    
    for i, project in enumerate(projects, 1):
        port = project.get("port")
        name = project.get("project", "Unknown")
        path = project.get("path", "Unknown")
        
        # Check status
        port_open = check_port_listener(port)
        mcp_info = check_mcp_server(port) if port_open else None
        
        # Determine status color and icon
        if mcp_info:
            status_color = GREEN
            status_icon = "✓"
            status_text = "Running"
        elif port_open:
            status_color = YELLOW
            status_icon = "?"
            status_text = "Port open (initializing?)"
        else:
            status_color = RED
            status_icon = "✗"
            status_text = "Not running"
        
        # Check if this is the Claude-configured port
        claude_marker = ""
        if port == claude_configured_port:
            claude_marker = f" {BLUE}[CLAUDE ACTIVE]{NC}"
        
        print(f"{BOLD}{i}. {name}{NC}{claude_marker}")
        print(f"   Path: {path}")
        print(f"   Port: {port}")
        print(f"   Status: {status_color}{status_icon} {status_text}{NC}")
        
        if mcp_info:
            print(f"   Workspace: {mcp_info.get('workspaceName', 'Unknown')}")
            if 'workspaceId' in mcp_info:
                print(f"   ID: {mcp_info['workspaceId'][:8]}...")
        
        print()
    
    # Show Claude configuration status
    print(f"{BOLD}Claude Configuration:{NC}")
    if claude_configured_port:
        print(f"  Active MCP server: port {claude_configured_port}")
        matching = [p for p in projects if p.get("port") == claude_configured_port]
        if matching:
            print(f"  Connected to: {matching[0].get('project')}")
        else:
            print(f"  {YELLOW}⚠ Port {claude_configured_port} not found in projects{NC}")
    else:
        print(f"  {YELLOW}No MCP server configured in Claude{NC}")
    
    print(f"\n{BOLD}Quick Actions:{NC}")
    print("  • Setup new project:  ./auto_setup_mcp.sh /path/to/project")
    print("  • Find all servers:   python3 test/find_mcp_servers.py")
    print("  • Test a server:      curl http://127.0.0.1:PORT/workspace-info")
    print()

if __name__ == "__main__":
    display_dashboard()