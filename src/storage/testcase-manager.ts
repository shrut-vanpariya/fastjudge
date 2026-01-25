/**
 * FastJudge TestCase Manager
 * Handles CRUD operations for test cases with hybrid storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { TestCase, TestCaseWithData, StorageIndex, TestCaseId } from '../types';

/**
 * Generate a UUID v4
 */
function generateId(): string {
    return crypto.randomUUID();
}

/** Storage directory name */
const STORAGE_DIR = '.fastjudge';
const DATA_DIR = 'data';
const INDEX_FILE = 'index.json';

/** Current storage version */
const STORAGE_VERSION = 1;

export class TestCaseManager {
    private workspaceRoot: string;
    private storageDir: string;
    private dataDir: string;
    private indexPath: string;
    private index: StorageIndex | null = null;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.storageDir = path.join(workspaceRoot, STORAGE_DIR);
        this.dataDir = path.join(this.storageDir, DATA_DIR);
        this.indexPath = path.join(this.storageDir, INDEX_FILE);
    }

    // ===========================================================================
    // Initialization
    // ===========================================================================

    /**
     * Initialize storage directory structure
     */
    async initialize(): Promise<void> {
        // Create directories if they don't exist
        await fs.mkdir(this.storageDir, { recursive: true });
        await fs.mkdir(this.dataDir, { recursive: true });

        // Load or create index
        await this.loadIndex();
    }

    /**
     * Load index from disk
     */
    async loadIndex(): Promise<void> {
        try {
            const content = await fs.readFile(this.indexPath, 'utf-8');
            this.index = JSON.parse(content) as StorageIndex;
        } catch {
            // Create new index if doesn't exist
            this.index = {
                version: STORAGE_VERSION,
                files: {},
            };
            await this.saveIndex();
        }
    }

    /**
     * Save index to disk
     */
    async saveIndex(): Promise<void> {
        if (!this.index) {
            throw new Error('Index not loaded');
        }
        await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
    }

    // ===========================================================================
    // CRUD Operations
    // ===========================================================================

    /**
     * Get all test cases for a file
     */
    getTestCases(filePath: string): TestCase[] {
        if (!this.index) {
            return [];
        }
        const relativePath = this.getRelativePath(filePath);
        return this.index.files[relativePath] || [];
    }

    /**
     * Get a test case with its input/output data
     */
    async getTestCaseWithData(filePath: string, id: TestCaseId): Promise<TestCaseWithData | null> {
        const testCases = this.getTestCases(filePath);
        const testCase = testCases.find(tc => tc.id === id);

        if (!testCase) {
            return null;
        }

        const [input, expected] = await Promise.all([
            this.readDataFile(id, 'in'),
            this.readDataFile(id, 'out'),
        ]);

        return {
            ...testCase,
            input,
            expected,
        };
    }

    /**
     * Get all test cases with data for a file
     */
    async getAllTestCasesWithData(filePath: string): Promise<TestCaseWithData[]> {
        const testCases = this.getTestCases(filePath);
        const results: TestCaseWithData[] = [];

        for (const testCase of testCases) {
            const withData = await this.getTestCaseWithData(filePath, testCase.id);
            if (withData) {
                results.push(withData);
            }
        }

        return results;
    }

    /**
     * Add a new test case
     */
    async addTestCase(
        filePath: string,
        input: string,
        expected: string,
        name?: string
    ): Promise<TestCase> {
        if (!this.index) {
            await this.loadIndex();
        }

        const relativePath = this.getRelativePath(filePath);
        const existingTests = this.index!.files[relativePath] || [];

        // Generate ID and auto-name if not provided
        const id = generateId();
        const autoName = name || `Test ${existingTests.length + 1}`;

        const testCase: TestCase = {
            id,
            name: autoName,
            createdAt: Date.now(),
        };

        // Write data files
        await Promise.all([
            this.writeDataFile(id, 'in', input),
            this.writeDataFile(id, 'out', expected),
        ]);

        // Update index
        if (!this.index!.files[relativePath]) {
            this.index!.files[relativePath] = [];
        }
        this.index!.files[relativePath].push(testCase);
        await this.saveIndex();

        return testCase;
    }

    /**
     * Update an existing test case
     */
    async updateTestCase(
        filePath: string,
        id: TestCaseId,
        updates: { name?: string; input?: string; expected?: string }
    ): Promise<boolean> {
        if (!this.index) {
            return false;
        }

        const relativePath = this.getRelativePath(filePath);
        const testCases = this.index.files[relativePath];

        if (!testCases) {
            return false;
        }

        const index = testCases.findIndex(tc => tc.id === id);
        if (index === -1) {
            return false;
        }

        // Update metadata
        if (updates.name !== undefined) {
            testCases[index].name = updates.name;
        }

        // Update data files
        const writePromises: Promise<void>[] = [];
        if (updates.input !== undefined) {
            writePromises.push(this.writeDataFile(id, 'in', updates.input));
        }
        if (updates.expected !== undefined) {
            writePromises.push(this.writeDataFile(id, 'out', updates.expected));
        }

        await Promise.all(writePromises);
        await this.saveIndex();

        return true;
    }

    /**
     * Delete a test case
     */
    async deleteTestCase(filePath: string, id: TestCaseId): Promise<boolean> {
        if (!this.index) {
            return false;
        }

        const relativePath = this.getRelativePath(filePath);
        const testCases = this.index.files[relativePath];

        if (!testCases) {
            return false;
        }

        const index = testCases.findIndex(tc => tc.id === id);
        if (index === -1) {
            return false;
        }

        // Remove from index
        testCases.splice(index, 1);

        // Clean up empty arrays
        if (testCases.length === 0) {
            delete this.index.files[relativePath];
        }

        // Delete data files
        await Promise.all([
            this.deleteDataFile(id, 'in'),
            this.deleteDataFile(id, 'out'),
        ]);

        await this.saveIndex();
        return true;
    }

    // ===========================================================================
    // Helper Methods
    // ===========================================================================

    /**
     * Get relative path from workspace root
     */
    private getRelativePath(filePath: string): string {
        return path.relative(this.workspaceRoot, filePath);
    }

    /**
     * Get data file path
     */
    private getDataPath(id: TestCaseId, type: 'in' | 'out'): string {
        return path.join(this.dataDir, `${id}.${type}`);
    }

    /**
     * Read data file content
     */
    private async readDataFile(id: TestCaseId, type: 'in' | 'out'): Promise<string> {
        try {
            return await fs.readFile(this.getDataPath(id, type), 'utf-8');
        } catch {
            return '';
        }
    }

    /**
     * Write data file content
     */
    private async writeDataFile(id: TestCaseId, type: 'in' | 'out', content: string): Promise<void> {
        await fs.writeFile(this.getDataPath(id, type), content, 'utf-8');
    }

    /**
     * Delete data file
     */
    private async deleteDataFile(id: TestCaseId, type: 'in' | 'out'): Promise<void> {
        try {
            await fs.unlink(this.getDataPath(id, type));
        } catch {
            // Ignore if file doesn't exist
        }
    }
}
