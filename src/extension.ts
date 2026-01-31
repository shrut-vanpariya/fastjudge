/**
 * FastJudge Extension Entry Point
 */

import * as vscode from 'vscode';
import { FastJudgeViewProvider } from './ui/webview/panel-provider';
import { DiffContentProvider, DIFF_SCHEME } from './ui/webview/diff-provider';

let panelProvider: FastJudgeViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext) {
	console.log('FastJudge is now active!');

	// Get workspace root
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		console.log('No workspace folder found');
		return;
	}

	// Register virtual document provider for diff view
	const diffProvider = new DiffContentProvider();
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, diffProvider)
	);

	// Create and register the webview provider
	panelProvider = new FastJudgeViewProvider(context.extensionUri, workspaceRoot);
	await panelProvider.initialize();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			FastJudgeViewProvider.viewType,
			panelProvider
		)
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
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('fastjudge')) {
				// Apply new configuration
				// (Could update time limits, comparison mode, etc.)
			}
		})
	);
}

export function deactivate() {
	console.log('FastJudge is deactivated');
}
