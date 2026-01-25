/**
 * TestCard Component - Collapsible test case card with inline editing
 */

import React, { useState, useEffect } from 'react';
import { TestCaseWithResult, Verdict } from '../types';
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
}

const VERDICT_ICONS: Record<Verdict, string> = {
    AC: '✅',
    WA: '❌',
    TLE: '⏱️',
    RE: '💥',
    CE: '🔨',
    IE: '⚠️',
    PENDING: '⚪',
    RUNNING: '⏳',
};

export function TestCard({ testCase, index, onRun, onDelete, onUpdate, isExpanded, onToggle, onViewFull }: TestCardProps) {
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
    const time = result?.executionTimeMs && result.executionTimeMs > 0
        ? `${Math.round(result.executionTimeMs)}ms`
        : '';
    const displayName = name || `Test ${index + 1}`;

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

    return (
        <div className="test-card">
            <div className="test-header" onClick={() => onToggle(testCase.id)}>
                <span className="test-title">
                    <span className={`verdict verdict-${verdict.toLowerCase()}`}>
                        {VERDICT_ICONS[verdict]}
                    </span>
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
                        <span>{displayName}</span>
                    )}
                </span>
                <span className="time">{time}</span>
            </div>

            {isExpanded && (
                <div className="test-content">
                    <div className="section">
                        <div className="section-label">Input</div>
                        <textarea
                            className="code-box editable"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Enter input..."
                        />
                    </div>

                    <div className="section">
                        <div className="section-label">Expected Output</div>
                        <textarea
                            className={`code-box editable ${verdict === 'AC' ? 'match' : ''}`}
                            value={expected}
                            onChange={(e) => setExpected(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Enter expected output..."
                        />
                    </div>

                    {result?.actualOutput !== undefined && (
                        <div className="section">
                            <div className="section-label">
                                Received Output
                                {result.outputTruncated && (
                                    <span className="truncated-indicator"> (truncated)</span>
                                )}
                            </div>
                            <div className={`code-box read-only ${verdict === 'AC' ? 'match' : 'diff'}`}>
                                {result.actualOutput}
                            </div>
                            {result.outputTruncated && result.stdoutPath && (
                                <button
                                    className="btn btn-link"
                                    onClick={() => onViewFull?.(result.stdoutPath!)}
                                >
                                    📄 View Full Output
                                </button>
                            )}
                        </div>
                    )}

                    {result?.stderr && (
                        <div className="section">
                            <div className="section-label">Error Output</div>
                            <div className="code-box read-only diff">
                                {result.stderr}
                            </div>
                            {result.stderrPath && (
                                <button
                                    className="btn btn-link"
                                    onClick={() => onViewFull?.(result.stderrPath!)}
                                >
                                    📄 View Full Errors
                                </button>
                            )}
                        </div>
                    )}

                    <div className="actions">
                        <button className="btn" onClick={() => onRun(testCase.id)}>
                            ▶ Run
                        </button>
                        <button className="btn btn-secondary" onClick={() => onDelete(testCase.id)}>
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
