/**
 * FastJudge Language Configurations
 * Default compiler/interpreter settings for supported languages
 */

import { Language, LanguageConfig } from '../types';

/** Default language configurations */
export const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
    cpp: {
        name: 'C++',
        extension: '.cpp',
        compile: {
            command: 'g++',
            args: ['-O2', '-std=c++17', '-Wall'],
            outputFlag: '-o',
        },
        run: {
            command: '{executable}',  // Will be replaced with actual path
            args: [],
        },
    },

    python: {
        name: 'Python',
        extension: '.py',
        // No compilation needed
        run: {
            command: 'python',
            args: ['{source}'],
        },
    },

    java: {
        name: 'Java',
        extension: '.java',
        compile: {
            command: 'javac',
            args: [],
            outputFlag: '-d',  // Output directory
        },
        run: {
            command: 'java',
            args: ['-cp', '{outputDir}', '{className}'],
        },
    },

    javascript: {
        name: 'JavaScript',
        extension: '.js',
        // No compilation needed
        run: {
            command: 'node',
            args: ['{source}'],
        },
    },
};

/** Map file extensions to languages */
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
 * Detect language from file path
 */
export function detectLanguage(filePath: string): Language | null {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || null;
}

/**
 * Get language configuration
 */
export function getLanguageConfig(language: Language): LanguageConfig {
    return LANGUAGE_CONFIGS[language];
}

/**
 * Check if language requires compilation
 */
export function requiresCompilation(language: Language): boolean {
    return LANGUAGE_CONFIGS[language].compile !== undefined;
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_TO_LANGUAGE);
}
