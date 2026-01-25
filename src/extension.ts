/**
 * FastJudge Extension Entry Point
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FastJudgeViewProvider } from './ui/webview/panel-provider';

let panelProvider: FastJudgeViewProvider | undefined;

export async function activate(context: vscode.ExtensionContext) {
	console.log('FastJudge is now active!');

	// Get workspace root
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		console.log('No workspace folder found');
		return;
	}

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
			if (panelProvider) {
				await panelProvider.runAllTests();
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('fastjudge.addTestCase', async () => {
			// Quick input for adding test case via command
			const input = await vscode.window.showInputBox({
				prompt: 'Enter test input (or press Enter to open panel)',
				placeHolder: 'Test input...',
			});

			if (input === undefined) {
				return; // Cancelled
			}

			if (input === '') {
				// Open panel for full form
				vscode.commands.executeCommand('workbench.view.extension.fastjudge');
				return;
			}

			const expected = await vscode.window.showInputBox({
				prompt: 'Enter expected output',
				placeHolder: 'Expected output...',
			});

			if (expected === undefined) {
				return; // Cancelled
			}

			if (panelProvider) {
				await panelProvider.addTestCase(input, expected);
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
