import * as assert from 'assert';
import * as path from 'path';
import { LanguageService } from '../core/language-service';

suite('LanguageService Test Suite', () => {
    let service: LanguageService;

    setup(() => {
        service = new LanguageService();
    });

    // Language Detection Tests
    suite('detectLanguage', () => {
        test('Detects C++ from .cpp extension', () => {
            assert.strictEqual(service.detectLanguage('solution.cpp'), 'cpp');
        });

        test('Detects C++ from .cc extension', () => {
            assert.strictEqual(service.detectLanguage('main.cc'), 'cpp');
        });

        test('Detects Python from .py extension', () => {
            assert.strictEqual(service.detectLanguage('script.py'), 'python');
        });

        test('Detects Java from .java extension', () => {
            assert.strictEqual(service.detectLanguage('Main.java'), 'java');
        });

        test('Detects JavaScript from .js extension', () => {
            assert.strictEqual(service.detectLanguage('app.js'), 'javascript');
        });

        test('Returns null for unsupported extension', () => {
            assert.strictEqual(service.detectLanguage('file.txt'), null);
        });

        test('Handles full path', () => {
            assert.strictEqual(service.detectLanguage('/home/user/code/solution.cpp'), 'cpp');
        });

        test('Case insensitive extension detection', () => {
            assert.strictEqual(service.detectLanguage('file.CPP'), 'cpp');
            assert.strictEqual(service.detectLanguage('file.Py'), 'python');
        });
    });

    // Compilation Check Tests
    suite('requiresCompilation', () => {
        test('C++ requires compilation', () => {
            assert.strictEqual(service.requiresCompilation('cpp'), true);
        });

        test('Java requires compilation', () => {
            assert.strictEqual(service.requiresCompilation('java'), true);
        });

        test('Python does not require compilation', () => {
            assert.strictEqual(service.requiresCompilation('python'), false);
        });

        test('JavaScript does not require compilation', () => {
            assert.strictEqual(service.requiresCompilation('javascript'), false);
        });
    });

    // Configuration Tests
    suite('getConfig', () => {
        test('C++ config has compile settings', () => {
            const config = service.getConfig('cpp');
            assert.strictEqual(config.name, 'C++');
            assert.ok(config.compile);
            assert.strictEqual(config.compile?.command, 'g++');
        });

        test('Python config has no compile settings', () => {
            const config = service.getConfig('python');
            assert.strictEqual(config.name, 'Python');
            assert.strictEqual(config.compile, undefined);
            assert.strictEqual(config.run.command, 'python');
        });
    });

    // Executable Path Tests
    suite('getExecutablePath', () => {
        test('Generates executable path from source', () => {
            const sourcePath = path.join('project', 'solution.cpp');
            const outputDir = path.join('project', 'out');
            const execPath = service.getExecutablePath(sourcePath, outputDir);

            // Should contain the base name without extension
            assert.ok(execPath.includes('solution'));
            // Check that output directory is used (normalize both for comparison)
            assert.ok(path.normalize(execPath).startsWith(path.normalize(outputDir)));
        });

        test('Adds .exe on Windows', () => {
            const sourcePath = 'C:\\project\\solution.cpp';
            const outputDir = 'C:\\project\\out';
            const execPath = service.getExecutablePath(sourcePath, outputDir);

            if (process.platform === 'win32') {
                assert.ok(execPath.endsWith('.exe'));
            }
        });
    });

    // Support Check Tests
    suite('isSupported', () => {
        test('Returns true for supported files', () => {
            assert.strictEqual(service.isSupported('file.cpp'), true);
            assert.strictEqual(service.isSupported('file.py'), true);
        });

        test('Returns false for unsupported files', () => {
            assert.strictEqual(service.isSupported('file.txt'), false);
            assert.strictEqual(service.isSupported('file.rb'), false);
        });
    });

    // Supported Extensions Tests
    suite('getSupportedExtensions', () => {
        test('Returns array of extensions', () => {
            const exts = service.getSupportedExtensions();
            assert.ok(Array.isArray(exts));
            assert.ok(exts.includes('.cpp'));
            assert.ok(exts.includes('.py'));
            assert.ok(exts.includes('.java'));
            assert.ok(exts.includes('.js'));
        });
    });
});
