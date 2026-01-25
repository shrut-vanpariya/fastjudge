import * as assert from 'assert';
import { JudgeService, ComparisonMode } from '../core/judge-service';
import { ExecutorService } from '../core/executor-service';
import { ExecutionResult, TestCaseWithData } from '../types';

/**
 * Mock ExecutorService for testing judge logic without actual execution
 */
class MockExecutorService extends ExecutorService {
    private mockResult: ExecutionResult;

    constructor() {
        super(2000);
        this.mockResult = {
            stdout: '',
            stderr: '',
            exitCode: 0,
            executionTimeMs: 100,
            timedOut: false,
        };
    }

    setMockResult(result: Partial<ExecutionResult>): void {
        this.mockResult = { ...this.mockResult, ...result };
    }

    override async execute(): Promise<ExecutionResult> {
        return this.mockResult;
    }
}

suite('JudgeService Test Suite', () => {
    let judge: JudgeService;
    let mockExecutor: MockExecutorService;

    const createTestCase = (id: string, input: string, expected: string): TestCaseWithData => ({
        id,
        name: `Test ${id}`,
        createdAt: Date.now(),
        input,
        expected,
    });

    setup(() => {
        mockExecutor = new MockExecutorService();
        // Use temp directory for test results
        judge = new JudgeService('.out', '.', 'trim', mockExecutor);
    });

    // Verdict Tests
    suite('Verdict Determination', () => {
        test('Returns AC for matching output', async () => {
            mockExecutor.setMockResult({ stdout: '42', exitCode: 0 });
            const testCase = createTestCase('1', '1 2', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'AC');
        });

        test('Returns WA for non-matching output', async () => {
            mockExecutor.setMockResult({ stdout: '41', exitCode: 0 });
            const testCase = createTestCase('1', '1 2', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'WA');
        });

        test('Returns TLE when timed out', async () => {
            mockExecutor.setMockResult({ timedOut: true, stdout: '' });
            const testCase = createTestCase('1', '1 2', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'TLE');
        });

        test('Returns RE for non-zero exit code', async () => {
            mockExecutor.setMockResult({ exitCode: 1, stderr: 'Error' });
            const testCase = createTestCase('1', '1 2', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'RE');
        });

        test('RE includes exit code', async () => {
            mockExecutor.setMockResult({ exitCode: 139 });
            const testCase = createTestCase('1', '1 2', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'RE');
            assert.strictEqual(result.exitCode, 139);
        });
    });

    // Comparison Mode Tests
    suite('Comparison Modes', () => {
        test('Exact mode: strict matching', async () => {
            judge.setComparisonMode('exact');
            mockExecutor.setMockResult({ stdout: '42 ', exitCode: 0 });
            const testCase = createTestCase('1', '', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'WA'); // Trailing space matters
        });

        test('Trim mode: ignores trailing whitespace', async () => {
            judge.setComparisonMode('trim');
            mockExecutor.setMockResult({ stdout: '42  \n', exitCode: 0 });
            const testCase = createTestCase('1', '', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'AC');
        });

        test('Trim mode: handles trailing newlines', async () => {
            judge.setComparisonMode('trim');
            mockExecutor.setMockResult({ stdout: 'hello\nworld\n\n', exitCode: 0 });
            const testCase = createTestCase('1', '', 'hello\nworld');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'AC');
        });

        test('IgnoreWhitespace mode: collapses all whitespace', async () => {
            judge.setComparisonMode('ignoreWhitespace');
            mockExecutor.setMockResult({ stdout: '1   2\n  3', exitCode: 0 });
            const testCase = createTestCase('1', '', '1 2 3');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'AC');
        });
    });

    // Result Properties Tests
    suite('Result Properties', () => {
        test('Includes execution time', async () => {
            mockExecutor.setMockResult({ stdout: '42', exitCode: 0, executionTimeMs: 150 });
            const testCase = createTestCase('1', '', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.executionTimeMs, 150);
        });

        test('Includes actual and expected output', async () => {
            mockExecutor.setMockResult({ stdout: '41', exitCode: 0 });
            const testCase = createTestCase('1', '', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.actualOutput, '41');
            assert.strictEqual(result.expectedOutput, '42');
        });

        test('Includes test case ID', async () => {
            mockExecutor.setMockResult({ stdout: '42', exitCode: 0 });
            const testCase = createTestCase('abc123', '', '42');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.testCaseId, 'abc123');
        });
    });

    // Multi-line Output Tests
    suite('Multi-line Output', () => {
        test('Handles multi-line correct output', async () => {
            judge.setComparisonMode('trim');
            mockExecutor.setMockResult({ stdout: 'line1\nline2\nline3', exitCode: 0 });
            const testCase = createTestCase('1', '', 'line1\nline2\nline3');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'AC');
        });

        test('Detects wrong line in multi-line output', async () => {
            mockExecutor.setMockResult({ stdout: 'line1\nwrong\nline3', exitCode: 0 });
            const testCase = createTestCase('1', '', 'line1\nline2\nline3');

            const result = await judge.judgeTestCase('test.exe', testCase);

            assert.strictEqual(result.verdict, 'WA');
        });
    });

    // Settings Tests
    suite('Settings', () => {
        test('Can change comparison mode', () => {
            judge.setComparisonMode('exact');
            assert.strictEqual(judge.getComparisonMode(), 'exact');

            judge.setComparisonMode('trim');
            assert.strictEqual(judge.getComparisonMode(), 'trim');
        });
    });
});
