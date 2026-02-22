/**
 * FastJudge Language Registry
 * Manages dynamic language providers configured in settings.json
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageConfig, ILanguageProvider } from '../types';

/**
 * A generic language provider driven by configuration.
 */
export class CustomLanguageProvider implements ILanguageProvider {
    public id: string;
    public name: string;
    public extensions: string[];
    private compileArgs?: string[];
    private runArgs: string[];
    private outputExtension?: string;

    constructor(id: string, config: LanguageConfig) {
        this.id = id;
        this.name = config.name;
        this.extensions = config.extensions.map(e => e.toLowerCase());
        this.compileArgs = config.compileArgs;
        this.runArgs = config.runArgs;
        this.outputExtension = config.outputExtension;
    }

    getCompileCommand(sourcePath: string, outputDir: string): { command: string; args: string[] } | null {
        if (!this.compileArgs || this.compileArgs.length === 0) {
            return null;
        }

        const args = this.compileArgs.map(str => this.interpolateVariables(str, sourcePath, outputDir));
        const command = args.shift()!;

        return { command, args };
    }

    getRunCommand(sourcePath: string, outputDir: string): { command: string; args: string[] } {
        const args = this.runArgs.map(str => this.interpolateVariables(str, sourcePath, outputDir));
        const command = args.shift()!;

        return { command, args };
    }

    private interpolateVariables(str: string, sourcePath: string, outputDir: string): string {
        const className = path.parse(sourcePath).name;
        const binaryExt = process.platform === 'win32' ? '.exe' : '';
        const executableFile = path.join(outputDir, className + binaryExt);

        return str
            .replace(/\${sourceFile}/g, sourcePath)
            .replace(/\${outputDir}/g, outputDir)
            .replace(/\${executableFile}/g, executableFile)
            .replace(/\${className}/g, className);
    }
    /**
     * Get the compiled executable path for this language.
     * Returns undefined if the language is interpreted (no compileArgs).
     */
    getExecutablePath(sourcePath: string, outputDir: string): string | undefined {
        if (!this.compileArgs || this.compileArgs.length === 0) {
            return undefined;
        }
        const fileNameWithoutExt = path.parse(sourcePath).name;
        const ext = this.outputExtension ?? (process.platform === 'win32' ? '.exe' : '');
        return path.join(outputDir, fileNameWithoutExt + ext);
    }
}

export class LanguageRegistry {
    private providers: Map<string, ILanguageProvider> = new Map();

    /**
     * Load languages from VS Code settings
     */
    public loadFromConfiguration(): void {
        this.providers.clear();
        const config = vscode.workspace.getConfiguration('fastjudge');
        const languages = config.get<Record<string, LanguageConfig>>('languages') || {};
        const seenExtensions = new Map<string, string>(); // extension -> language id

        for (const [id, langConfig] of Object.entries(languages)) {
            if (!langConfig.name || !langConfig.extensions || !langConfig.runArgs || langConfig.runArgs.length === 0) {
                console.warn(`FastJudge: Invalid language configuration for '${id}'`);
                continue;
            }

            // Warn on duplicate extensions
            for (const ext of langConfig.extensions) {
                const normalized = ext.toLowerCase();
                const existing = seenExtensions.get(normalized);
                if (existing) {
                    console.warn(`FastJudge: Extension '${ext}' is claimed by both '${existing}' and '${id}'`);
                }
                seenExtensions.set(normalized, id);
            }

            this.providers.set(id, new CustomLanguageProvider(id, langConfig));
        }
    }

    /**
     * Get provider by exact language ID
     */
    public getProvider(id: string): ILanguageProvider | undefined {
        return this.providers.get(id);
    }

    /**
     * Detect provider from file path based on extensions
     */
    public detectProvider(filePath: string): ILanguageProvider | undefined {
        const ext = path.extname(filePath).toLowerCase();
        for (const provider of this.providers.values()) {
            if (provider.extensions.includes(ext)) {
                return provider;
            }
        }
        return undefined;
    }

    /**
     * Get all registered providers
     */
    public getAllProviders(): ILanguageProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Check if an extension is supported by any provider
     */
    public isExtensionSupported(ext: string): boolean {
        // Ensure ext starts with dot
        const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
        for (const provider of this.providers.values()) {
            if (provider.extensions.includes(normalizedExt)) {
                return true;
            }
        }
        return false;
    }
}

// Export a singleton instance
export const languageRegistry = new LanguageRegistry();
