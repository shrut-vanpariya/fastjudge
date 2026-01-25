/**
 * FastJudge Settings Service
 * Reads all configuration from VS Code settings (no hardcoded values)
 */

import * as vscode from 'vscode';
import { Language, LanguageConfig, ExecutionMode, ComparisonMode } from '../types';

// Extension to Language mapping (this is metadata, not settings)
export const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c++': 'cpp',
    '.py': 'python',
    '.java': 'java',
    '.js': 'javascript',
};

/**
 * Get FastJudge configuration
 */
function getConfig() {
    return vscode.workspace.getConfiguration('fastjudge');
}

/**
 * General settings
 */
export function getTimeLimitMs(): number {
    return getConfig().get<number>('general.timeLimitMs', 2000);
}

export function getComparisonMode(): ComparisonMode {
    return getConfig().get<ComparisonMode>('general.comparisonMode', 'trim');
}

export function getExecutionMode(): ExecutionMode {
    return getConfig().get<ExecutionMode>('general.executionMode', 'sequential-live');
}

export function getResultRetentionDays(): number {
    return getConfig().get<number>('general.resultRetentionDays', 7);
}

/**
 * Get language configuration from VS Code settings
 * All values are read dynamically - no hardcoding!
 */
export function getLanguageConfig(language: Language): LanguageConfig {
    const config = getConfig();

    switch (language) {
        case 'cpp':
            return {
                name: 'C++',
                extension: '.cpp',
                compile: {
                    command: config.get<string>('language.cpp.command', 'g++'),
                    args: config.get<string[]>('language.cpp.args', ['-O2', '-std=c++17', '-Wall']),
                    outputFlag: '-o',
                },
                run: {
                    command: '{executable}',
                    args: [],
                },
            };

        case 'python':
            return {
                name: 'Python',
                extension: '.py',
                run: {
                    command: config.get<string>('language.python.command', 'python'),
                    args: ['{source}'],
                },
            };

        case 'java':
            return {
                name: 'Java',
                extension: '.java',
                compile: {
                    command: config.get<string>('language.java.command', 'javac'),
                    args: [],
                    outputFlag: '-d',
                },
                run: {
                    command: config.get<string>('language.java.runCommand', 'java'),
                    args: ['-cp', '{outputDir}', '{className}'],
                },
            };

        case 'javascript':
            return {
                name: 'JavaScript',
                extension: '.js',
                run: {
                    command: config.get<string>('language.javascript.command', 'node'),
                    args: ['{source}'],
                },
            };

        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}

/**
 * Detect language from file path
 */
export function detectLanguage(filePath: string): Language | null {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || null;
}

/**
 * Check if language requires compilation
 */
export function requiresCompilation(language: Language): boolean {
    const config = getLanguageConfig(language);
    return config.compile !== undefined;
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_TO_LANGUAGE);
}

/**
 * Get all settings as a snapshot (for debugging/logging)
 */
export function getAllSettings() {
    const config = getConfig();
    return {
        timeLimitMs: config.get<number>('general.timeLimitMs', 2000),
        comparisonMode: config.get<string>('general.comparisonMode', 'trim'),
        executionMode: config.get<string>('general.executionMode', 'sequential-live'),
        resultRetentionDays: config.get<number>('general.resultRetentionDays', 7),
        cpp: {
            command: config.get<string>('language.cpp.command', 'g++'),
            args: config.get<string[]>('language.cpp.args', ['-O2', '-std=c++17', '-Wall']),
        },
        python: {
            command: config.get<string>('language.python.command', 'python'),
        },
        java: {
            command: config.get<string>('language.java.command', 'javac'),
            runCommand: config.get<string>('language.java.runCommand', 'java'),
        },
        javascript: {
            command: config.get<string>('language.javascript.command', 'node'),
        },
    };
}
