/**
 * FastJudge Webview Provider
 * Provides the test case panel in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { TestCaseManager } from '../../storage/testcase-manager';
import { JudgeService } from '../../core/judge-service';
import { JudgeResult, TestCaseWithData, Verdict } from '../../types';

export class FastJudgeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'fastjudge.panel';

    private _view?: vscode.WebviewView;
    private _testCaseManager: TestCaseManager;
    private _judgeService: JudgeService;
    private _results: Map<string, JudgeResult> = new Map();

    constructor(
        private readonly _extensionUri: vscode.Uri,
        workspaceRoot: string
    ) {
        this._testCaseManager = new TestCaseManager(workspaceRoot);
        const outputDir = path.join(workspaceRoot, '.fastjudge', 'out');
        this._judgeService = new JudgeService(outputDir);
    }

    public async initialize(): Promise<void> {
        await this._testCaseManager.initialize();
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

        // Merge with existing results
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

        // Run all tests
        const results = await this._judgeService.judgeAll(filePath, testCases);

        // Store results
        for (const result of results) {
            this._results.set(result.testCaseId, result);
        }

        await this.refresh();

        // Show summary
        const passed = results.filter((r) => r.verdict === 'AC').length;
        const total = results.length;
        const message = passed === total
            ? `✅ All ${total} tests passed!`
            : `❌ ${passed}/${total} tests passed`;
        vscode.window.showInformationMessage(message);
    }

    /**
     * Run a single test case
     */
    public async runSingleTest(testCaseId: string): Promise<void> {
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
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FastJudge</title>
  <style>
    :root {
      --vscode-font-family: var(--vscode-editor-font-family, monospace);
    }
    body {
      font-family: var(--vscode-font-family);
      padding: 10px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .toolbar {
      display: flex;
      gap: 8px;
    }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
    }
    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .test-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--vscode-list-hoverBackground);
      cursor: pointer;
    }
    .test-header:hover {
      background: var(--vscode-list-activeSelectionBackground);
    }
    .test-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .verdict {
      font-size: 14px;
    }
    .verdict-ac { color: #4caf50; }
    .verdict-wa { color: #f44336; }
    .verdict-tle { color: #ff9800; }
    .verdict-re { color: #9c27b0; }
    .verdict-ce { color: #795548; }
    .verdict-pending { color: var(--vscode-foreground); opacity: 0.6; }
    .verdict-running { color: #2196f3; }
    .time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .test-content {
      padding: 12px;
      display: none;
    }
    .test-content.expanded {
      display: block;
    }
    .section {
      margin-bottom: 12px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .code-box {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      padding: 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 150px;
      overflow-y: auto;
    }
    .code-box.match {
      border-color: #4caf50;
      background: rgba(76, 175, 80, 0.1);
    }
    .code-box.diff {
      border-color: #f44336;
      background: rgba(244, 67, 54, 0.1);
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .add-form {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 15px;
      background: var(--vscode-editor-background);
    }
    .form-group {
      margin-bottom: 10px;
    }
    .form-group label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .form-group input,
    .form-group textarea {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 6px 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      box-sizing: border-box;
    }
    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }
    .no-tests {
      text-align: center;
      padding: 30px;
      color: var(--vscode-descriptionForeground);
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <h2 id="fileName">FastJudge</h2>
    <div class="toolbar">
      <button class="btn" onclick="runAll()" title="Run All Tests">▶ Run All</button>
      <button class="btn btn-secondary" onclick="showAddForm()" title="Add Test Case">+ Add</button>
    </div>
  </div>

  <div id="addForm" class="add-form hidden">
    <div class="form-group">
      <label>Name (optional)</label>
      <input type="text" id="newName" placeholder="Test 1">
    </div>
    <div class="form-group">
      <label>Input</label>
      <textarea id="newInput" placeholder="Enter input..."></textarea>
    </div>
    <div class="form-group">
      <label>Expected Output</label>
      <textarea id="newExpected" placeholder="Enter expected output..."></textarea>
    </div>
    <div class="actions">
      <button class="btn" onclick="saveTestCase()">Save</button>
      <button class="btn btn-secondary" onclick="hideAddForm()">Cancel</button>
    </div>
  </div>

  <div id="testCases"></div>

  <script>
    const vscode = acquireVsCodeApi();
    let testCases = [];
    let expandedIds = new Set();

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          document.getElementById('fileName').textContent = message.filePath;
          testCases = message.testCases;
          renderTestCases();
          break;
        case 'noFile':
          document.getElementById('fileName').textContent = 'No file open';
          testCases = [];
          renderTestCases();
          break;
      }
    });

    function renderTestCases() {
      const container = document.getElementById('testCases');
      if (testCases.length === 0) {
        container.innerHTML = '<div class="no-tests">No test cases yet.<br>Click "+ Add" to create one.</div>';
        return;
      }

      container.innerHTML = testCases.map((tc, index) => {
        const result = tc.result;
        const verdict = result ? result.verdict : 'PENDING';
        const time = result && result.executionTimeMs > 0 ? result.executionTimeMs + 'ms' : '';
        const isExpanded = expandedIds.has(tc.id);
        const name = tc.name || 'Test ' + (index + 1);
        
        return \`
          <div class="test-card">
            <div class="test-header" onclick="toggleExpand('\${tc.id}')">
              <span class="test-title">
                <span class="verdict verdict-\${verdict.toLowerCase()}">\${getVerdictIcon(verdict)}</span>
                <span>\${name}</span>
              </span>
              <span class="time">\${time}</span>
            </div>
            <div class="test-content \${isExpanded ? 'expanded' : ''}" id="content-\${tc.id}">
              <div class="section">
                <div class="section-label">Input</div>
                <div class="code-box">\${escapeHtml(tc.input || '')}</div>
              </div>
              <div class="section">
                <div class="section-label">Expected Output</div>
                <div class="code-box \${result && result.verdict === 'AC' ? 'match' : ''}">\${escapeHtml(tc.expected || '')}</div>
              </div>
              \${result && result.actualOutput !== undefined ? \`
                <div class="section">
                  <div class="section-label">Received Output</div>
                  <div class="code-box \${result.verdict === 'AC' ? 'match' : 'diff'}">\${escapeHtml(result.actualOutput)}</div>
                </div>
              \` : ''}
              <div class="actions">
                <button class="btn" onclick="runSingle('\${tc.id}')">▶ Run</button>
                <button class="btn btn-secondary" onclick="deleteTestCase('\${tc.id}')">Delete</button>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function getVerdictIcon(verdict) {
      switch (verdict) {
        case 'AC': return '✅';
        case 'WA': return '❌';
        case 'TLE': return '⏱️';
        case 'RE': return '💥';
        case 'CE': return '🔨';
        case 'RUNNING': return '⏳';
        default: return '⚪';
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function toggleExpand(id) {
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
      } else {
        expandedIds.add(id);
      }
      renderTestCases();
    }

    function runAll() {
      vscode.postMessage({ type: 'runAll' });
    }

    function runSingle(testCaseId) {
      vscode.postMessage({ type: 'runSingle', testCaseId });
    }

    function deleteTestCase(testCaseId) {
      vscode.postMessage({ type: 'deleteTestCase', testCaseId });
    }

    function showAddForm() {
      document.getElementById('addForm').classList.remove('hidden');
      document.getElementById('newName').value = '';
      document.getElementById('newInput').value = '';
      document.getElementById('newExpected').value = '';
    }

    function hideAddForm() {
      document.getElementById('addForm').classList.add('hidden');
    }

    function saveTestCase() {
      const name = document.getElementById('newName').value.trim();
      const input = document.getElementById('newInput').value;
      const expected = document.getElementById('newExpected').value;

      vscode.postMessage({
        type: 'addTestCase',
        name: name || undefined,
        input,
        expected
      });

      hideAddForm();
    }

    // Request initial data
    vscode.postMessage({ type: 'refresh' });
  </script>
</body>
</html>`;
    }
}
