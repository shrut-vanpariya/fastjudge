/**
 * FastJudge Settings Service
 * Reads all configuration from VS Code settings (no hardcoded values)
 */

import * as vscode from 'vscode';
import { Language, LanguageConfig, ExecutionMode, ComparisonMode } from '../types';


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
 * Companion settings
 */
export function isCompanionEnabled(): boolean {
    return getConfig().get<boolean>('companion.enabled', true);
}

export function getCompanionPort(): number {
    return getConfig().get<number>('companion.port', 27121);
}

export function getCompanionDefaultLanguage(): string {
    return getConfig().get<string>('companion.defaultLanguage', '');
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
        languages: config.get('languages', {}),
    };
}
