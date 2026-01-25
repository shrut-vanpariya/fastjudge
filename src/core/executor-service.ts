/**
 * FastJudge Executor Service
 * Handles code execution with time limits and output capture
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ExecutionResult, Language } from '../types';
import { LanguageService, languageService } from './language-service';

/** Default time limit in milliseconds */
const DEFAULT_TIME_LIMIT_MS = 2000;

/** Signal names mapping */
const SIGNAL_NAMES: Record<number, string> = {
    11: 'SIGSEGV',  // Segmentation fault
    8: 'SIGFPE',    // Floating point exception
    6: 'SIGABRT',   // Aborted
    9: 'SIGKILL',   // Killed
};

export class ExecutorService {
    private timeLimitMs: number;
    private langService: LanguageService;

    constructor(timeLimitMs?: number, langService?: LanguageService) {
        this.timeLimitMs = timeLimitMs || DEFAULT_TIME_LIMIT_MS;
        this.langService = langService || languageService;
    }

    /**
     * Execute program with input string and capture output
     */
    async execute(
        executablePath: string,
        input: string,
        language?: Language
    ): Promise<ExecutionResult> {
        return this.runProcess(executablePath, input, language);
    }

    /**
     * Execute program with input from file (streaming for large inputs)
     */
    async executeWithFile(
        executablePath: string,
        inputPath: string,
        language?: Language
    ): Promise<ExecutionResult> {
        const input = await fs.promises.readFile(inputPath, 'utf-8');
        return this.runProcess(executablePath, input, language);
    }

    /**
     * Run the process with time limit enforcement
     */
    private runProcess(
        executablePath: string,
        input: string,
        language?: Language
    ): Promise<ExecutionResult> {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let timedOut = false;
            let killed = false;

            // Build command based on language
            const { command, args } = this.buildCommand(executablePath, language);

            const proc = spawn(command, args, {
                cwd: path.dirname(executablePath),
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            // Capture stdout
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            // Capture stderr
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            // Set up time limit
            const timer = setTimeout(() => {
                timedOut = true;
                killed = true;
                this.killProcess(proc);
            }, this.timeLimitMs);

            // Handle process completion
            proc.on('close', (code, signal) => {
                clearTimeout(timer);
                const executionTimeMs = Date.now() - startTime;

                resolve({
                    stdout,
                    stderr,
                    exitCode: code ?? -1,
                    executionTimeMs,
                    timedOut,
                });
            });

            // Handle spawn errors
            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    stdout: '',
                    stderr: `Execution error: ${err.message}`,
                    exitCode: -1,
                    executionTimeMs: Date.now() - startTime,
                    timedOut: false,
                });
            });

            // Write input to stdin
            if (proc.stdin) {
                proc.stdin.write(input);
                proc.stdin.end();
            }
        });
    }

    /**
     * Build command and arguments based on executable and language
     */
    private buildCommand(
        executablePath: string,
        language?: Language
    ): { command: string; args: string[] } {
        // If no language provided, try to detect from extension
        if (!language) {
            const ext = path.extname(executablePath).toLowerCase();
            if (ext === '.py') {
                language = 'python';
            } else if (ext === '.js') {
                language = 'javascript';
            }
        }

        // For interpreted languages, use the interpreter
        if (language === 'python') {
            return {
                command: 'python',
                args: [executablePath],
            };
        }

        if (language === 'javascript') {
            return {
                command: 'node',
                args: [executablePath],
            };
        }

        // For compiled executables, run directly
        return {
            command: executablePath,
            args: [],
        };
    }

    /**
     * Kill process and all its children
     */
    private killProcess(proc: ChildProcess): void {
        try {
            if (process.platform === 'win32') {
                // On Windows, use taskkill to kill process tree
                spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { shell: true });
            } else {
                // On Unix, kill process group
                process.kill(-proc.pid!, 'SIGKILL');
            }
        } catch {
            // Process may have already exited
            try {
                proc.kill('SIGKILL');
            } catch {
                // Ignore
            }
        }
    }

    /**
     * Parse signal from exit code
     */
    parseSignal(exitCode: number): string | undefined {
        // On Unix, signal = 128 + signal_number or negative signal
        if (exitCode > 128) {
            const signal = exitCode - 128;
            return SIGNAL_NAMES[signal];
        }
        if (exitCode < 0) {
            return SIGNAL_NAMES[Math.abs(exitCode)];
        }
        return undefined;
    }

    /**
     * Set time limit
     */
    setTimeLimit(ms: number): void {
        this.timeLimitMs = ms;
    }

    /**
     * Get current time limit
     */
    getTimeLimit(): number {
        return this.timeLimitMs;
    }
}

// Export singleton instance
export const executorService = new ExecutorService();
