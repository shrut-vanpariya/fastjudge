/**
 * FastJudge Type Definitions
 */

// ============================================================================
// Identifiers
// ============================================================================

/** Unique identifier for test cases (UUID v4) */
export type TestCaseId = string;

/** Supported programming languages */
export type Language = 'cpp' | 'python' | 'java' | 'javascript';

/** Comparison modes for output matching */
export type ComparisonMode = 'exact' | 'trim' | 'ignoreWhitespace';

// ============================================================================
// Verdicts
// ============================================================================

/** Judge verdict types */
export type Verdict =
    | 'AC'       // ✅ Accepted
    | 'WA'       // ❌ Wrong Answer
    | 'TLE'      // ⏱️ Time Limit Exceeded
    | 'MLE'      // 📦 Memory Limit Exceeded (v2)
    | 'RE'       // 💥 Runtime Error
    | 'CE'       // 🔨 Compilation Error
    | 'IE'       // ⚠️ Internal Error
    | 'PENDING'  // ⚪ Not yet run
    | 'RUNNING'  // ⏳ Currently executing
    | 'STOPPED'; // 🛑 Stopped by user



// ============================================================================
// Test Cases
// ============================================================================

/** Test case metadata (stored in index.json) */
export interface TestCase {
    id: TestCaseId;
    name?: string;        // Optional, auto-generates "Test 1", "Test 2"...
    createdAt: number;    // Unix timestamp
}

/** Test case with loaded input/output data */
export interface TestCaseWithData extends TestCase {
    input: string;
    expected: string;
}

// ============================================================================
// Execution
// ============================================================================

/** Test execution mode */
export type ExecutionMode = 'sequential' | 'sequential-live' | 'parallel';

/** Result of code execution */
export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    timedOut: boolean;
    aborted: boolean;
    signal: NodeJS.Signals | null;
    // File storage for large outputs
    stdoutPath?: string;
    stderrPath?: string;
    outputTruncated?: boolean;
}

/** Result of compilation */
export interface CompileResult {
    success: boolean;
    executablePath?: string;
    error?: string;
    compilationTimeMs: number;
    cached?: boolean;  // True if compilation was skipped (cache hit)
}

/** Result of judging a single test case */
export interface JudgeResult {
    testCaseId: TestCaseId;
    verdict: Verdict;
    executionTimeMs: number;
    memoryUsageKb?: number;  // v2 implementation

    // Output comparison (may be truncated for UI)
    actualOutput: string;
    expectedOutput: string;

    // Full output file paths
    stdoutPath?: string;
    stderrPath?: string;
    outputTruncated?: boolean;

    // For RE verdict
    exitCode?: number;
    signal?: NodeJS.Signals | null;      // Parsed signal name (e.g., 'SIGSEGV', 'ACCESS_VIOLATION')
    stderr?: string;      // Raw error output for debugging

    // For CE/IE/RE/TLE
    errorMessage?: string;  // Human-readable error summary
}

// ============================================================================
// Configuration
// ============================================================================

/** Language compiler/interpreter configuration */
export interface LanguageConfig {
    name: string;
    extension: string;
    compile?: {
        command: string;     // e.g., "g++"
        args: string[];      // e.g., ["-O2", "-std=c++17"]
        outputFlag: string;  // e.g., "-o"
    };
    run: {
        command: string;     // e.g., "./a.out" or "python"
        args: string[];      // e.g., [] or ["{source}"]
    };
}

// ============================================================================
// Storage
// ============================================================================

/** Storage index structure */
export interface StorageIndex {
    version: number;
    files: Record<string, TestCase[]>;  // filepath -> test cases
}

// ============================================================================
// Cache
// ============================================================================

/** Cache entry for compiled files */
export interface CacheEntry {
    contentHash: string;
    executablePath: string;
    compiledAt: number;
}

/** Abstract cache interface - extensible for disk persistence */
export interface ICompilationCache {
    get(filePath: string): CacheEntry | undefined;
    set(filePath: string, entry: CacheEntry): void;
    delete(filePath: string): void;
    clear(): void;
}
