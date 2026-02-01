/**
 * FastJudge Webview Provider
 * Provides the test case panel in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { TestCaseManager } from '../../storage/testcase-manager';
import { JudgeService } from '../../core/judge-service';
import { JudgeResult, TestCaseWithData, Verdict } from '../../types';
import { setDiffContent, createDiffUri } from './diff-provider';
import { getTimeLimitMs, getComparisonMode, getExecutionMode, detectLanguage, getSupportedExtensions } from '../../config/settings';

export class FastJudgeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'fastjudge.panel';

  private _view?: vscode.WebviewView;
  private _testCaseManager: TestCaseManager;
  private _judgeService: JudgeService;
  private _results: Map<string, JudgeResult> = new Map();
  // Per-file run state: tracks abort controller and running count per file
  private _fileRunState: Map<string, { controller: AbortController; count: number }> = new Map();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    testCaseManager: TestCaseManager,
    judgeService: JudgeService
  ) {
    this._testCaseManager = testCaseManager;
    this._judgeService = judgeService;
  }



  /**
   * Get or create run state for a file
   */
  private getOrCreateRunState(filePath: string) {
    if (!this._fileRunState.has(filePath)) {
      this._fileRunState.set(filePath, { controller: new AbortController(), count: 0 });
    }
    return this._fileRunState.get(filePath)!;
  }

  /**
   * Cleanup run state for a file when no tests are running
   */
  private cleanupRunState(filePath: string) {
    const state = this._fileRunState.get(filePath);
    if (state && state.count === 0) {
      this._fileRunState.delete(filePath);
    }
  }

  /**
   * Apply current settings to services before running tests
   */
  private applySettings(): void {
    this._judgeService.setComparisonMode(getComparisonMode());
    this._judgeService.setTimeLimit(getTimeLimitMs());
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      const filePath = vscode.window.activeTextEditor?.document.uri.fsPath;
      switch (data.type) {
        case 'runAll': {
          if (!filePath) { return; }
          const state = this._fileRunState.get(filePath);
          if (state && state.count > 0) {
            vscode.window.showInformationMessage('Tests are already running for this file.');
            return;
          }
          await this.runAllTests();
          break;
        }
        case 'runSingle':
          await this.runSingleTest(data.testCaseId);
          break;
        case 'addTestCase':
          await this.addTestCase(data.input, data.expected, data.name);
          break;
        case 'deleteTestCase':
          await this.deleteTestCase(data.testCaseId);
          break;
        case 'updateTestCase':
          await this.updateTestCase(data.testCaseId, data.input, data.expected, data.name);
          break;
        case 'openFile':
          if (data.filePath) {
            const uri = vscode.Uri.file(data.filePath);
            try {
              await vscode.window.showTextDocument(uri, { preview: true });
            } catch (error) {
              // File too large (>50MB) - offer to reveal in file explorer
              const action = await vscode.window.showWarningMessage(
                'File is too large to open in VS Code (>50MB). Would you like to open it in your system file explorer?',
                'Open in Explorer',
                'Cancel'
              );
              if (action === 'Open in Explorer') {
                vscode.commands.executeCommand('revealFileInOS', uri);
              }
            }
          }
          break;
        case 'viewDiff':
          await this.openDiffView(data.testCaseId);
          break;
        case 'refresh':
          await this.refresh();
          break;
        case 'stopAll': {
          if (!filePath) { return; }
          const state = this._fileRunState.get(filePath);
          if (!state || state.count === 0) {
            vscode.window.showInformationMessage('No tests are running for this file.');
            return;
          }
          // Abort current run for this file
          state.controller.abort();
          this._fileRunState.delete(filePath);
          // Update panel to show stopped state
          await this.refresh();
          break;
        }
        case 'deleteAll':
          await this.deleteAllTestCases();
          break;
      }
    });

    // Listen for active editor changes
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.refresh();
    });

    // Initial refresh
    this.refresh();
  }

  /**
   * Refresh the panel with current file's test cases
   */
  public async refresh(targetFilePath?: string): Promise<void> {
    if (!this._view) {
      return;
    }

    let filePath: string | undefined = targetFilePath;

    if (!filePath) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        // Only clear if we really don't have a target file and no active editor
        // But if we are just exploring, we might want to keep showing the last file?
        // For now, let's stick to current behavior: show no file
        this._postMessage({ type: 'noFile' });
        return;
      }
      filePath = activeEditor.document.uri.fsPath;
    }

    const testCases = await this._testCaseManager.getAllTestCasesWithData(filePath);

    // Load any persisted results that we don't have in memory
    const testCaseIds = testCases.map(tc => tc.id);
    const missingIds = testCaseIds.filter(id => !this._results.has(id));

    if (missingIds.length > 0) {
      const savedResults = await this._judgeService.loadSavedResults(missingIds);
      savedResults.forEach((result, id) => {
        this._results.set(id, result);
      });
    }

    // Merge with results (now includes persisted ones)
    const testCasesWithResults = testCases.map((tc) => ({
      ...tc,
      result: this._results.get(tc.id),
    }));

    this._postMessage({
      type: 'update',
      filePath: path.basename(filePath),
      testCases: testCasesWithResults,
    });
  }

  /**
   * Run all test cases for the active file
   */
  public async runAllTests(): Promise<void> {
    // Apply current settings before running
    this.applySettings();

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage('No active file');
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    const testCases = await this._testCaseManager.getAllTestCasesWithData(filePath);

    if (testCases.length === 0) {
      vscode.window.showInformationMessage('No test cases to run');
      return;
    }

    // Get or create run state for this file (abort any previous run)
    const existingState = this._fileRunState.get(filePath);
    if (existingState) {
      existingState.controller.abort();
    }
    const runState = this.getOrCreateRunState(filePath);
    // Reset controller for fresh run
    runState.controller = new AbortController();
    const signal = runState.controller.signal;

    // Run with progress indicator in sidebar
    await vscode.window.withProgress(
      {
        location: { viewId: FastJudgeViewProvider.viewType },
        title: 'Running tests...',
      },
      async () => {
        // Mark all as running
        for (const tc of testCases) {
          this._results.set(tc.id, {
            testCaseId: tc.id,
            verdict: 'RUNNING',
            executionTimeMs: 0,
            actualOutput: '',
            expectedOutput: tc.expected,
          });
        }
        runState.count = testCases.length;
        await this.refresh();

        // Compile first
        const compileResult = await this._judgeService.compile(filePath);
        if (!compileResult.success) {
          // Mark all as CE
          for (const tc of testCases) {
            this._results.set(tc.id, {
              testCaseId: tc.id,
              verdict: 'CE',
              executionTimeMs: 0,
              actualOutput: '',
              expectedOutput: tc.expected,
              errorMessage: compileResult.error,
            });
          }
          await this.refresh();
          vscode.window.showErrorMessage(`Compilation failed: ${compileResult.error}`);
          return;
        }

        // Get execution mode from settings
        const executionMode = getExecutionMode();

        const results: JudgeResult[] = [];

        if (executionMode === 'sequential') {
          // Sequential batch mode (old approach - update UI only at end)
          const batchResults = await this._judgeService.judgeAll(filePath, testCases, signal);
          for (const result of batchResults) {
            this._results.set(result.testCaseId, result);
            results.push(result);
          }
          runState.count = 0;
          this.cleanupRunState(filePath);
          await this.refresh();
        } else if (executionMode === 'parallel') {
          // Parallel execution with live updates
          const promises = testCases.map(async (tc) => {
            const result = await this._judgeService.judgeTestCase(
              compileResult.executablePath!,
              tc,
              undefined,
              signal
            );
            this._results.set(result.testCaseId, result);
            await this.refresh(); // Live update!
            return result;
          });
          results.push(...(await Promise.all(promises)));
          runState.count = 0;
          this.cleanupRunState(filePath);
          await this.refresh();
        } else {
          // Sequential-live (default) - run one at a time with live updates
          for (const tc of testCases) {
            const result = await this._judgeService.judgeTestCase(
              compileResult.executablePath!,
              tc,
              undefined,
              signal
            );

            this._results.set(result.testCaseId, result);
            results.push(result);
            await this.refresh(); // Live update!
          }
          runState.count = 0;
          this.cleanupRunState(filePath);
          await this.refresh();
        }
      }
    );
  }

  /**
   * Run a single test case
   */
  public async runSingleTest(testCaseId: string): Promise<void> {
    // Apply current settings before running
    this.applySettings();

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    const testCase = await this._testCaseManager.getTestCaseWithData(filePath, testCaseId);

    if (!testCase) {
      return;
    }

    // Get or create run state for this file
    const runState = this.getOrCreateRunState(filePath);
    const signal = runState.controller.signal;

    // Mark as running
    this._results.set(testCaseId, {
      testCaseId,
      verdict: 'RUNNING',
      executionTimeMs: 0,
      actualOutput: '',
      expectedOutput: testCase.expected,
    });
    runState.count++;
    await this.refresh();

    // Run test with signal
    const results = await this._judgeService.judgeAll(filePath, [testCase], signal);
    if (results.length > 0) {
      this._results.set(testCaseId, results[0]);
    }

    runState.count--;
    this.cleanupRunState(filePath);
    await this.refresh();
  }

  /**
   * Add a new test case
   */
  public async addTestCase(input: string, expected: string, name?: string): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage('No active file');
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;

    // Validate file extension
    if (!detectLanguage(filePath)) {
      const extensions = getSupportedExtensions()
        .map(ext => ext.replace('.', ''))
        .join(', ');
      vscode.window.showErrorMessage(`Unsupported file extension. Only these types are valid: ${extensions}`);
      return;
    }

    await this._testCaseManager.addTestCase(filePath, input, expected, name);
    await this.refresh();
  }

  /**
   * Delete a test case
   */
  public async deleteTestCase(testCaseId: string): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    await this._testCaseManager.deleteTestCase(filePath, testCaseId);
    this._results.delete(testCaseId);
    await this.refresh();
  }

  /**
   * Update a test case
   */
  public async updateTestCase(
    testCaseId: string,
    input: string,
    expected: string,
    name?: string
  ): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    await this._testCaseManager.updateTestCase(filePath, testCaseId, { input, expected, name });
    // Clear result since test case changed
    this._results.delete(testCaseId);
    await this.refresh();
  }

  /**
   * Delete all test cases with confirmation
   */
  private async deleteAllTestCases(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    const testCases = await this._testCaseManager.getAllTestCasesWithData(filePath);

    if (testCases.length === 0) {
      vscode.window.showInformationMessage('No test cases to delete');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete all ${testCases.length} test cases?`,
      { modal: true },
      'Delete All'
    );

    if (confirm === 'Delete All') {
      for (const tc of testCases) {
        await this._testCaseManager.deleteTestCase(filePath, tc.id);
        this._results.delete(tc.id);
      }
      await this.refresh();
    }
  }

  /**
   * Open VS Code diff view for a test case
   */
  public async openDiffView(testCaseId: string): Promise<void> {
    const result = this._results.get(testCaseId);
    if (!result || result.verdict === 'AC' || result.verdict === 'PENDING' || result.verdict === 'RUNNING') {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    const testCase = await this._testCaseManager.getTestCaseWithData(filePath, testCaseId);
    if (!testCase) {
      return;
    }

    setDiffContent(
      testCaseId,
      result.expectedOutput || testCase.expected,
      result.actualOutput || ''
    );

    const expectedUri = createDiffUri(testCaseId, 'expected');
    const receivedUri = createDiffUri(testCaseId, 'received');

    const testName = `TC ${testCaseId.slice(0, 8)}`;
    await vscode.commands.executeCommand(
      'vscode.diff',
      expectedUri,
      receivedUri,
      `${testName}: Expected ↔ Received`
    );
  }

  /**
   * Post message to webview
   */
  private _postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Get HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get path to bundled script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'webview.js')
    );

    // Get path to bundled CSS
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'webview.css')
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <title>FastJudge</title>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
