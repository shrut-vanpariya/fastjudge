/**
 * Competitive Companion HTTP Server
 * Listens for problems from the browser extension
 */

import * as http from 'http';
import { CompanionProblem } from '../types/companion';

export type ProblemCallback = (problem: CompanionProblem) => void;

export class CompanionServer {
    private server: http.Server | null = null;
    private port: number;
    private onProblemCallback: ProblemCallback | null = null;

    constructor(port: number = 27121) {
        this.port = port;
    }

    /**
     * Register callback for when a problem is received
     */
    onProblem(callback: ProblemCallback): void {
        this.onProblemCallback = callback;
    }

    /**
     * Start the HTTP server
     */
    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                resolve();
                return;
            }

            this.server = http.createServer((req, res) => {
                // Set CORS headers
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }

                if (req.method !== 'POST') {
                    res.writeHead(405);
                    res.end('Method Not Allowed');
                    return;
                }

                let body = '';
                req.on('data', (chunk) => {
                    body += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        if (body === '') {
                            res.writeHead(400);
                            res.end('Empty body');
                            return;
                        }

                        const problem: CompanionProblem = JSON.parse(body);

                        // Notify callback
                        if (this.onProblemCallback) {
                            this.onProblemCallback(problem);
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (error) {
                        console.error('Error parsing problem:', error);
                        res.writeHead(400);
                        res.end('Invalid JSON');
                    }
                });
            });

            this.server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use. Is another VS Code window open?`));
                } else {
                    reject(err);
                }
            });

            this.server.listen(this.port, () => {
                console.log(`Companion server listening on port ${this.port}`);
                resolve();
            });
        });
    }

    /**
     * Stop the HTTP server
     */
    stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Check if server is running
     */
    isRunning(): boolean {
        return this.server !== null;
    }

    /**
     * Get the port number
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Set a new port (requires restart)
     */
    setPort(port: number): void {
        this.port = port;
    }
}
