/**
 * Cross-Platform Signal Parser
 * Maps exit codes to human-readable error descriptions.
 * 
 * Unix: processes killed by signals exit with code 128 + signal_number
 * Windows: processes crash with NTSTATUS exception codes (unsigned 32-bit)
 */

import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface SignalInfo {
    signal: string;
    description: string;
}

// ============================================================================
// Unix Signals (exit code = 128 + signal number)
// ============================================================================

const UNIX_SIGNALS: Record<number, SignalInfo> = {
    4: { signal: 'SIGILL', description: 'Illegal instruction' },
    6: { signal: 'SIGABRT', description: 'Aborted (assertion failure or abort() called)' },
    7: { signal: 'SIGBUS', description: 'Bus error (misaligned memory access)' },
    8: { signal: 'SIGFPE', description: 'Floating point exception (division by zero)' },
    9: { signal: 'SIGKILL', description: 'Process killed (OOM or forced)' },
    11: { signal: 'SIGSEGV', description: 'Segmentation fault (invalid memory access)' },
    13: { signal: 'SIGPIPE', description: 'Broken pipe' },
    25: { signal: 'SIGXFSZ', description: 'File size limit exceeded' },
};

// ============================================================================
// Windows NTSTATUS Codes (unsigned 32-bit exception codes)
// ============================================================================

const WINDOWS_STATUS_CODES: Record<number, SignalInfo> = {
    0xC0000005: { signal: 'ACCESS_VIOLATION', description: 'Segmentation fault (invalid memory access)' },
    0xC000001D: { signal: 'ILLEGAL_INSTRUCTION', description: 'Illegal instruction' },
    0xC0000094: { signal: 'INTEGER_DIVIDE_BY_ZERO', description: 'Division by zero' },
    0xC00000FD: { signal: 'STACK_OVERFLOW', description: 'Stack overflow (deep recursion)' },
    0xC0000374: { signal: 'HEAP_CORRUPTION', description: 'Heap corruption (buffer overflow on heap)' },
    0xC0000409: { signal: 'STACK_BUFFER_OVERRUN', description: 'Stack buffer overflow detected' },
    0x40010005: { signal: 'CONTROL_C_EXIT', description: 'Process terminated (Ctrl+C or killed)' },
    3: { signal: 'ABORT', description: 'Aborted (CRT assertion failure)' },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse an exit code into signal information.
 * Uses platform detection to apply the correct mapping.
 */
export function parseExitCode(exitCode: number): SignalInfo | undefined {
    if (process.platform === 'win32') {
        return parseWindowsExitCode(exitCode);
    }
    return parseUnixExitCode(exitCode);
}

/**
 * Format a human-readable runtime error message from an exit code or signal.
 * 
 * Examples:
 *   "Runtime Error (SIGSEGV) — Segmentation fault (invalid memory access)"
 *   "Runtime Error — Process exited with code 1"
 */
export function formatRuntimeError(exitCode: number, signal: NodeJS.Signals | null): string {
    // Priority: Explicit signal string
    if (signal) {
        const signals = os.constants.signals as Record<string, number>;
        const signalNumber = signals[signal];
        if (signalNumber && UNIX_SIGNALS[signalNumber]) {
            const info = UNIX_SIGNALS[signalNumber];
            return `Runtime Error (${signal}) — ${info.description}`;
        }
        return `Runtime Error (${signal}) — Process terminated by signal`;
    }

    // Fallback: Exit code
    const info = parseExitCode(exitCode);

    if (info) {
        return `Runtime Error (${info.signal}) — ${info.description}`;
    }
    return `Runtime Error — Process exited with code ${exitCode}`;
}

// ============================================================================
// Platform-Specific Parsers
// ============================================================================

function parseUnixExitCode(exitCode: number): SignalInfo | undefined {
    // Unix convention: exit code = 128 + signal number
    if (exitCode > 128) {
        return UNIX_SIGNALS[exitCode - 128];
    }
    // Negative exit codes (rare, but Node.js can report these)
    if (exitCode < 0) {
        return UNIX_SIGNALS[Math.abs(exitCode)];
    }
    return undefined;
}

function parseWindowsExitCode(exitCode: number): SignalInfo | undefined {
    // Node.js may report unsigned 32-bit NTSTATUS codes as negative signed integers
    const unsigned = exitCode < 0 ? exitCode + 0x100000000 : exitCode;
    return WINDOWS_STATUS_CODES[unsigned];
}
