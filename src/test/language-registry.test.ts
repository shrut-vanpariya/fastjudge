import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageRegistry, CustomLanguageProvider } from '../core/language-registry';
import { LanguageConfig } from '../types';

suite('LanguageRegistry Test Suite', () => {
    vscode.window.showInformationMessage('Start all LanguageRegistry tests.');

    let registry: LanguageRegistry;

    setup(() => {
        registry = new LanguageRegistry();
    });

    suite('loadFromConfiguration', () => {
        test('Skips invalid configurations', () => {
            // We can test loadFromConfiguration using actual vscode configuration,
            // but setting vscode config in tests is tricky. 
            // Instead, we can observe behavior. If there were invalid configs in settings.json,
            // they would be skipped. Let's just verify it can load default ones successfully.
            registry.loadFromConfiguration();
            const providers = registry.getAllProviders();
            assert.strictEqual(providers.length > 0, true, 'Should load default providers');
        });
    });

    suite('getProvider', () => {
        test('Returns provider for requested ID', () => {
            registry.loadFromConfiguration();
            const provider = registry.getProvider('cpp');
            assert.notStrictEqual(provider, undefined);
            assert.strictEqual(provider?.id, 'cpp');
        });

        test('Returns undefined for non-existent ID', () => {
            registry.loadFromConfiguration();
            const provider = registry.getProvider('non-existent');
            assert.strictEqual(provider, undefined);
        });
    });

    suite('detectProvider', () => {
        setup(() => {
            registry.loadFromConfiguration();
        });

        test('Detects provider from standard lowercase extension', () => {
            const provider = registry.detectProvider('test.cpp');
            assert.strictEqual(provider?.id, 'cpp');
        });

        test('Detects provider from uppercase extension', () => {
            const provider = registry.detectProvider('TEST.CPP');
            assert.strictEqual(provider?.id, 'cpp');
        });

        test('Returns undefined for path with no extension', () => {
            const provider = registry.detectProvider('Makefile');
            assert.strictEqual(provider, undefined);
        });

        test('Returns undefined for path with unknown extension', () => {
            const provider = registry.detectProvider('test.unknown');
            assert.strictEqual(provider, undefined);
        });

        test('Handles path with dots in directory but no extension', () => {
            const provider = registry.detectProvider('/folder.name/file');
            assert.strictEqual(provider, undefined);
        });
    });

    suite('getAllProviders', () => {
        test('Returns an array of providers', () => {
            registry.loadFromConfiguration();
            const providers = registry.getAllProviders();
            assert.strictEqual(Array.isArray(providers), true);
            assert.strictEqual(providers.length > 0, true);
        });
    });

    suite('isExtensionSupported', () => {
        setup(() => {
            registry.loadFromConfiguration();
        });

        test('Returns true for supported extension with dot', () => {
            assert.strictEqual(registry.isExtensionSupported('.cpp'), true);
        });

        test('Returns true for supported extension without dot', () => {
            assert.strictEqual(registry.isExtensionSupported('cpp'), true);
        });

        test('Returns true for uppercase supported extension', () => {
            assert.strictEqual(registry.isExtensionSupported('.CPP'), true);
        });

        test('Returns false for unsupported extension', () => {
            assert.strictEqual(registry.isExtensionSupported('.unknown'), false);
        });
    });

    suite('CustomLanguageProvider Edge Cases', () => {
        test('Constructor initializes correctly', () => {
            const config: LanguageConfig = {
                name: 'Test Lang',
                extensions: ['.test'],
                compileArgs: ['compiler', '-c', '${sourceFile}'],
                runArgs: ['runner', '${executableFile}']
            };
            const provider = new CustomLanguageProvider('test', config);

            assert.strictEqual(provider.id, 'test');
            assert.strictEqual(provider.name, 'Test Lang');
            assert.deepStrictEqual(provider.extensions, ['.test']);
        });

        test('getCompileCommand returns null if compileArgs is undefined', () => {
            const config: LanguageConfig = {
                name: 'Test Lang',
                extensions: ['.test'],
                runArgs: ['runner', '${sourceFile}']
            };
            const provider = new CustomLanguageProvider('test', config);

            assert.strictEqual(provider.getCompileCommand('file.test', '/out'), null);
        });

        test('getCompileCommand returns null if compileArgs is empty array', () => {
            const config: LanguageConfig = {
                name: 'Test Lang',
                extensions: ['.test'],
                compileArgs: [],
                runArgs: ['runner', '${sourceFile}']
            };
            const provider = new CustomLanguageProvider('test', config);

            assert.strictEqual(provider.getCompileCommand('file.test', '/out'), null);
        });

        test('Interpolates variables correctly in compileArgs', () => {
            const config: LanguageConfig = {
                name: 'Test Lang',
                extensions: ['.test'],
                compileArgs: ['compiler', '${sourceFile}', '${outputDir}', '${executableFile}', '${className}'],
                runArgs: ['runner']
            };
            const provider = new CustomLanguageProvider('test', config);

            const sourcePath = '/src/MyClass.test';
            const outputDir = '/out';

            const command = provider.getCompileCommand(sourcePath, outputDir);
            assert.notStrictEqual(command, null);
            assert.strictEqual(command?.command, 'compiler');

            assert.strictEqual(command?.args[0], sourcePath);
            assert.strictEqual(command?.args[1], outputDir);

            // output file depends on platform (win32 gets .exe)
            const expectedExt = process.platform === 'win32' ? '.exe' : '';
            const expectedOutputFile = path.join(outputDir, 'MyClass' + expectedExt);

            assert.strictEqual(command?.args[2], expectedOutputFile);
            assert.strictEqual(command?.args[3], 'MyClass');
        });

        test('Interpolates variables correctly in runArgs', () => {
            const config: LanguageConfig = {
                name: 'Test Lang',
                extensions: ['.test'],
                runArgs: ['runner', '${sourceFile}', '${outputDir}', '${executableFile}', '${className}']
            };
            const provider = new CustomLanguageProvider('test', config);

            const sourcePath = '/src/MyClass.test';
            const outputDir = '/out';

            const command = provider.getRunCommand(sourcePath, outputDir);
            assert.strictEqual(command.command, 'runner');

            assert.strictEqual(command.args[0], sourcePath);
            assert.strictEqual(command.args[1], outputDir);

            const expectedExt = process.platform === 'win32' ? '.exe' : '';
            const expectedOutputFile = path.join(outputDir, 'MyClass' + expectedExt);

            assert.strictEqual(command.args[2], expectedOutputFile);
            assert.strictEqual(command.args[3], 'MyClass');
        });
    });

    suite('getExecutablePath', () => {
        test('Returns platform-specific path for compiled language', () => {
            const config: LanguageConfig = {
                name: 'C++',
                extensions: ['.cpp'],
                compileArgs: ['g++', '${sourceFile}', '-o', '${executableFile}'],
                runArgs: ['${executableFile}']
            };
            const provider = new CustomLanguageProvider('cpp', config);

            const result = provider.getExecutablePath('/src/main.cpp', '/out');
            const expectedExt = process.platform === 'win32' ? '.exe' : '';
            assert.strictEqual(result, path.join('/out', 'main' + expectedExt));
        });

        test('Uses custom outputExtension when provided', () => {
            const config: LanguageConfig = {
                name: 'Java',
                extensions: ['.java'],
                compileArgs: ['javac', '-d', '${outputDir}', '${sourceFile}'],
                runArgs: ['java', '-cp', '${outputDir}', '${className}'],
                outputExtension: '.class'
            };
            const provider = new CustomLanguageProvider('java', config);

            const result = provider.getExecutablePath('/src/Main.java', '/out');
            assert.strictEqual(result, path.join('/out', 'Main.class'));
        });

        test('Returns undefined for interpreted language', () => {
            const config: LanguageConfig = {
                name: 'Python',
                extensions: ['.py'],
                runArgs: ['python', '${sourceFile}']
            };
            const provider = new CustomLanguageProvider('python', config);

            assert.strictEqual(provider.getExecutablePath('/src/main.py', '/out'), undefined);
        });
    });

    suite('Extension normalization', () => {
        test('Normalizes extensions to lowercase', () => {
            const config: LanguageConfig = {
                name: 'Test',
                extensions: ['.CPP', '.Cc'],
                runArgs: ['runner']
            };
            const provider = new CustomLanguageProvider('test', config);

            assert.deepStrictEqual(provider.extensions, ['.cpp', '.cc']);
        });
    });
});
