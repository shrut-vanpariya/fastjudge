/**
 * FastJudge Compiler Service
 * Handles code compilation with smart caching
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { CompileResult, CacheEntry, ICompilationCache, ILanguageProvider } from '../types';
import { languageRegistry, CustomLanguageProvider } from './language-registry';

// ============================================================================
// Cache Implementations
// ============================================================================

/**
 * In-memory cache implementation (v1)
 * Extensible pattern for future disk persistence
 */
export class MemoryCache implements ICompilationCache {
    private cache = new Map<string, CacheEntry>();

    get(filePath: string): CacheEntry | undefined {
        return this.cache.get(filePath);
    }

    set(filePath: string, entry: CacheEntry): void {
        this.cache.set(filePath, entry);
    }

    delete(filePath: string): void {
        this.cache.delete(filePath);
    }

    clear(): void {
        this.cache.clear();
    }
}

// ============================================================================
// Compiler Service
// ============================================================================

export class CompilerService {
    private outputDir: string;
    private cache: ICompilationCache;

    constructor(
        outputDir: string,
        cache?: ICompilationCache
    ) {
        this.outputDir = outputDir;
        this.cache = cache || new MemoryCache();
    }

    /**
     * Compile source file and return executable path
     * Uses caching to skip compilation if source hasn't changed
     */
    async compile(sourcePath: string): Promise<CompileResult> {
        const startTime = Date.now();

        // Detect language
        const provider = languageRegistry.detectProvider(sourcePath);
        if (!provider) {
            return {
                success: false,
                error: `Unsupported file type: ${path.extname(sourcePath)}`,
                compilationTimeMs: Date.now() - startTime,
            };
        }

        const compileCmd = provider.getCompileCommand(sourcePath, this.outputDir);

        // For interpreted languages, no compilation needed
        if (!compileCmd) {
            return {
                success: true,
                outputDir: this.outputDir,
                compilationTimeMs: 0,
                cached: true,
            };
        }

        // Read source and compute hash
        let content: string;
        try {
            content = await fs.readFile(sourcePath, 'utf-8');
        } catch (err) {
            return {
                success: false,
                error: `Cannot read source file: ${sourcePath}`,
                compilationTimeMs: Date.now() - startTime,
            };
        }

        const hash = this.computeHash(content);

        // Check cache
        const cached = this.cache.get(sourcePath);
        if (cached && cached.contentHash === hash) {
            // Verify the compiled output still exists
            if (cached.executablePath) {
                try {
                    await fs.access(cached.executablePath);
                } catch {
                    // Executable deleted, invalidate cache and recompile
                    this.cache.delete(sourcePath);
                    // Fall through to recompile below
                    return this.recompile(sourcePath, provider, hash, startTime);
                }
            }

            return {
                success: true,
                outputDir: cached.outputDir,
                compilationTimeMs: Date.now() - startTime,
                cached: true,
            };
        }

        return this.recompile(sourcePath, provider, hash, startTime);
    }

    /**
     * Compile (or recompile) with cache update
     */
    private async recompile(
        sourcePath: string,
        provider: ILanguageProvider,
        hash: string,
        startTime: number
    ): Promise<CompileResult> {
        // Ensure output directory exists
        await fs.mkdir(this.outputDir, { recursive: true });

        const compileCmd = provider.getCompileCommand(sourcePath, this.outputDir);
        if (!compileCmd) {
            return { success: false, error: 'No compile command', compilationTimeMs: Date.now() - startTime };
        }

        const result = await this.runCompiler(sourcePath, compileCmd);

        if (result.success) {
            // Compute executable path for cache validation
            const executablePath = (provider instanceof CustomLanguageProvider)
                ? provider.getExecutablePath(sourcePath, this.outputDir)
                : undefined;

            this.cache.set(sourcePath, {
                contentHash: hash,
                outputDir: result.outputDir!,
                executablePath,
                compiledAt: Date.now(),
            });
        }

        return {
            ...result,
            compilationTimeMs: Date.now() - startTime,
            cached: false,
        };
    }

    /**
     * Run the actual compiler command
     */
    private async runCompiler(
        sourcePath: string,
        compileCmd: { command: string, args: string[] }
    ): Promise<CompileResult> {
        const { command, args } = compileCmd;

        return new Promise((resolve) => {
            const proc = spawn(command, args, {
                cwd: path.dirname(sourcePath),
                shell: false,
            });

            let stderr = '';
            let stdout = '';

            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    error: `Compiler not found: ${command}. ${err.message}`,
                    compilationTimeMs: 0,
                });
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        outputDir: this.outputDir,
                        compilationTimeMs: 0,
                    });
                } else {
                    resolve({
                        success: false,
                        error: stderr || stdout || `Compilation failed with exit code ${code}`,
                        compilationTimeMs: 0,
                    });
                }
            });
        });
    }

    /**
     * Compute MD5 hash of content
     */
    private computeHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Clear compilation cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Invalidate cache for a specific file
     */
    invalidateCache(filePath: string): void {
        this.cache.delete(filePath);
    }
}
