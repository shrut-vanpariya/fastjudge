/**
 * Hook for VS Code Webview API communication
 */

import { useEffect, useCallback } from 'react';
import { ExtensionMessage } from '../types';

// Declare the VS Code API
declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

// Get VS Code API singleton
const vscode = acquireVsCodeApi();

export function useVSCode(onMessage: (message: ExtensionMessage) => void) {
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            onMessage(event.data as ExtensionMessage);
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onMessage]);

    const postMessage = useCallback((message: any) => {
        vscode.postMessage(message);
    }, []);

    const runAll = useCallback(() => {
        postMessage({ type: 'runAll' });
    }, [postMessage]);

    const runSingle = useCallback((testCaseId: string) => {
        postMessage({ type: 'runSingle', testCaseId });
    }, [postMessage]);

    const addTestCase = useCallback((input: string, expected: string, name?: string) => {
        postMessage({ type: 'addTestCase', input, expected, name });
    }, [postMessage]);

    const deleteTestCase = useCallback((testCaseId: string) => {
        postMessage({ type: 'deleteTestCase', testCaseId });
    }, [postMessage]);

    const updateTestCase = useCallback((testCaseId: string, input: string, expected: string, name?: string) => {
        postMessage({ type: 'updateTestCase', testCaseId, input, expected, name });
    }, [postMessage]);

    const refresh = useCallback(() => {
        postMessage({ type: 'refresh' });
    }, [postMessage]);

    const openFile = useCallback((filePath: string) => {
        postMessage({ type: 'openFile', filePath });
    }, [postMessage]);

    return {
        runAll,
        runSingle,
        addTestCase,
        deleteTestCase,
        updateTestCase,
        refresh,
        openFile,
        postMessage,
    };
}
