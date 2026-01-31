/**
 * FastJudge Webview Provider
 * Provides the test case panel in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { TestCaseManager } from '../../storage/testcase-manager';
import { JudgeService } from '../../core/judge-service';
import { JudgeResult, TestCaseWithData, Verdict } from '../../types';
import { getTimeLimitMs, getComparisonMode, getExecutionMode, detectLanguage, getSupportedExtensions } from '../../config/settings';

export class FastJudgeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'fastjudge.panel';

  private _view?: vscode.WebviewView;
  private _testCaseManager: TestCaseManager;
  private _judgeService: JudgeService;
  private _results: Map<string, JudgeResult> = new Map();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspaceRoot: string
  ) {
    this._testCaseManager = new TestCaseManager(_workspaceRoot);
    const outputDir = path.join(_workspaceRoot, '.fastjudge', 'out');
    this._judgeService = new JudgeService(outputDir, _workspaceRoot);
  }

  public async initialize(): Promise<void> {
    await this._testCaseManager.initialize();
    await this._judgeService.initialize();
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
      switch (data.type) {
        case 'runAll':
          await this.runAllTests();
          break;
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
  public async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      this._postMessage({ type: 'noFile' });
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
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
      const batchResults = await this._judgeService.judgeAll(filePath, testCases);
      for (const result of batchResults) {
        this._results.set(result.testCaseId, result);
        results.push(result);
      }
      await this.refresh();
    } else if (executionMode === 'parallel') {
      // Parallel execution with live updates
      const promises = testCases.map(async (tc) => {
        const result = await this._judgeService.judgeTestCase(
          compileResult.executablePath!,
          tc
        );
        this._results.set(result.testCaseId, result);
        await this.refresh(); // Live update!
        return result;
      });
      results.push(...(await Promise.all(promises)));
    } else {
      // Sequential-live (default) - run one at a time with live updates
      for (const tc of testCases) {
        const result = await this._judgeService.judgeTestCase(
          compileResult.executablePath!,
          tc
        );
        this._results.set(result.testCaseId, result);
        results.push(result);
        await this.refresh(); // Live update!
      }
    }

    // Pass count is now shown in the header via refresh()
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

    // Mark as running
    this._results.set(testCaseId, {
      testCaseId,
      verdict: 'RUNNING',
      executionTimeMs: 0,
      actualOutput: '',
      expectedOutput: testCase.expected,
    });
    await this.refresh();

    // Run test
    const results = await this._judgeService.judgeAll(filePath, [testCase]);
    if (results.length > 0) {
      this._results.set(testCaseId, results[0]);
    }

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

    // Use virtual document provider (no temp files!)
    const { setDiffContent, createDiffUri } = await import('./diff-provider.js');

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
