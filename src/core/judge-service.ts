/**
 * FastJudge Judge Service
 * Orchestrates compilation, execution, and verdict comparison
 */

import {
    Verdict,
    JudgeResult,
    TestCaseWithData,
    RuntimeErrorSubtype,
    CompileResult
} from '../types';
import { CompilerService } from './compiler-service';
import { ExecutorService, executorService } from './executor-service';
import { LanguageService, languageService } from './language-service';

/** Comparison modes for output matching */
export type ComparisonMode = 'exact' | 'trim' | 'ignoreWhitespace';

export class JudgeService {
    private compiler: CompilerService;
    private executor: ExecutorService;
    private langService: LanguageService;
    private comparisonMode: ComparisonMode;

    constructor(
        outputDir: string,
        comparisonMode: ComparisonMode = 'trim',
        executor?: ExecutorService,
        langService?: LanguageService
    ) {
        this.compiler = new CompilerService(outputDir);
        this.executor = executor || executorService;
        this.langService = langService || languageService;
        this.comparisonMode = comparisonMode;
    }

    /**
     * Judge all test cases for a source file
     * Runs all tests and returns all verdicts
     */
    async judgeAll(
        sourcePath: string,
        testCases: TestCaseWithData[]
    ): Promise<JudgeResult[]> {
        const results: JudgeResult[] = [];

        // Compile once
        const compileResult = await this.compiler.compile(sourcePath);

        if (!compileResult.success) {
            // Return CE for all test cases
            return testCases.map((tc) => ({
                testCaseId: tc.id,
                verdict: 'CE' as Verdict,
                executionTimeMs: 0,
                actualOutput: '',
                expectedOutput: tc.expected,
                errorMessage: compileResult.error,
            }));
        }

        // Determine language for executor
        const language = this.langService.detectLanguage(sourcePath);

        // Run each test case
        for (const testCase of testCases) {
            const result = await this.judgeTestCase(
                compileResult.executablePath!,
                testCase,
                language || undefined
            );
            results.push(result);
        }

        return results;
    }

    /**
     * Judge a single test case
     */
    async judgeTestCase(
        executablePath: string,
        testCase: TestCaseWithData,
        language?: string
    ): Promise<JudgeResult> {
        // Execute
        const execResult = await this.executor.execute(
            executablePath,
            testCase.input,
            language as any
        );

        // Check for TLE
        if (execResult.timedOut) {
            return {
                testCaseId: testCase.id,
                verdict: 'TLE',
                executionTimeMs: execResult.executionTimeMs,
                actualOutput: execResult.stdout,
                expectedOutput: testCase.expected,
            };
        }

        // Check for runtime error
        if (execResult.exitCode !== 0) {
            const signal = this.executor.parseSignal(execResult.exitCode);
            return {
                testCaseId: testCase.id,
                verdict: 'RE',
                executionTimeMs: execResult.executionTimeMs,
                actualOutput: execResult.stdout,
                expectedOutput: testCase.expected,
                runtimeErrorSubtype: this.mapSignalToSubtype(signal),
                exitCode: execResult.exitCode,
                signal,
                errorMessage: execResult.stderr || `Process exited with code ${execResult.exitCode}`,
            };
        }

        // Compare output
        const isCorrect = this.compareOutput(execResult.stdout, testCase.expected);

        return {
            testCaseId: testCase.id,
            verdict: isCorrect ? 'AC' : 'WA',
            executionTimeMs: execResult.executionTimeMs,
            actualOutput: execResult.stdout,
            expectedOutput: testCase.expected,
        };
    }

    /**
     * Compare actual output with expected output
     */
    private compareOutput(actual: string, expected: string): boolean {
        switch (this.comparisonMode) {
            case 'exact':
                return actual === expected;

            case 'trim':
                return this.normalizeOutput(actual) === this.normalizeOutput(expected);

            case 'ignoreWhitespace':
                return this.collapseWhitespace(actual) === this.collapseWhitespace(expected);

            default:
                return this.normalizeOutput(actual) === this.normalizeOutput(expected);
        }
    }

    /**
     * Normalize output: trim lines and remove trailing newlines
     */
    private normalizeOutput(output: string): string {
        return output
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n')
            .trimEnd();
    }

    /**
     * Collapse all whitespace to single spaces
     */
    private collapseWhitespace(output: string): string {
        return output.replace(/\s+/g, ' ').trim();
    }

    /**
     * Map signal name to RuntimeErrorSubtype
     */
    private mapSignalToSubtype(signal?: string): RuntimeErrorSubtype {
        if (!signal) {
            return 'UNKNOWN';
        }
        switch (signal) {
            case 'SIGSEGV':
                return 'SIGSEGV';
            case 'SIGFPE':
                return 'SIGFPE';
            case 'SIGABRT':
                return 'SIGABRT';
            default:
                return 'UNKNOWN';
        }
    }

    /**
     * Set comparison mode
     */
    setComparisonMode(mode: ComparisonMode): void {
        this.comparisonMode = mode;
    }

    /**
     * Get current comparison mode
     */
    getComparisonMode(): ComparisonMode {
        return this.comparisonMode;
    }

    /**
     * Set time limit (delegates to executor)
     */
    setTimeLimit(ms: number): void {
        this.executor.setTimeLimit(ms);
    }

    /**
     * Clear compilation cache
     */
    clearCache(): void {
        this.compiler.clearCache();
    }
}
