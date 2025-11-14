/**
 * Console Logger
 * Captures and stores console logs for developer settings display
 */

export interface ConsoleLog {
  id: string;
  timestamp: Date;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  args: any[];
}

class ConsoleLoggerService {
  private logs: ConsoleLog[] = [];
  private maxLogs: number = 500; // Keep last 500 logs
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };
  private isCapturing: boolean = false;

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
  }

  /**
   * Start capturing console logs
   */
  startCapture() {
    if (this.isCapturing) return;

    this.isCapturing = true;

    // Intercept console.log
    console.log = (...args: any[]) => {
      this.addLog('log', args);
      this.originalConsole.log(...args);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.addLog('info', args);
      this.originalConsole.info(...args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      this.originalConsole.warn(...args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      this.addLog('error', args);
      this.originalConsole.error(...args);
    };

    // Intercept console.debug
    console.debug = (...args: any[]) => {
      this.addLog('debug', args);
      this.originalConsole.debug(...args);
    };
  }

  /**
   * Stop capturing console logs
   */
  stopCapture() {
    if (!this.isCapturing) return;

    this.isCapturing = false;

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
  }

  /**
   * Add a log entry
   */
  private addLog(level: ConsoleLog['level'], args: any[]) {
    const log: ConsoleLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message: this.formatMessage(args),
      args,
    };

    this.logs.push(log);

    // Keep only the last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Format log arguments into a string
   */
  private formatMessage(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  /**
   * Get all captured logs
   */
  getLogs(): ConsoleLog[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: ConsoleLog['level']): ConsoleLog[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get logs filtered by search term
   */
  searchLogs(searchTerm: string): ConsoleLog[] {
    const term = searchTerm.toLowerCase();
    return this.logs.filter((log) => log.message.toLowerCase().includes(term));
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(
      {
        exported: new Date().toISOString(),
        totalLogs: this.logs.length,
        logs: this.logs.map((log) => ({
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          message: log.message,
        })),
      },
      null,
      2
    );
  }

  /**
   * Get log statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      log: 0,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };

    this.logs.forEach((log) => {
      stats[log.level]++;
    });

    return stats;
  }

  /**
   * Check if capture is active
   */
  isCapturingLogs(): boolean {
    return this.isCapturing;
  }
}

// Export singleton instance
export const consoleLogger = new ConsoleLoggerService();

// Auto-start capture in development AND production (for APK debugging)
// This allows seeing console.log even in production builds
consoleLogger.startCapture();

