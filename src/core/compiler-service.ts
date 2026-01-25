/**
 * FastJudge Compiler Service
 * Handles code compilation with smart caching
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { CompileResult, CacheEntry, ICompilationCache, Language } from '../types';
import { LanguageService, languageService } from './language-service';

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
    private langService: LanguageService;
    private outputDir: string;
    private cache: ICompilationCache;

    constructor(
        outputDir: string,
        cache?: ICompilationCache,
        langService?: LanguageService
    ) {
        this.outputDir = outputDir;
        this.cache = cache || new MemoryCache();
        this.langService = langService || languageService;
    }

    /**
     * Compile source file and return executable path
     * Uses caching to skip compilation if source hasn't changed
     */
    async compile(sourcePath: string): Promise<CompileResult> {
        const startTime = Date.now();

        // Detect language
        const language = this.langService.detectLanguage(sourcePath);
        if (!language) {
            return {
                success: false,
                error: `Unsupported file type: ${path.extname(sourcePath)}`,
                compilationTimeMs: Date.now() - startTime,
            };
        }

        // For interpreted languages, no compilation needed
        if (!this.langService.requiresCompilation(language)) {
            return {
                success: true,
                executablePath: sourcePath,  // The source file itself
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
            // Verify executable still exists
            try {
                await fs.access(cached.executablePath);
                return {
                    success: true,
                    executablePath: cached.executablePath,
                    compilationTimeMs: Date.now() - startTime,
                    cached: true,
                };
            } catch {
                // Executable deleted, need to recompile
                this.cache.delete(sourcePath);
            }
        }

        // Compile
        const executablePath = this.langService.getExecutablePath(sourcePath, this.outputDir);

        // Ensure output directory exists
        await fs.mkdir(this.outputDir, { recursive: true });

        const result = await this.runCompiler(sourcePath, executablePath, language);

        if (result.success) {
            // Update cache
            this.cache.set(sourcePath, {
                contentHash: hash,
                executablePath: result.executablePath!,
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
        executablePath: string,
        language: Language
    ): Promise<CompileResult> {
        const config = this.langService.getConfig(language);

        if (!config.compile) {
            return {
                success: false,
                error: `No compile configuration for ${language}`,
                compilationTimeMs: 0,
            };
        }

        const { command, args, outputFlag } = config.compile;

        // Build command arguments
        const cmdArgs = [
            ...args,
            sourcePath,
            outputFlag,
            executablePath,
        ];

        return new Promise((resolve) => {
            const proc = spawn(command, cmdArgs, {
                cwd: path.dirname(sourcePath),
                shell: true,
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
                        executablePath,
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
