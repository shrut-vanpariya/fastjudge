/**
 * FastJudge Executor Service
 * Handles code execution with time limits and output capture
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';
import { ExecutionResult } from '../types';
import { languageRegistry } from './language-registry';

/** Default time limit in milliseconds */
const DEFAULT_TIME_LIMIT_MS = 2000;

export class ExecutorService {
    private timeLimitMs: number;

    constructor(timeLimitMs?: number) {
        this.timeLimitMs = timeLimitMs || DEFAULT_TIME_LIMIT_MS;
    }

    /**
     * Execute program with input string and capture output
     */
    async execute(
        sourcePath: string,
        outputDir: string,
        input: string,
        language?: string,
        signal?: AbortSignal
    ): Promise<ExecutionResult> {
        return this.runProcess(sourcePath, outputDir, input, language, signal);
    }

    /**
     * Execute program with input from file (streaming for large inputs)
     */
    async executeWithFile(
        sourcePath: string,
        outputDir: string,
        inputPath: string,
        language?: string,
        signal?: AbortSignal
    ): Promise<ExecutionResult> {
        return this.runProcessWithStream(sourcePath, outputDir, inputPath, language, signal);
    }

    /**
     * Run the process with streaming input from file
     */
    private runProcessWithStream(
        sourcePath: string,
        outputDir: string,
        inputPath: string,
        language?: string,
        signal?: AbortSignal
    ): Promise<ExecutionResult> {
        return new Promise((resolve) => {
            // Case 2: Already aborted before process spawns
            if (signal?.aborted) {
                resolve({
                    stdout: '',
                    stderr: '',
                    exitCode: -1,
                    signal: null,
                    executionTimeMs: 0,
                    timedOut: false,
                    aborted: true,
                });
                return;
            }

            const startTime = performance.now();
            let executionTimeMs = 0;
            let timedOut = false;
            let exitCode = -1;
            let exitSignal: NodeJS.Signals | null = null;

            // Build command based on language
            const { command, args } = this.buildCommand(sourcePath, outputDir, language);

            const proc = spawn(command, args, {
                cwd: path.dirname(sourcePath),
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: this.timeLimitMs,
                signal,
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
                this.killProcess(proc);
            }, this.timeLimitMs);

            // Handle process exit (stop timer here)
            proc.on('exit', (code, signal) => {
                executionTimeMs = performance.now() - startTime;
                exitCode = code ?? -1;
                exitSignal = signal;
            });

            // Handle stream close (resolve here to ensure we have all output)
            proc.on('close', () => {
                clearTimeout(timer);

                // Fallback if exit didn't fire (rare but possible with force kill)
                if (executionTimeMs === 0) {
                    executionTimeMs = performance.now() - startTime;
                }

                // Case 1: Process may have been killed by abort signal
                resolve({
                    stdout,
                    stderr,
                    exitCode,
                    signal: exitSignal,
                    executionTimeMs,
                    timedOut,
                    aborted: !!signal?.aborted,
                });
            });

            // Handle spawn errors
            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    stdout: '',
                    stderr: signal?.aborted ? '' : `Execution error: ${err.message}`,
                    exitCode: -1,
                    signal: null,
                    executionTimeMs: performance.now() - startTime,
                    timedOut: false,
                    aborted: !!signal?.aborted,
                });
            });

            // Stream input from file instead of loading to memory
            const inputStream = fs.createReadStream(inputPath);
            inputStream.pipe(proc.stdin!);
            inputStream.on('error', () => {
                proc.stdin?.end();
            });
        });
    }

    /**
     * Run the process with time limit enforcement
     */
    private runProcess(
        sourcePath: string,
        outputDir: string,
        input: string,
        language?: string,
        signal?: AbortSignal
    ): Promise<ExecutionResult> {
        return new Promise((resolve) => {
            // Case 2: Already aborted before process spawns
            if (signal?.aborted) {
                resolve({
                    stdout: '',
                    stderr: '',
                    exitCode: -1,
                    signal: null,
                    executionTimeMs: 0,
                    timedOut: false,
                    aborted: true,
                });
                return;
            }

            const startTime = performance.now();
            let executionTimeMs = 0;
            let timedOut = false;
            let exitCode = -1;
            let exitSignal: NodeJS.Signals | null = null;

            // Build command based on language
            const { command, args } = this.buildCommand(sourcePath, outputDir, language);

            const proc = spawn(command, args, {
                cwd: path.dirname(sourcePath),
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: this.timeLimitMs,
                signal, // Pass AbortSignal to spawn
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
                this.killProcess(proc);
            }, this.timeLimitMs);

            // Handle process exit (stop timer here)
            proc.on('exit', (code, signal) => {
                executionTimeMs = performance.now() - startTime;
                exitCode = code ?? -1;
                exitSignal = signal;
            });

            // Handle stream close (resolve here)
            proc.on('close', () => {
                clearTimeout(timer);

                if (executionTimeMs === 0) {
                    executionTimeMs = performance.now() - startTime;
                }

                // Case 1: Process may have been killed by abort signal
                resolve({
                    stdout,
                    stderr,
                    exitCode,
                    signal: exitSignal,
                    executionTimeMs,
                    timedOut,
                    aborted: !!signal?.aborted,
                });
            });

            // Handle spawn errors
            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    stdout: '',
                    stderr: signal?.aborted ? '' : `Execution error: ${err.message}`,
                    exitCode: -1,
                    signal: null,
                    executionTimeMs: performance.now() - startTime,
                    timedOut: false,
                    aborted: !!signal?.aborted,
                });
            });

            // Write input to stdin
            if (proc.stdin) {
                proc.stdin.write(input);
                proc.stdin.end();
            }
        });
    }

    private buildCommand(
        sourcePath: string,
        outputDir: string,
        language?: string
    ): { command: string; args: string[] } {
        // If no language provided, try to detect from extension
        const provider = language ? languageRegistry.getProvider(language) : languageRegistry.detectProvider(sourcePath);

        if (provider) {
            return provider.getRunCommand(sourcePath, outputDir);
        }

        // Fallback for executable without extension
        return {
            command: sourcePath,
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
                spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { shell: false });
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
