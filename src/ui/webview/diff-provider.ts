/**
 * Virtual Document Provider for Diff View
 * Provides in-memory content for expected/received output comparison
 */

import * as vscode from 'vscode';

export const DIFF_SCHEME = 'fastjudge-diff';

interface DiffContent {
    expected: string;
    received: string;
}

// Store diff content by test case ID
const diffContents = new Map<string, DiffContent>();

/**
 * TextDocumentContentProvider for virtual diff documents
 */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        // URI format: fastjudge-diff:/testCaseId/expected or /received
        const parts = uri.path.split('/');
        const testCaseId = parts[1];
        const type = parts[2]; // 'expected' or 'received'

        const content = diffContents.get(testCaseId);
        if (!content) {
            return '';
        }

        return type === 'expected' ? content.expected : content.received;
    }

    /**
     * Refresh the content for a specific URI
     */
    refresh(uri: vscode.Uri): void {
        this._onDidChange.fire(uri);
    }
}

/**
 * Set diff content for a test case
 */
export function setDiffContent(testCaseId: string, expected: string, received: string): void {
    diffContents.set(testCaseId, { expected, received });
}

/**
 * Clear diff content for a test case
 */
export function clearDiffContent(testCaseId: string): void {
    diffContents.delete(testCaseId);
}

/**
 * Create URI for diff document
 */
export function createDiffUri(testCaseId: string, type: 'expected' | 'received'): vscode.Uri {
    return vscode.Uri.parse(`${DIFF_SCHEME}:/${testCaseId}/${type}`);
}
