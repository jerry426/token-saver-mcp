import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

/**
 * Port Manager for AI Terminal Orchestrator
 * Manages port allocation using hidden file pattern for consistency
 * Default port: 9800 (HTTP API), 9801 (WebSocket)
 */
export class PortManager {
  private static readonly DEFAULT_HTTP_PORT = 9800;
  private static readonly DEFAULT_WS_PORT = 9801;
  private static readonly PORT_FILE = path.join(os.homedir(), '.ai-orchestrator-port');
  private static readonly MAX_PORT_ATTEMPTS = 10;
  
  /**
   * Get or allocate ports for the orchestrator
   */
  static async getPorts(): Promise<{ httpPort: number; wsPort: number }> {
    // Try to read existing port from file
    const existingPort = this.readPortFromFile();
    
    if (existingPort) {
      // Check if ports are still in use
      const httpInUse = await this.isPortInUse(existingPort.httpPort);
      const wsInUse = await this.isPortInUse(existingPort.wsPort);
      
      if (httpInUse || wsInUse) {
        // Ports are in use, return them
        return existingPort;
      }
    }
    
    // Find available ports starting from defaults
    const httpPort = await this.findAvailablePort(this.DEFAULT_HTTP_PORT);
    // Ensure WebSocket port is different from HTTP port
    let wsPort = this.DEFAULT_WS_PORT;
    if (wsPort === httpPort) {
      wsPort = httpPort + 1;
    }
    wsPort = await this.findAvailablePort(wsPort);
    
    // Save to file for future reference
    this.savePortToFile({ httpPort, wsPort });
    
    return { httpPort, wsPort };
  }
  
  /**
   * Release ports and clean up
   */
  static releasePorts(): void {
    try {
      if (fs.existsSync(this.PORT_FILE)) {
        fs.unlinkSync(this.PORT_FILE);
      }
    } catch (error) {
      console.error('Error releasing ports:', error);
    }
  }
  
  /**
   * Read port information from hidden file
   */
  private static readPortFromFile(): { httpPort: number; wsPort: number } | null {
    try {
      if (fs.existsSync(this.PORT_FILE)) {
        const content = fs.readFileSync(this.PORT_FILE, 'utf-8');
        const data = JSON.parse(content);
        
        // Validate data
        if (data.httpPort && data.wsPort && data.pid) {
          // Check if the process is still running
          if (this.isProcessRunning(data.pid)) {
            return { httpPort: data.httpPort, wsPort: data.wsPort };
          }
        }
      }
    } catch (error) {
      // File might be corrupted, ignore and proceed
    }
    return null;
  }
  
  /**
   * Save port information to hidden file
   */
  private static savePortToFile(ports: { httpPort: number; wsPort: number }): void {
    try {
      const data = {
        ...ports,
        pid: process.pid,
        timestamp: new Date().toISOString(),
        project: process.cwd()
      };
      fs.writeFileSync(this.PORT_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving port file:', error);
    }
  }
  
  /**
   * Check if a port is in use
   */
  private static isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      
      server.listen(port, '127.0.0.1');
    });
  }
  
  /**
   * Find an available port starting from the given port
   */
  private static async findAvailablePort(startPort: number): Promise<number> {
    for (let i = 0; i < this.MAX_PORT_ATTEMPTS; i++) {
      const port = startPort + i;
      const inUse = await this.isPortInUse(port);
      
      if (!inUse) {
        return port;
      }
    }
    
    throw new Error(`Could not find available port after ${this.MAX_PORT_ATTEMPTS} attempts`);
  }
  
  /**
   * Check if a process is still running
   */
  private static isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get status information about the orchestrator
   */
  static getStatus(): { running: boolean; ports?: { httpPort: number; wsPort: number }; pid?: number; project?: string } {
    const portInfo = this.readPortFromFile();
    
    if (portInfo) {
      try {
        const content = fs.readFileSync(this.PORT_FILE, 'utf-8');
        const data = JSON.parse(content);
        
        return {
          running: true,
          ports: portInfo,
          pid: data.pid,
          project: data.project
        };
      } catch (error) {
        // Error reading file
      }
    }
    
    return { running: false };
  }
}

// Export convenience functions
export async function getOrchestratorPorts() {
  return PortManager.getPorts();
}

export function releaseOrchestratorPorts() {
  return PortManager.releasePorts();
}

export function getOrchestratorStatus() {
  return PortManager.getStatus();
}