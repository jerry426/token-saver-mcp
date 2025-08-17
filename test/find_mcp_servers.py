#!/usr/bin/env python3
"""
Find all running Token Saver MCP servers on this machine.
This helps identify which port to use for which VSCode instance.
"""
import requests
import json

def check_mcp_server(port):
    """Check if an MCP server is running on the given port"""
    # Try both IPv4 and IPv6 localhost addresses
    for host in ['127.0.0.1', 'localhost', '[::1]']:
        try:
            url = f"http://{host}:{port}/mcp"
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            }
            
            # Try to initialize a session
            init_request = {
                "jsonrpc": "2.0",
                "method": "initialize",
                "id": 0,
                "params": {
                    "protocolVersion": "1.0.0",
                    "capabilities": {},
                    "clientInfo": {"name": "discovery", "version": "1.0"}
                }
            }
            
            response = requests.post(url, json=init_request, headers=headers, timeout=1, stream=True)
            
            if response.status_code == 200:
                # Try to get workspace info
                info_url = f"http://{host}:{port}/workspace-info"
                try:
                    info_response = requests.get(info_url, timeout=1)
                    if info_response.status_code == 200:
                        result = info_response.json()
                        result['port'] = port
                        result['host'] = host
                        return result
                    else:
                        return {"port": port, "host": host, "status": "MCP server running (no workspace info)"}
                except:
                    return {"port": port, "host": host, "status": "MCP server running"}
        except requests.exceptions.RequestException:
            continue
        except Exception:
            continue
    
    return None

def find_all_mcp_servers(start_port=9527, end_port=9537):
    """Scan a range of ports for MCP servers"""
    servers = []
    
    print(f"Scanning ports {start_port}-{end_port} for Token Saver MCP servers...\n")
    
    for port in range(start_port, end_port + 1):
        result = check_mcp_server(port)
        if result:
            servers.append(result)
            print(f"✓ Found MCP server on port {port}")
            if 'workspaceId' in result:
                print(f"  Workspace ID: {result['workspaceId']}")
            if 'workspacePath' in result:
                print(f"  Workspace Path: {result['workspacePath']}")
            print()
    
    return servers

def main():
    servers = find_all_mcp_servers()
    
    if not servers:
        print("No Token Saver MCP servers found.")
        print("\nTroubleshooting:")
        print("1. Make sure VSCode is running")
        print("2. Check that the Token Saver MCP extension is installed and enabled")
        print("3. Try reloading the VSCode window (Cmd/Ctrl+R)")
        print("4. Check VSCode Output panel for 'Token Saver MCP' to see if server started")
    else:
        print("=" * 60)
        print(f"Found {len(servers)} MCP server(s):\n")
        
        for i, server in enumerate(servers, 1):
            port = server.get('port', 'unknown')
            print(f"Server {i}: http://127.0.0.1:{port}/mcp")
            
            if 'workspaceId' in server:
                print(f"  Workspace ID: {server['workspaceId']}")
            if 'workspacePath' in server:
                print(f"  Path: {server['workspacePath']}")
            print()
        
        print("\nTo use a specific server in Claude:")
        print("1. Note the port number for your desired workspace")
        print("2. Use the MCP server URL: http://127.0.0.1:{port}/mcp")

if __name__ == "__main__":
    main()