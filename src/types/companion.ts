/**
 * Competitive Companion Integration Types
 */

/**
 * Problem data received from Competitive Companion browser extension
 */
export interface CompanionProblem {
    /** Problem name (e.g., "A. Watermelon") */
    name: string;
    /** Problem group (e.g., "Codeforces - Round 123") */
    group: string;
    /** URL of the problem */
    url: string;
    /** Time limit in milliseconds */
    timeLimit: number;
    /** Memory limit in MB */
    memoryLimit: number;
    /** Test cases */
    tests: CompanionTest[];
    /** Whether this is an interactive problem */
    interactive?: boolean;
    /** Batch info for contest parsing */
    batch?: {
        id: string;
        size: number;
    };
}

/**
 * Single test case from Competitive Companion
 */
export interface CompanionTest {
    input: string;
    output: string;
}
