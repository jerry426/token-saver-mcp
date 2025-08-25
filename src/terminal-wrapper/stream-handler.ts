import { EventEmitter } from 'events';
import { Readable, Transform } from 'stream';
import { Logger } from '../utils/logger';

export interface StreamConfig {
  bufferSize?: number;
  flushInterval?: number;
  encoding?: BufferEncoding;
  lineDelimiter?: string;
}

export interface StreamChunk {
  agentName: string;
  data: string;
  timestamp: number;
  sequence: number;
  metadata?: Record<string, any>;
}

export class StreamHandler extends EventEmitter {
  private streams: Map<string, AgentStream> = new Map();
  private logger: Logger;
  private globalSequence: number = 0;

  constructor() {
    super();
    this.logger = new Logger('StreamHandler');
  }

  createAgentStream(agentName: string, config?: StreamConfig): AgentStream {
    if (this.streams.has(agentName)) {
      this.logger.warn(`Stream for agent ${agentName} already exists`);
      return this.streams.get(agentName)!;
    }

    const stream = new AgentStream(agentName, config);
    this.streams.set(agentName, stream);

    // Forward stream events
    stream.on('data', (chunk: StreamChunk) => {
      chunk.sequence = this.globalSequence++;
      this.emit('stream-data', chunk);
    });

    stream.on('error', (error) => {
      this.emit('stream-error', { agentName, error });
    });

    stream.on('end', () => {
      this.emit('stream-end', { agentName });
    });

    this.logger.info(`Created stream for agent: ${agentName}`);
    return stream;
  }

  getStream(agentName: string): AgentStream | undefined {
    return this.streams.get(agentName);
  }

  removeStream(agentName: string): void {
    const stream = this.streams.get(agentName);
    if (stream) {
      stream.end();
      this.streams.delete(agentName);
      this.logger.info(`Removed stream for agent: ${agentName}`);
    }
  }

  // Create a multiplexed stream that combines all agent streams
  createMultiplexedStream(): Readable {
    const multiplexed = new Readable({
      read() {
        // No-op - data is pushed from agent streams
      }
    });

    this.on('stream-data', (chunk: StreamChunk) => {
      const formatted = JSON.stringify(chunk) + '\n';
      multiplexed.push(formatted);
    });

    this.on('stream-end', ({ agentName }) => {
      if (this.streams.size === 0) {
        multiplexed.push(null); // End the stream when all agents are done
      }
    });

    return multiplexed;
  }

  // Create a filtered stream for specific agents
  createFilteredStream(agentNames: string[]): Readable {
    const filtered = new Readable({
      read() {
        // No-op
      }
    });

    this.on('stream-data', (chunk: StreamChunk) => {
      if (agentNames.includes(chunk.agentName)) {
        const formatted = JSON.stringify(chunk) + '\n';
        filtered.push(formatted);
      }
    });

    return filtered;
  }

  getAllStreams(): Map<string, AgentStream> {
    return new Map(this.streams);
  }

  clearAll(): void {
    for (const [name, stream] of this.streams) {
      stream.end();
    }
    this.streams.clear();
    this.logger.info('Cleared all streams');
  }
}

export class AgentStream extends Transform {
  private agentName: string;
  private config: StreamConfig;
  private buffer: string = '';
  private flushTimer?: NodeJS.Timeout;
  private lineBuffer: string = '';
  private chunkCount: number = 0;

  constructor(agentName: string, config?: StreamConfig) {
    super({
      encoding: config?.encoding || 'utf8',
      objectMode: true
    });

    this.agentName = agentName;
    this.config = {
      bufferSize: 4096,
      flushInterval: 100,
      encoding: 'utf8',
      lineDelimiter: '\n',
      ...config
    };

    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    const data = chunk.toString(this.config.encoding);
    this.lineBuffer += data;

    // Process complete lines
    const lines = this.lineBuffer.split(this.config.lineDelimiter || '\n');
    
    // Keep the last incomplete line in the buffer
    this.lineBuffer = lines.pop() || '';

    // Emit complete lines
    for (const line of lines) {
      if (line.trim()) {
        this.emitChunk(line + (this.config.lineDelimiter || '\n'));
      }
    }

    callback();
  }

  _flush(callback: Function): void {
    // Emit any remaining data in the buffer
    if (this.lineBuffer.trim()) {
      this.emitChunk(this.lineBuffer);
    }

    if (this.buffer.trim()) {
      this.flushBuffer();
    }

    this.stopFlushTimer();
    callback();
  }

  private emitChunk(data: string): void {
    const chunk: StreamChunk = {
      agentName: this.agentName,
      data,
      timestamp: Date.now(),
      sequence: this.chunkCount++,
      metadata: {
        encoding: this.config.encoding,
        lineCount: data.split(this.config.lineDelimiter || '\n').length - 1
      }
    };

    this.push(chunk);
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flushBuffer();
      }
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    this.emitChunk(this.buffer);
    this.buffer = '';
  }

  writeData(data: string): void {
    this.write(data);
  }

  getStats(): {
    agentName: string;
    chunkCount: number;
    bufferSize: number;
    isActive: boolean;
  } {
    return {
      agentName: this.agentName,
      chunkCount: this.chunkCount,
      bufferSize: this.buffer.length + this.lineBuffer.length,
      isActive: !this.destroyed
    };
  }
}

// WebSocket streaming adapter
export class WebSocketStreamAdapter {
  private streamHandler: StreamHandler;
  private connections: Map<string, any> = new Map();
  private logger: Logger;

  constructor(streamHandler: StreamHandler) {
    this.streamHandler = streamHandler;
    this.logger = new Logger('WebSocketStreamAdapter');
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.streamHandler.on('stream-data', (chunk: StreamChunk) => {
      this.broadcast({
        type: 'stream-data',
        ...chunk
      });
    });

    this.streamHandler.on('stream-error', ({ agentName, error }) => {
      this.broadcast({
        type: 'stream-error',
        agentName,
        error: error.message,
        timestamp: Date.now()
      });
    });

    this.streamHandler.on('stream-end', ({ agentName }) => {
      this.broadcast({
        type: 'stream-end',
        agentName,
        timestamp: Date.now()
      });
    });
  }

  addConnection(id: string, ws: any): void {
    this.connections.set(id, ws);
    
    // Send initial state
    const streams = this.streamHandler.getAllStreams();
    const status = Array.from(streams.entries()).map(([name, stream]) => ({
      agentName: name,
      ...stream.getStats()
    }));

    ws.send(JSON.stringify({
      type: 'stream-status',
      streams: status,
      timestamp: Date.now()
    }));

    this.logger.info(`Added WebSocket connection: ${id}`);
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
    this.logger.info(`Removed WebSocket connection: ${id}`);
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    
    for (const [id, ws] of this.connections) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(data);
        }
      } catch (error) {
        this.logger.error(`Failed to send to connection ${id}:`, error);
        this.connections.delete(id);
      }
    }
  }

  // Subscribe to specific agents
  subscribeToAgents(connectionId: string, agentNames: string[]): void {
    const ws = this.connections.get(connectionId);
    if (!ws) return;

    // Store subscription preferences (could be more sophisticated)
    ws.subscribedAgents = agentNames;
    
    this.logger.info(`Connection ${connectionId} subscribed to agents: ${agentNames.join(', ')}`);
  }

  // Server-Sent Events (SSE) adapter for HTTP streaming
  createSSEStream(): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk: StreamChunk, encoding, callback) {
        const sseMessage = `data: ${JSON.stringify(chunk)}\n\n`;
        callback(null, sseMessage);
      }
    });
  }
}

// Utility class for parsing and formatting terminal output
export class TerminalOutputParser {
  private ansiRegex = /\x1b\[[0-9;]*m/g;
  
  stripAnsi(text: string): string {
    return text.replace(this.ansiRegex, '');
  }

  parseLines(text: string): string[] {
    return text.split(/\r?\n/);
  }

  extractPrompt(text: string): string | null {
    const lines = this.parseLines(text);
    const lastLine = lines[lines.length - 1];
    
    // Common prompt patterns
    const promptPatterns = [
      /^[>❯$#]\s*$/,
      /^.*[$#]\s*$/,
      /^>>>\s*$/,
      /^In\s*\[\d+\]:\s*$/
    ];

    for (const pattern of promptPatterns) {
      if (pattern.test(lastLine)) {
        return lastLine;
      }
    }

    return null;
  }

  formatForDisplay(text: string, options?: {
    stripAnsi?: boolean;
    maxLineLength?: number;
    maxLines?: number;
  }): string {
    let processed = text;
    
    if (options?.stripAnsi) {
      processed = this.stripAnsi(processed);
    }

    let lines = this.parseLines(processed);
    
    if (options?.maxLineLength) {
      lines = lines.map(line => 
        line.length > options.maxLineLength! 
          ? line.substring(0, options.maxLineLength! - 3) + '...'
          : line
      );
    }

    if (options?.maxLines && lines.length > options.maxLines) {
      lines = lines.slice(-options.maxLines);
    }

    return lines.join('\n');
  }
}