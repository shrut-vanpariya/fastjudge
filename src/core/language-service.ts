/**
 * FastJudge Language Service
 * Handles language detection and configuration
 */

import * as path from 'path';
import { Language, LanguageConfig } from '../types';
import {
    LANGUAGE_CONFIGS,
    EXTENSION_TO_LANGUAGE,
    detectLanguage as detectLang,
    getLanguageConfig as getLangConfig,
    requiresCompilation,
    getSupportedExtensions
} from '../config/languages';

export class LanguageService {
    /**
     * Detect language from file path
     */
    detectLanguage(filePath: string): Language | null {
        return detectLang(filePath);
    }

    /**
     * Get configuration for a language
     */
    getConfig(language: Language): LanguageConfig {
        return getLangConfig(language);
    }

    /**
     * Check if a language requires compilation
     */
    requiresCompilation(language: Language): boolean {
        return requiresCompilation(language);
    }

    /**
     * Get all supported file extensions
     */
    getSupportedExtensions(): string[] {
        return getSupportedExtensions();
    }

    /**
     * Check if a file is supported
     */
    isSupported(filePath: string): boolean {
        return this.detectLanguage(filePath) !== null;
    }

    /**
     * Get executable path for compiled languages
     */
    getExecutablePath(sourcePath: string, outputDir: string): string {
        const baseName = path.basename(sourcePath, path.extname(sourcePath));
        const isWindows = process.platform === 'win32';
        const ext = isWindows ? '.exe' : '';
        return path.join(outputDir, `${baseName}${ext}`);
    }

    /**
     * Get class name for Java files
     */
    getJavaClassName(sourcePath: string): string {
        return path.basename(sourcePath, '.java');
    }
}

// Export singleton instance
export const languageService = new LanguageService();
