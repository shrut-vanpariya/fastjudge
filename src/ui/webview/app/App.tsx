/**
 * FastJudge React App
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { TestCard } from './components/TestCard';
import { useVSCode } from './hooks/useVSCode';
import { TestCaseWithResult, ExtensionMessage, Verdict } from './types';
import { PlayIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon, SquareIcon, TrashIcon } from './components/Icons';
import './styles.css';

// Verdicts that should auto-expand
const ERROR_VERDICTS: Verdict[] = ['WA', 'RE', 'TLE', 'CE', 'IE'];

export function App() {
    const [filePath, setFilePath] = useState<string>('FastJudge');
    const [testCases, setTestCases] = useState<TestCaseWithResult[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const prevTestCasesRef = useRef<TestCaseWithResult[]>([]);
    const prevFilePathRef = useRef<string>('');

    // Calculate pass count from test cases (derived state)
    const { passedCount, totalCount, hasResults } = useMemo(() => {
        const total = testCases.length;
        const passed = testCases.filter(tc => tc.result?.verdict === 'AC').length;
        const hasAnyResult = testCases.some(tc =>
            tc.result?.verdict && tc.result.verdict !== 'PENDING' && tc.result.verdict !== 'RUNNING'
        );
        return { passedCount: passed, totalCount: total, hasResults: hasAnyResult };
    }, [testCases]);

    const handleMessage = useCallback((message: ExtensionMessage) => {
        switch (message.type) {
            case 'update':
                const isSameFile = message.filePath === prevFilePathRef.current;

                if (isSameFile) {
                    const oldCases = prevTestCasesRef.current;
                    const oldIds = new Set(oldCases.map(t => t.id));

                    const addedIds = message.testCases
                        .filter(t => !oldIds.has(t.id))
                        .map(t => t.id);

                    setExpandedIds(prev => {
                        const next = new Set(prev);

                        for (const tc of message.testCases) {
                            const oldTc = oldCases.find(o => o.id === tc.id);
                            const oldVerdict = oldTc?.result?.verdict;
                            const newVerdict = tc.result?.verdict;

                            // Auto-collapse on running
                            if (newVerdict === 'RUNNING' && oldVerdict !== 'RUNNING') {
                                next.delete(tc.id);
                            }

                            // Auto-expand on error
                            if (oldVerdict === 'RUNNING' && newVerdict && ERROR_VERDICTS.includes(newVerdict)) {
                                next.add(tc.id);
                            }
                        }

                        addedIds.forEach(id => next.add(id));
                        return next;
                    });
                } else {
                    // Different file - reset expanded state
                    setExpandedIds(new Set());
                }

                prevFilePathRef.current = message.filePath;
                prevTestCasesRef.current = message.testCases;
                setFilePath(message.filePath);
                setTestCases(message.testCases);
                break;
            case 'noFile':
                setFilePath('No file open');
                setTestCases([]);
                setExpandedIds(new Set());
                prevTestCasesRef.current = [];
                prevFilePathRef.current = '';
                break;
        }
    }, []);

    const {
        runAll,
        runSingle,
        addTestCase,
        deleteTestCase,
        updateTestCase,
        refresh,
        openFile,
        viewDiff,
        stopAll,
        deleteAll
    } = useVSCode(handleMessage);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleAdd = () => {
        addTestCase('', '');
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (expandedIds.size === testCases.length) {
            // Collapse all
            setExpandedIds(new Set());
        } else {
            // Expand all
            setExpandedIds(new Set(testCases.map(t => t.id)));
        }
    };

    const allExpanded = testCases.length > 0 && expandedIds.size === testCases.length;
    const allPassed = hasResults && passedCount === totalCount;

    return (
        <div className="app">
            {/* Header with filename and pass count */}
            <div className="header">
                <h2 className="file-name">{filePath}</h2>
                {totalCount > 0 && (
                    <span className={`pass-count ${allPassed ? 'all-passed' : hasResults ? 'some-failed' : ''}`}>
                        {passedCount}/{totalCount}
                    </span>
                )}
            </div>

            {/* Scrollable Test Cases List */}
            <div className="test-cases">
                {testCases.length === 0 ? (
                    <div className="no-tests">
                        No test cases yet.<br />
                        Click "+ Add Test Case" below to create one.
                    </div>
                ) : (
                    testCases.map((tc, index) => (
                        <TestCard
                            key={tc.id}
                            testCase={tc}
                            index={index}
                            onRun={runSingle}
                            onDelete={deleteTestCase}
                            onUpdate={updateTestCase}
                            isExpanded={expandedIds.has(tc.id)}
                            onToggle={toggleExpand}
                            onViewFull={openFile}
                            onViewDiff={viewDiff}
                        />
                    ))
                )}
            </div>

            {/* Bottom Toolbar - Icon Only */}
            <div className="bottom-toolbar">
                <button className="toolbar-btn-icon" onClick={runAll} title="Run All Tests">
                    <PlayIcon size={16} />
                </button>
                <button className="toolbar-btn-icon" onClick={stopAll} title="Stop All">
                    <SquareIcon size={16} />
                </button>
                <button className="toolbar-btn-icon" onClick={handleAdd} title="Add Test Case">
                    <PlusIcon size={16} />
                </button>
                <button className="toolbar-btn-icon" onClick={deleteAll} title="Delete All Test Cases">
                    <TrashIcon size={16} />
                </button>
                {testCases.length > 0 && (
                    <button
                        className="toolbar-btn-icon"
                        onClick={toggleAll}
                        title={allExpanded ? "Collapse All" : "Expand All"}
                    >
                        {allExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
}
