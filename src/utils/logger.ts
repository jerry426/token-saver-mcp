import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LoggerConfig {
  level?: LogLevel;
  console?: boolean;
  file?: string;
  timestamp?: boolean;
  colors?: boolean;
}

export class Logger {
  private name: string;
  private config: LoggerConfig;
  private static globalConfig: LoggerConfig = {
    level: LogLevel.INFO,
    console: true,
    timestamp: true,
    colors: true
  };
  
  private static logStream?: fs.WriteStream;
  private static colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
  };

  constructor(name: string, config?: LoggerConfig) {
    this.name = name;
    this.config = { ...Logger.globalConfig, ...config };
    
    if (this.config.file && !Logger.logStream) {
      const logDir = path.dirname(this.config.file);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      Logger.logStream = fs.createWriteStream(this.config.file, { flags: 'a' });
    }
  }

  static setGlobalConfig(config: LoggerConfig): void {
    Logger.globalConfig = { ...Logger.globalConfig, ...config };
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level > (this.config.level ?? LogLevel.INFO)) return;

    const timestamp = this.config.timestamp 
      ? new Date().toISOString() 
      : '';
    
    const levelStr = LogLevel[level].padEnd(5);
    const nameStr = `[${this.name}]`;
    
    // Format message with additional arguments
    let fullMessage = message;
    if (args.length > 0) {
      fullMessage += ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
    }

    if (this.config.console) {
      let color = Logger.colors.reset;
      switch (level) {
        case LogLevel.ERROR: color = Logger.colors.red; break;
        case LogLevel.WARN: color = Logger.colors.yellow; break;
        case LogLevel.INFO: color = Logger.colors.blue; break;
        case LogLevel.DEBUG: color = Logger.colors.cyan; break;
        case LogLevel.TRACE: color = Logger.colors.gray; break;
      }

      const consoleMessage = this.config.colors
        ? `${Logger.colors.gray}${timestamp}${Logger.colors.reset} ${color}${levelStr}${Logger.colors.reset} ${nameStr} ${fullMessage}`
        : `${timestamp} ${levelStr} ${nameStr} ${fullMessage}`;
      
      console.log(consoleMessage);
    }

    if (Logger.logStream) {
      const fileMessage = `${timestamp} ${levelStr} ${nameStr} ${fullMessage}\n`;
      Logger.logStream.write(fileMessage);
    }
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  trace(message: string, ...args: any[]): void {
    this.log(LogLevel.TRACE, message, ...args);
  }

  static close(): void {
    if (Logger.logStream) {
      Logger.logStream.end();
      Logger.logStream = undefined;
    }
  }
}