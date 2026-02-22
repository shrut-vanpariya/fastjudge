# Changelog

All notable changes to FastJudge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-22

### Added
- **Language Provider API**: Extensible, data-driven language registry replacing hardcoded language configurations
- `fastjudge.languages` unified setting — add any language via `settings.json` with custom compile/run commands
- `outputExtension` config field for languages with non-standard compiled output (e.g., `.class` for Java)
- Duplicate extension detection with console warnings during configuration loading

### Improved
- Cache validation now uses stored `executablePath` per language — fixes Java recompiling every run
- File extensions are normalized to lowercase — case-insensitive matching for user configs
- `defaultLanguage` setting accepts any language name or ID, not just built-in languages
- Language detection is performed once per test run instead of per test case

### Breaking Changes
- Replaced `fastjudge.language.cpp.*`, `fastjudge.language.python.*`, etc. with unified `fastjudge.languages` object
- `${outputFile}` variable removed — use `${executableFile}` in compile/run args

---

## [0.2.0] - 2026-02-22

### Added
- Competitive Companion integration for fetching problems and test cases
- "Stop" and "Delete" buttons for test cases, utilizing `AbortController` to cancel running processes
- Keyboard shortcuts for common actions: Run All, Add Test Case, Open Panel
- Independent test execution state per file, allowing simultaneous test runs across multiple files without interference

### Improved
- Execution handling now correctly parses signals (e.g., SIGTERM) and reports a `STOPPED` state
- Refactored internal architecture for more robust service injection

---

## [0.1.0] - 2026-01-31
- Modern UI redesign with Lucide-style SVG icons
- Virtual document provider for diff view (no temp files)
- Auto-collapse test cards on run
- Auto-expand test cards on error (WA, RE, TLE, CE, IE)
- Pass count badge in header (green for all passed, red for failures)
- Bottom toolbar with icon-only buttons
- Inline diff comparison with whitespace normalization
- "View Diff in Editor" button for VS Code native diff

### Changed
- Simplified test names to "TC 1, 2, 3..." (removed custom naming)
- Dark code boxes matching VS Code theme
- Colored left borders based on verdict

### Removed
- Test case name editing functionality
- Temp file creation for diff view

---

## [0.0.1] - Initial Development

### Core Features
- **Multi-language support**: C++, Python, Java, JavaScript
- **Test case management**: Create, edit, delete, and persist test cases per source file
- **Code execution**: Compile and run code with configurable time limits
- **Verdict system**: AC, WA, TLE, RE, CE, IE, PENDING, RUNNING states
- **Output comparison**: Exact, trim whitespace, or ignore all whitespace modes

### Execution Engine
- **Compiler service**: Language-specific compilation with customizable args
- **Executor service**: Process spawning with timeout enforcement
- **Judge service**: Output comparison and verdict determination
- **Execution modes**: Sequential, sequential-live, and parallel test running

### Storage & Persistence
- **Test case storage**: JSON-based persistence in `.fastjudge/` directory
- **Result storage**: Persist test results with configurable retention (1-30 days)
- **Auto-cleanup**: Automatic removal of old results based on retention settings

### Configuration Options
- `fastjudge.general.timeLimitMs`: Execution time limit (100-60000ms, default: 2000)
- `fastjudge.general.comparisonMode`: Output comparison mode (exact/trim/ignoreWhitespace)
- `fastjudge.general.executionMode`: Test execution strategy
- `fastjudge.general.resultRetentionDays`: Days to keep results (1-30, default: 7)
- `fastjudge.language.cpp.command`: C++ compiler (default: g++)
- `fastjudge.language.cpp.args`: Compiler flags (default: -O2, -std=c++17, -Wall)
- `fastjudge.language.python.command`: Python interpreter
- `fastjudge.language.java.command`: Java compiler
- `fastjudge.language.java.runCommand`: Java runtime
- `fastjudge.language.javascript.command`: Node.js command

### VS Code Integration
- Activity bar icon for quick access
- Webview panel for test case UI
- Editor title button for "Run All Tests"
- Commands: `fastjudge.openPanel`, `fastjudge.runAll`, `fastjudge.addTestCase`
- Automatic activation for supported languages