/**
 * FastJudge Extension Entry Point
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FastJudgeViewProvider } from './ui/webview/panel-provider';
import { DiffContentProvider, DIFF_SCHEME } from './ui/webview/diff-provider';
import { CompanionManager } from './companion/companion-manager';
import { TestCaseManager } from './storage/testcase-manager';
import { JudgeService } from './core/judge-service';
import { languageRegistry } from './core/language-registry';

let panelProvider: FastJudgeViewProvider | undefined;
let companionManager: CompanionManager | undefined;
let testCaseManager: TestCaseManager | undefined;
let judgeService: JudgeService | undefined;

export async function activate(context: vscode.ExtensionContext) {
	console.log('FastJudge is now active!');

	// Get workspace root
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		console.log('No workspace folder found');
		return;
	}

	// Load language configuration
	languageRegistry.loadFromConfiguration();

	// Register virtual document provider for diff view
	const diffProvider = new DiffContentProvider();
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, diffProvider)
	);

	// Initialize TestCaseManager
	testCaseManager = new TestCaseManager(workspaceRoot);
	await testCaseManager.initialize();

	// Initialize Judge Service
	const outputDir = path.join(workspaceRoot, '.fastjudge', 'out');
	judgeService = new JudgeService(outputDir, workspaceRoot);
	await judgeService.initialize();

	// Create and register the webview provider
	// Pass the shared instances
	panelProvider = new FastJudgeViewProvider(context.extensionUri, testCaseManager!, judgeService!);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			FastJudgeViewProvider.viewType,
			panelProvider
		)
	);

	// Competitive Companion Integration
	companionManager = new CompanionManager(testCaseManager!);

	// Refresh panel when test cases are imported
	companionManager.onTestCasesAdded((filePath) => {
		if (panelProvider) {
			panelProvider.refresh(filePath);
			// Auto-open the panel
			vscode.commands.executeCommand('fastjudge.openPanel');
		}
	});

	await companionManager.initialize();
	context.subscriptions.push({ dispose: () => companionManager?.dispose() });

	// Register companion toggle command
	context.subscriptions.push(
		vscode.commands.registerCommand('fastjudge.companion.toggle', () => {
			companionManager?.toggle();
		})
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('fastjudge.openPanel', () => {
			vscode.commands.executeCommand('workbench.view.extension.fastjudge');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fastjudge.runAll', async () => {
			// Save reference to active editor before opening panel
			const activeEditor = vscode.window.activeTextEditor;
			// Open panel and run all tests
			vscode.commands.executeCommand('workbench.view.extension.fastjudge');
			if (panelProvider) {
				await panelProvider.runAllTests();
			}
			// Refocus editor
			if (activeEditor) {
				vscode.window.showTextDocument(activeEditor.document, activeEditor.viewColumn, false);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fastjudge.addTestCase', async () => {
			// Save reference to active editor before opening panel
			const activeEditor = vscode.window.activeTextEditor;
			// Open panel and create empty test case directly
			vscode.commands.executeCommand('workbench.view.extension.fastjudge');
			if (panelProvider) {
				await panelProvider.addTestCase('', '');
			}
			// Refocus editor
			if (activeEditor) {
				vscode.window.showTextDocument(activeEditor.document, activeEditor.viewColumn, false);
			}
		})
	);

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('fastjudge.companion')) {
				await companionManager?.restart();
			}
			if (e.affectsConfiguration('fastjudge.languages')) {
				languageRegistry.loadFromConfiguration();
			}
		})
	);
}

export function deactivate() {
	console.log('FastJudge is deactivated');
}
