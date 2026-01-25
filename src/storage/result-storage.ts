/**
 * Result Storage Service
 * Manages stdout/stderr file storage for test case results
 */

import * as fs from 'fs';
import * as path from 'path';
import { JudgeResult } from '../types';

/** Maximum bytes to show in UI (first 5KB + last 5KB) */
const TRUNCATE_LIMIT = 5 * 1024;

export interface TruncatedOutput {
    content: string;
    truncated: boolean;
    fullPath: string;
    fullSize: number;
}

export class ResultStorageService {
    private resultsDir: string;

    constructor(workspaceRoot: string) {
        this.resultsDir = path.join(workspaceRoot, '.fastjudge', 'results');
    }

    /**
     * Initialize results directory
     */
    async initialize(): Promise<void> {
        await fs.promises.mkdir(this.resultsDir, { recursive: true });
    }

    /**
     * Get directory for a test case's results
     */
    private getTestCaseDir(testCaseId: string): string {
        return path.join(this.resultsDir, testCaseId);
    }

    /**
     * Save stdout and stderr to files
     */
    async saveResults(
        testCaseId: string,
        stdout: string,
        stderr: string
    ): Promise<{ stdoutPath: string; stderrPath: string }> {
        const dir = this.getTestCaseDir(testCaseId);
        await fs.promises.mkdir(dir, { recursive: true });

        const stdoutPath = path.join(dir, 'stdout.txt');
        const stderrPath = path.join(dir, 'stderr.txt');

        await Promise.all([
            fs.promises.writeFile(stdoutPath, stdout, 'utf-8'),
            fs.promises.writeFile(stderrPath, stderr, 'utf-8'),
        ]);

        return { stdoutPath, stderrPath };
    }

    /**
     * Save JudgeResult metadata to JSON file
     */
    async saveJudgeResult(result: JudgeResult): Promise<void> {
        const dir = this.getTestCaseDir(result.testCaseId);
        await fs.promises.mkdir(dir, { recursive: true });

        const resultPath = path.join(dir, 'result.json');
        await fs.promises.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    }

    /**
     * Load JudgeResult from JSON file (returns undefined if not found)
     */
    async loadJudgeResult(testCaseId: string): Promise<JudgeResult | undefined> {
        const dir = this.getTestCaseDir(testCaseId);
        const resultPath = path.join(dir, 'result.json');

        try {
            const content = await fs.promises.readFile(resultPath, 'utf-8');
            return JSON.parse(content) as JudgeResult;
        } catch {
            return undefined;
        }
    }

    /**
     * Load all saved JudgeResults for given test case IDs
     */
    async loadAllResults(testCaseIds: string[]): Promise<Map<string, JudgeResult>> {
        const results = new Map<string, JudgeResult>();

        await Promise.all(testCaseIds.map(async (id) => {
            const result = await this.loadJudgeResult(id);
            if (result) {
                results.set(id, result);
            }
        }));

        return results;
    }

    /**
     * Get truncated output for UI display (first 5KB + last 5KB)
     */
    async getTruncatedOutput(filePath: string): Promise<TruncatedOutput> {
        try {
            const stats = await fs.promises.stat(filePath);
            const fullSize = stats.size;

            if (fullSize <= TRUNCATE_LIMIT * 2) {
                // Small enough, return full content
                const content = await fs.promises.readFile(filePath, 'utf-8');
                return {
                    content,
                    truncated: false,
                    fullPath: filePath,
                    fullSize,
                };
            }

            // Large file - read first and last chunks
            const fd = await fs.promises.open(filePath, 'r');
            try {
                const firstBuffer = Buffer.alloc(TRUNCATE_LIMIT);
                const lastBuffer = Buffer.alloc(TRUNCATE_LIMIT);

                await fd.read(firstBuffer, 0, TRUNCATE_LIMIT, 0);
                await fd.read(lastBuffer, 0, TRUNCATE_LIMIT, fullSize - TRUNCATE_LIMIT);

                const first = firstBuffer.toString('utf-8');
                const last = lastBuffer.toString('utf-8');
                const separator = `\n\n... [${formatBytes(fullSize - TRUNCATE_LIMIT * 2)} truncated] ...\n\n`;

                return {
                    content: first + separator + last,
                    truncated: true,
                    fullPath: filePath,
                    fullSize,
                };
            } finally {
                await fd.close();
            }
        } catch {
            return {
                content: '',
                truncated: false,
                fullPath: filePath,
                fullSize: 0,
            };
        }
    }

    /**
     * Truncate a string for UI display (first 5KB + last 5KB)
     */
    truncateString(content: string): { text: string; truncated: boolean } {
        const bytes = Buffer.byteLength(content, 'utf-8');

        if (bytes <= TRUNCATE_LIMIT * 2) {
            return { text: content, truncated: false };
        }

        // For string truncation, use character count (approximation)
        const charLimit = TRUNCATE_LIMIT;
        const first = content.slice(0, charLimit);
        const last = content.slice(-charLimit);
        const separator = `\n\n... [${formatBytes(bytes - charLimit * 2)} truncated] ...\n\n`;

        return {
            text: first + separator + last,
            truncated: true,
        };
    }

    /**
     * Delete results for a test case (called on re-run)
     */
    async deleteResults(testCaseId: string): Promise<void> {
        const dir = this.getTestCaseDir(testCaseId);
        try {
            await fs.promises.rm(dir, { recursive: true, force: true });
        } catch {
            // Ignore if doesn't exist
        }
    }

    /**
     * Clean up old results (older than specified days)
     * @param retentionDays Days to keep results (default 7)
     */
    async cleanupOldResults(retentionDays: number = 7): Promise<number> {
        let deletedCount = 0;
        const now = Date.now();
        const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

        try {
            const entries = await fs.promises.readdir(this.resultsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const dirPath = path.join(this.resultsDir, entry.name);
                const stats = await fs.promises.stat(dirPath);

                if (now - stats.mtimeMs > maxAgeMs) {
                    await fs.promises.rm(dirPath, { recursive: true, force: true });
                    deletedCount++;
                }
            }
        } catch {
            // Ignore errors during cleanup
        }

        return deletedCount;
    }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
