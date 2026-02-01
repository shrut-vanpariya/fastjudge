/**
 * Competitive Companion Manager
 * Manages the companion server lifecycle and status bar
 */

import * as vscode from 'vscode';
import { CompanionServer } from './companion-server';
import { CompanionService } from './companion-service';
import { TestCaseManager } from '../storage/testcase-manager';
import { isCompanionEnabled, getCompanionPort } from '../config/settings';

export class CompanionManager {
    private server: CompanionServer | null = null;
    private service: CompanionService;
    private statusBarItem: vscode.StatusBarItem;

    constructor(testCaseManager: TestCaseManager) {
        this.service = new CompanionService(testCaseManager);
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'fastjudge.companion.toggle';
    }

    /**
     * Register callback for when test cases are added
     */
    onTestCasesAdded(callback: (filePath: string) => void): void {
        this.service.onTestCasesAdded(callback);
    }

    /**
     * Initialize and start if enabled
     */
    async initialize(): Promise<void> {
        if (isCompanionEnabled()) {
            await this.start();
        } else {
            this.updateStatusBar(false);
        }
        this.statusBarItem.show();
    }

    /**
     * Start the companion server
     */
    async start(): Promise<void> {
        const port = getCompanionPort();

        this.server = new CompanionServer(port);
        this.server.onProblem((problem) => {
            this.service.handleProblem(problem);
        });

        try {
            await this.server.start();
            this.updateStatusBar(true);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Companion server error: ${error.message}`);
            this.updateStatusBar(false);
        }
    }

    /**
     * Stop the companion server
     */
    async stop(): Promise<void> {
        if (this.server) {
            await this.server.stop();
            this.server = null;
        }
        this.updateStatusBar(false);
    }

    /**
     * Toggle server on/off
     */
    async toggle(): Promise<void> {
        if (this.isRunning()) {
            await this.stop();
            vscode.window.showInformationMessage('Companion server stopped');
        } else {
            await this.start();
            if (this.isRunning()) {
                vscode.window.showInformationMessage('Companion server started');
            }
        }
    }

    /**
     * Restart server (for settings changes)
     */
    async restart(): Promise<void> {
        await this.stop();
        if (isCompanionEnabled()) {
            await this.start();
        }
    }

    /**
     * Check if server is running
     */
    isRunning(): boolean {
        return this.server?.isRunning() ?? false;
    }

    /**
     * Update status bar appearance
     */
    private updateStatusBar(running: boolean): void {
        const port = getCompanionPort();

        if (running) {
            this.statusBarItem.text = `$(radio-tower) CC:${port}`;
            this.statusBarItem.tooltip = `Competitive Companion listening on port ${port}`;
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = `$(circle-slash) CC:OFF`;
            this.statusBarItem.tooltip = 'Competitive Companion server disabled';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
        if (this.server) {
            this.server.stop();
        }
    }
}
