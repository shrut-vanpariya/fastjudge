/**
 * Competitive Companion Service
 * Handles problem import with interactive dialogs
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CompanionProblem } from '../types/companion';
import { TestCaseManager } from '../storage/testcase-manager';
import { getCompanionDefaultLanguage } from '../config/settings';

/** Language to file extension mapping */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
    'C++': 'cpp',
    'Python': 'py',
    'Java': 'java',
    'JavaScript': 'js',
};

export type OnTestCasesAddedCallback = (filePath: string) => void;

export class CompanionService {
    private onTestCasesAddedCallback: OnTestCasesAddedCallback | null = null;

    constructor(private testCaseManager: TestCaseManager) { }

    /**
     * Set callback for when test cases are added
     */
    onTestCasesAdded(callback: OnTestCasesAddedCallback): void {
        this.onTestCasesAddedCallback = callback;
    }

    /**
     * Handle a problem received from Competitive Companion
     */
    async handleProblem(problem: CompanionProblem): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a folder first.');
            return;
        }

        let targetFilePath: string;

        if (activeEditor) {
            // Editor is open - ask user what to do
            const choice = await vscode.window.showQuickPick(
                [
                    { label: '$(add) Add to current file', value: 'current' },
                    { label: '$(new-file) Create new file', value: 'new' },
                    { label: '$(close) Cancel', value: 'cancel' },
                ],
                {
                    placeHolder: `Received: ${problem.name} (${problem.tests.length} tests)`,
                }
            );

            if (!choice || choice.value === 'cancel') {
                return;
            }

            if (choice.value === 'current') {
                targetFilePath = activeEditor.document.uri.fsPath;
            } else {
                // Create new file
                const filePath = await this.createNewFile(problem, workspaceFolder.uri.fsPath);
                if (!filePath) {
                    return;
                }
                targetFilePath = filePath;
            }
        } else {
            // No editor open - create new file
            const filePath = await this.createNewFile(problem, workspaceFolder.uri.fsPath);
            if (!filePath) {
                return;
            }
            targetFilePath = filePath;
        }

        // Add test cases
        await this.addTestCases(targetFilePath, problem);

        // Trigger refresh callback
        if (this.onTestCasesAddedCallback) {
            this.onTestCasesAddedCallback(targetFilePath);
        }

        // Show notification
        vscode.window.showInformationMessage(
            `Added ${problem.tests.length} test cases from "${problem.name}"`
        );
    }

    /**
     * Create a new file for the problem
     */
    private async createNewFile(problem: CompanionProblem, workspaceRoot: string): Promise<string | null> {
        // Check for default language setting
        const defaultLanguage = getCompanionDefaultLanguage();

        let extension: string;

        if (defaultLanguage && LANGUAGE_EXTENSIONS[defaultLanguage]) {
            extension = LANGUAGE_EXTENSIONS[defaultLanguage];
        } else {
            // Show language picker
            const selected = await vscode.window.showQuickPick(
                Object.keys(LANGUAGE_EXTENSIONS),
                {
                    placeHolder: 'Select language for the new file',
                }
            );

            if (!selected) {
                vscode.window.showInformationMessage('File creation cancelled.');
                return null;
            }

            extension = LANGUAGE_EXTENSIONS[selected];
        }

        // Generate filename from problem name
        const fileName = this.generateFileName(problem.name, extension);
        const filePath = path.join(workspaceRoot, fileName);

        // Check if file exists
        try {
            await fs.access(filePath);
            // File exists - ask to overwrite or use different name
            const choice = await vscode.window.showQuickPick(
                [
                    { label: '$(file) Use existing file', value: 'use' },
                    { label: '$(edit) Enter custom name', value: 'custom' },
                    { label: '$(close) Cancel', value: 'cancel' },
                ],
                {
                    placeHolder: `File "${fileName}" already exists`,
                }
            );

            if (!choice || choice.value === 'cancel') {
                return null;
            }

            if (choice.value === 'custom') {
                const customName = await vscode.window.showInputBox({
                    prompt: 'Enter file name',
                    value: fileName,
                    validateInput: (value) => {
                        if (!value.trim()) {
                            return 'File name cannot be empty';
                        }
                        return null;
                    },
                });

                if (!customName) {
                    return null;
                }

                const customPath = path.join(workspaceRoot, customName);
                await fs.writeFile(customPath, '', 'utf-8');
                await this.openFile(customPath);
                return customPath;
            }

            // Use existing file
            await this.openFile(filePath);
            return filePath;
        } catch {
            // File doesn't exist - create it
            await fs.writeFile(filePath, '', 'utf-8');
            await this.openFile(filePath);
            return filePath;
        }
    }

    /**
     * Generate a safe filename from problem name
     */
    private generateFileName(problemName: string, extension: string): string {
        // Extract problem letter/number if present (e.g., "A. Watermelon" -> "A_Watermelon")
        // Remove special characters, replace spaces with underscores
        const safeName = problemName
            .replace(/[^a-zA-Z0-9\s_-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50); // Limit length

        return `${safeName}.${extension}`;
    }

    /**
     * Open file in editor
     */
    private async openFile(filePath: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    }

    /**
     * Add test cases from problem to file
     */
    private async addTestCases(filePath: string, problem: CompanionProblem): Promise<void> {
        for (const test of problem.tests) {
            await this.testCaseManager.addTestCase(
                filePath,
                test.input,
                test.output
            );
        }
    }
}
