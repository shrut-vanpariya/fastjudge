/**
 * Types for webview communication
 */

export interface TestCase {
    id: string;
    name?: string;
    input: string;
    expected: string;
    createdAt: number;
}

export interface JudgeResult {
    testCaseId: string;
    verdict: Verdict;
    executionTimeMs: number;
    actualOutput: string;
    expectedOutput: string;
    errorMessage?: string;
    // New fields for I/O optimization
    stdoutPath?: string;
    stderrPath?: string;
    outputTruncated?: boolean;
    stderr?: string;
}

export type Verdict =
    | 'AC'
    | 'WA'
    | 'TLE'
    | 'RE'
    | 'CE'
    | 'IE'
    | 'PENDING'
    | 'RUNNING';

export interface TestCaseWithResult extends TestCase {
    result?: JudgeResult;
}

export interface UpdateMessage {
    type: 'update';
    filePath: string;
    testCases: TestCaseWithResult[];
}

export interface NoFileMessage {
    type: 'noFile';
}

export type ExtensionMessage = UpdateMessage | NoFileMessage;
