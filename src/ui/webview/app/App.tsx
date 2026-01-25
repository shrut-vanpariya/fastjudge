/**
 * FastJudge React App
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TestCard } from './components/TestCard';
import { useVSCode } from './hooks/useVSCode';
import { TestCaseWithResult, ExtensionMessage } from './types';
import './styles.css';

export function App() {
    const [filePath, setFilePath] = useState<string>('FastJudge');
    const [testCases, setTestCases] = useState<TestCaseWithResult[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Track previous state to detect additions vs file switches
    const prevTestCasesRef = useRef<TestCaseWithResult[]>([]);
    const prevFilePathRef = useRef<string>('');

    const handleMessage = useCallback((message: ExtensionMessage) => {
        switch (message.type) {
            case 'update':
                const isSameFile = message.filePath === prevFilePathRef.current;

                if (isSameFile) {
                    // Same file - detect NEW test cases and expand them
                    const oldIds = new Set(prevTestCasesRef.current.map(t => t.id));
                    const addedIds = message.testCases
                        .filter(t => !oldIds.has(t.id))
                        .map(t => t.id);

                    if (addedIds.length > 0) {
                        setExpandedIds(prev => {
                            const next = new Set(prev);
                            addedIds.forEach(id => next.add(id));
                            return next;
                        });
                    }
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
        openFile
    } = useVSCode(handleMessage);

    // Request initial data on mount
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

    return (
        <div className="app">
            <div className="header">
                <h2>{filePath}</h2>
                <div className="toolbar">
                    <button className="btn" onClick={runAll} title="Run All Tests">
                        ▶ Run All
                    </button>
                    <button className="btn" onClick={toggleAll} title={allExpanded ? "Collapse All" : "Expand All"}>
                        {allExpanded ? "🔽" : "▶️"}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleAdd}
                        title="Add Test Case"
                    >
                        + Add
                    </button>
                </div>
            </div>

            <div className="test-cases">
                {testCases.length === 0 ? (
                    <div className="no-tests">
                        No test cases yet.<br />
                        Click "+ Add" to create one.
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
                        />
                    ))
                )}
            </div>
        </div>
    );
}
