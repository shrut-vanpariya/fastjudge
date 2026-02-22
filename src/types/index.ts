/**
 * FastJudge Type Definitions
 */

// ============================================================================
// Identifiers
// ============================================================================

/** Unique identifier for test cases (UUID v4) */
export type TestCaseId = string;

/** Language identifier (e.g., 'cpp', 'python', 'java', 'javascript') */
export type Language = string;

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
    outputDir?: string;
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
    extensions: string[];
    compileArgs?: string[];
    runArgs: string[];
    outputExtension?: string;  // e.g., '.class' for Java. Defaults to platform binary (.exe on Windows)
}

/** Interface for language providers */
export interface ILanguageProvider {
    /** Unique ID of the language (e.g., 'cpp') */
    id: Language;

    /** Display name (e.g., 'C++') */
    name: string;

    /** File extensions supported by this language (e.g., ['.cpp', '.cc']) */
    extensions: string[];

    /** 
     * Get the shell command and arguments to compile the file.
     * Returns null if the language doesn't require compilation.
     */
    getCompileCommand(sourcePath: string, outputDir: string): { command: string; args: string[] } | null;

    /** 
     * Get the shell command and arguments to run the file.
     */
    getRunCommand(sourcePath: string, outputDir: string): { command: string; args: string[] };
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
    outputDir: string;
    executablePath?: string;  // Path to compiled binary, used for cache validation
    compiledAt: number;
}

/** Abstract cache interface - extensible for disk persistence */
export interface ICompilationCache {
    get(filePath: string): CacheEntry | undefined;
    set(filePath: string, entry: CacheEntry): void;
    delete(filePath: string): void;
    clear(): void;
}
