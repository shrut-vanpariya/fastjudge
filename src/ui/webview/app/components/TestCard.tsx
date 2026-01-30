/**
 * TestCard Component - Collapsible test case card with inline editing
 */

import React, { useState, useEffect } from 'react';
import { TestCaseWithResult, Verdict } from '../types';
import {
    PlayIcon,
    TrashIcon,
    CheckIcon,
    XIcon,
    ClockIcon,
    SpinnerIcon,
    WarningIcon,
    CircleIcon,
    GearIcon,
    DiffIcon,
    DocumentIcon
} from './Icons';
import './TestCard.css';

interface TestCardProps {
    testCase: TestCaseWithResult;
    index: number;
    onRun: (id: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, input: string, expected: string, name?: string) => void;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onViewFull?: (filePath: string) => void;
    onViewDiff?: (testCaseId: string) => void;
}

// Verdict configuration with SVG icons
const VERDICT_CONFIG: Record<Verdict, { icon: React.FC<{ size?: number; className?: string }>; label: string }> = {
    AC: { icon: CheckIcon, label: 'AC' },
    WA: { icon: XIcon, label: 'WA' },
    TLE: { icon: ClockIcon, label: 'TLE' },
    RE: { icon: WarningIcon, label: 'RE' },
    CE: { icon: GearIcon, label: 'CE' },
    IE: { icon: WarningIcon, label: 'IE' },
    PENDING: { icon: CircleIcon, label: 'PENDING' },
    RUNNING: { icon: SpinnerIcon, label: 'RUNNING' },
};

const MAX_DIFF_LINES = 10;

export function TestCard({
    testCase,
    index,
    onRun,
    onDelete,
    onUpdate,
    isExpanded,
    onToggle,
    onViewFull,
    onViewDiff
}: TestCardProps) {
    // Local state for editing
    const [input, setInput] = useState(testCase.input);
    const [expected, setExpected] = useState(testCase.expected);
    const [name, setName] = useState(testCase.name || '');

    // Sync state when testCase prop changes (e.g. from refresh)
    useEffect(() => {
        setInput(testCase.input);
        setExpected(testCase.expected);
        setName(testCase.name || '');
    }, [testCase.input, testCase.expected, testCase.name]);

    const result = testCase.result;
    const verdict = result?.verdict || 'PENDING';
    const verdictConfig = VERDICT_CONFIG[verdict];
    const VerdictIcon = verdictConfig.icon;
    const time = result?.executionTimeMs && result.executionTimeMs > 0
        ? `${Math.round(result.executionTimeMs)}ms`
        : '';
    const displayName = name || `Test ${index + 1}`;

    const isMatch = verdict === 'AC';
    const hasDiff = verdict === 'WA' && result?.actualOutput !== undefined;

    // Generate diff lines (simple positional comparison)
    const generateDiff = () => {
        if (!result?.actualOutput || !result?.expectedOutput) return null;

        // Normalize line endings and split
        const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const expectedLines = normalize(result.expectedOutput).split('\n');
        const receivedLines = normalize(result.actualOutput).split('\n');
        const maxLines = Math.max(expectedLines.length, receivedLines.length);

        if (maxLines > MAX_DIFF_LINES) return null;

        const diffLines: { type: 'expected' | 'received'; content: string }[] = [];

        for (let i = 0; i < maxLines; i++) {
            // Trim trailing whitespace for comparison
            const exp = (expectedLines[i] ?? '').trimEnd();
            const rec = (receivedLines[i] ?? '').trimEnd();

            // Only show diff if lines are actually different
            if (exp !== rec) {
                if (exp) diffLines.push({ type: 'expected', content: `- Expected: ${exp}` });
                if (rec) diffLines.push({ type: 'received', content: `+ Received: ${rec}` });
            }
        }

        return diffLines.length > 0 ? diffLines : null;
    };

    const handleSave = () => {
        // Only update if changed
        if (
            input !== testCase.input ||
            expected !== testCase.expected ||
            (name && name !== testCase.name)
        ) {
            onUpdate(testCase.id, input, expected, name || undefined);
        }
    };

    const handleRunClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRun(testCase.id);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(testCase.id);
    };

    const diff = hasDiff ? generateDiff() : null;

    return (
        <div className={`test-card verdict-${verdict.toLowerCase()}`}>
            {/* Header Row */}
            <div className="test-header" onClick={() => onToggle(testCase.id)}>
                <div className="test-title">
                    {isExpanded ? (
                        <input
                            className="name-input"
                            value={name}
                            placeholder={`Test ${index + 1}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleSave}
                        />
                    ) : (
                        <span className="test-name">{displayName}</span>
                    )}
                    <span className={`verdict-badge ${verdict.toLowerCase()}`}>
                        <VerdictIcon size={10} className={verdict === 'RUNNING' ? 'spinner' : ''} />
                        <span>{verdictConfig.label}</span>
                    </span>
                    {time && <span className="time">{time}</span>}
                </div>
                <div className="header-actions">
                    <button
                        className="btn-icon"
                        onClick={handleRunClick}
                        title="Run Test"
                        disabled={verdict === 'RUNNING'}
                    >
                        <PlayIcon size={14} />
                    </button>
                    <button
                        className="btn-icon"
                        onClick={handleDeleteClick}
                        title="Delete"
                    >
                        <TrashIcon size={14} />
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="test-content">
                    {/* Input Section */}
                    <div className="section">
                        <div className="section-label">Input</div>
                        <textarea
                            className="code-box"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Enter input..."
                        />
                    </div>

                    {/* Expected Section */}
                    <div className="section">
                        <div className="section-label">Expected</div>
                        <textarea
                            className={`code-box ${isMatch ? 'match' : ''}`}
                            value={expected}
                            onChange={(e) => setExpected(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Enter expected output..."
                        />
                    </div>

                    {/* Received Section */}
                    {result?.actualOutput !== undefined && (
                        <div className="section">
                            <div className="section-label">
                                Received
                                {result.outputTruncated && (
                                    <span className="truncated-indicator">(truncated)</span>
                                )}
                            </div>
                            <div className={`code-box read-only ${isMatch ? 'match' : 'diff'}`}>
                                {result.actualOutput || <span className="empty-output">(empty)</span>}
                            </div>

                            {/* Diff Lines */}
                            {diff && (
                                <div className="diff-view">
                                    {diff.map((line, i) => (
                                        <div key={i} className={`diff-line ${line.type}`}>
                                            {line.content}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Match Indicator */}
                            <div className={`match-indicator ${isMatch ? 'success' : 'error'}`}>
                                {isMatch ? (
                                    <>
                                        <CheckIcon size={12} /> Matches Expected
                                    </>
                                ) : (
                                    <>
                                        <XIcon size={12} /> Does Not Match
                                    </>
                                )}
                            </div>

                            {/* View Diff Button */}
                            {hasDiff && (
                                <button
                                    className="btn-link"
                                    onClick={() => onViewDiff?.(testCase.id)}
                                >
                                    <DiffIcon size={12} /> View Diff in Editor
                                </button>
                            )}

                            {/* View Full Output */}
                            {result.outputTruncated && result.stdoutPath && (
                                <button
                                    className="btn-link"
                                    onClick={() => onViewFull?.(result.stdoutPath!)}
                                >
                                    <DocumentIcon size={12} /> View Full Output
                                </button>
                            )}
                        </div>
                    )}

                    {/* Error Output */}
                    {result?.stderr && (
                        <div className="section">
                            <div className="section-label">Error Output</div>
                            <div className="code-box read-only diff">
                                {result.stderr}
                            </div>
                            {result.stderrPath && (
                                <button
                                    className="btn-link"
                                    onClick={() => onViewFull?.(result.stderrPath!)}
                                >
                                    <DocumentIcon size={12} /> View Full Errors
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
