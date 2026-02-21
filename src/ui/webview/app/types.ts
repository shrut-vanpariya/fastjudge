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
    errorMessage?: string;    // Human-readable error summary (CE/RE/TLE/IE)
    // I/O file paths for large outputs
    stdoutPath?: string;
    stderrPath?: string;
    outputTruncated?: boolean;
    stderr?: string;          // Raw error output for debugging
    // RE-specific fields
    exitCode?: number;
    signal?: string | null;          // Parsed signal name
}

export type Verdict =
    | 'AC'
    | 'WA'
    | 'TLE'
    | 'RE'
    | 'CE'
    | 'IE'
    | 'PENDING'
    | 'RUNNING'
    | 'STOPPED';

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
