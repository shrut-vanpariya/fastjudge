import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { TestCaseManager } from '../storage/testcase-manager';

suite('TestCaseManager Test Suite', () => {
    let testDir: string;
    let manager: TestCaseManager;

    // Create a temp directory for each test
    setup(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fastjudge-test-'));
        manager = new TestCaseManager(testDir);
        await manager.initialize();
    });

    // Clean up temp directory after each test
    teardown(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    test('Initialize creates storage directory', async () => {
        const storageDir = path.join(testDir, '.fastjudge');
        const stats = await fs.stat(storageDir);
        assert.strictEqual(stats.isDirectory(), true);
    });

    test('Initialize creates data directory', async () => {
        const dataDir = path.join(testDir, '.fastjudge', 'data');
        const stats = await fs.stat(dataDir);
        assert.strictEqual(stats.isDirectory(), true);
    });

    test('Initialize creates index.json', async () => {
        const indexPath = path.join(testDir, '.fastjudge', 'index.json');
        const content = await fs.readFile(indexPath, 'utf-8');
        const index = JSON.parse(content);
        assert.strictEqual(index.version, 1);
        assert.deepStrictEqual(index.files, {});
    });

    test('Add test case creates entry', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '5 3', '8');

        assert.ok(testCase.id);
        assert.strictEqual(testCase.name, 'Test 1');
        assert.ok(testCase.createdAt);
    });

    test('Add test case with custom name', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '5 3', '8', 'Sample');

        assert.strictEqual(testCase.name, 'Sample');
    });

    test('Add test case creates data files', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '5 3', '8');

        const inputPath = path.join(testDir, '.fastjudge', 'data', `${testCase.id}.in`);
        const outputPath = path.join(testDir, '.fastjudge', 'data', `${testCase.id}.out`);

        const input = await fs.readFile(inputPath, 'utf-8');
        const output = await fs.readFile(outputPath, 'utf-8');

        assert.strictEqual(input, '5 3');
        assert.strictEqual(output, '8');
    });

    test('Get test cases returns empty for new file', () => {
        const filePath = path.join(testDir, 'newfile.cpp');
        const testCases = manager.getTestCases(filePath);
        assert.deepStrictEqual(testCases, []);
    });

    test('Get test cases returns added test cases', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        await manager.addTestCase(filePath, '1', '1');
        await manager.addTestCase(filePath, '2', '2');

        const testCases = manager.getTestCases(filePath);
        assert.strictEqual(testCases.length, 2);
        assert.strictEqual(testCases[0].name, 'Test 1');
        assert.strictEqual(testCases[1].name, 'Test 2');
    });

    test('Get test case with data', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '10 20', '30', 'Add Test');
        const withData = await manager.getTestCaseWithData(filePath, testCase.id);

        assert.ok(withData);
        assert.strictEqual(withData.input, '10 20');
        assert.strictEqual(withData.expected, '30');
        assert.strictEqual(withData.name, 'Add Test');
    });

    test('Update test case name', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '5', '5');
        const updated = await manager.updateTestCase(filePath, testCase.id, { name: 'New Name' });

        assert.strictEqual(updated, true);

        const testCases = manager.getTestCases(filePath);
        assert.strictEqual(testCases[0].name, 'New Name');
    });

    test('Update test case input/output', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, 'old', 'old');
        await manager.updateTestCase(filePath, testCase.id, {
            input: 'new input',
            expected: 'new expected'
        });

        const withData = await manager.getTestCaseWithData(filePath, testCase.id);

        assert.ok(withData);
        assert.strictEqual(withData.input, 'new input');
        assert.strictEqual(withData.expected, 'new expected');
    });

    test('Delete test case removes from index', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '5', '5');
        const deleted = await manager.deleteTestCase(filePath, testCase.id);

        assert.strictEqual(deleted, true);

        const testCases = manager.getTestCases(filePath);
        assert.strictEqual(testCases.length, 0);
    });

    test('Delete test case removes data files', async () => {
        const filePath = path.join(testDir, 'solution.cpp');

        const testCase = await manager.addTestCase(filePath, '5', '5');
        const inputPath = path.join(testDir, '.fastjudge', 'data', `${testCase.id}.in`);

        await manager.deleteTestCase(filePath, testCase.id);

        let fileExists = true;
        try {
            await fs.access(inputPath);
        } catch {
            fileExists = false;
        }

        assert.strictEqual(fileExists, false);
    });

    test('Multiple files have separate test cases', async () => {
        const file1 = path.join(testDir, 'file1.cpp');
        const file2 = path.join(testDir, 'file2.cpp');

        await manager.addTestCase(file1, 'a', 'b');
        await manager.addTestCase(file2, 'c', 'd');

        const tests1 = manager.getTestCases(file1);
        const tests2 = manager.getTestCases(file2);

        assert.strictEqual(tests1.length, 1);
        assert.strictEqual(tests2.length, 1);
    });
});
