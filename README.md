# FastJudge

Lightning-fast local judge for compiling, running, and testing code across languages directly in VS Code.

## Overview

FastJudge is a powerful VS Code extension designed to streamline the code testing process. It provides an integrated, robust environment right within your editor, eliminating the hassle of context switching. It is built specifically for competitive programmers fetching problems from online judges, students practicing algorithms, and developers needing a quick scratchpad for logic verification.

## Key Features

- **Multi-language Support:** Out-of-the-box support for C++, Python, Java, and JavaScript.
- **Competitive Companion Integration:** Automatically fetches problem test cases, time limits, and memory limits directly from supported online judges.
- **Advanced Execution Engine:**
  - **Sequential Live:** Run tests sequentially with real-time UI updates.
  - **Parallel Execution:** Run all test cases concurrently for maximum speed.
  - **Sequential Batch:** Traditional batch execution for simple tests.
- **Independent Execution State:** Run tests across multiple competitive programming files simultaneously without interference.
- **Process Control:** Cancel hanging or infinite-looping test cases on the fly with "Stop" buttons, powered by native `AbortController`.
- **Modern UI:** Clean, intuitive Webview panel to manage test cases, view results (AC, WA, TLE, RE, CE), and inspect visual diffs.


## Installation

1. Open VS Code.
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac).
3. Search for **FastJudge** and click Install.
4. *Alternatively, download the `.vsix` file from the [releases page](https://github.com/shrut-vanpariya/fastjudge) and install it manually.*

### Prerequisites

FastJudge relies on your local system's compilers and interpreters. Ensure you have the appropriate tools installed and added to your system's `PATH`:
- **C++:** `g++`
- **Python:** `python` (or `python3`)
- **Java:** `javac` and `java`
- **JavaScript:** `node`

## Configuration

Customize FastJudge to fit your workflow in your `settings.json` or through the VS Code Settings UI (`Ctrl+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `fastjudge.general.timeLimitMs` | `2000` | Time limit for code execution (100 - 60000ms). |
| `fastjudge.general.comparisonMode` | `trim` | Mode for output comparison: `exact`, `trim` (ignores trailing whitespace), or `ignoreWhitespace`. |
| `fastjudge.general.executionMode` | `sequential-live` | Mode for running tests: `sequential`, `sequential-live`, or `parallel`. |
| `fastjudge.general.resultRetentionDays` | `7` | Days to keep test results before they are auto-cleaned. |
| `fastjudge.companion.enabled` | `true` | Enable Competitive Companion server integration. |
| `fastjudge.companion.port` | `27121` | Port for the companion server (default CP Helper port). |

*Language-specific commands (e.g., `fastjudge.language.cpp.command`) can also be customized if your environment uses non-standard aliases.*

## Usage Examples

1. **Open a Supported File:** Open any `.cpp`, `.py`, `.java`, or `.js` file.
2. **Open FastJudge Panel:** Press `Ctrl+F11` (or click the beaker icon in the Activity Bar) to open the Test Cases panel.
3. **Add a Test Case:** Press `Ctrl+F10` or click the `+` icon in the panel. Enter your expected input and output.
4. **Run Tests:** Press `Ctrl+F9` or click the "Run All Tests" (Play icon) in the editor title bar or within the panel.
5. **Fetch from Online Judges:** Click the "extension" icon in your browser (via [Competitive Companion](https://github.com/jmerle/competitive-companion)) while on a problem page. FastJudge will automatically import the data to your active file.

## Project Structure

```text
fastjudge/
├── src/
│   ├── core/           # Core execution engine, compilers, and judging logic
│   ├── extension.ts    # VS Code extension entry point
│   └── ui/
│       ├── webview/    # React-based Webview application for the Test Cases panel
│       └── ...
├── package.json        # Extension manifest, configurations, and commands
└── tsconfig.json       # TypeScript configuration
```

## Development Workflow

To contribute or build FastJudge locally:

1. **Clone the repository:** 
   ```bash
   git clone https://github.com/shrut-vanpariya/fastjudge.git
   ```
2. **Install dependencies:** 
   ```bash
   pnpm install
   ```
3. **Compile the extension:** 
   ```bash
   pnpm run watch
   ```
   *(In a separate terminal)*
   ```bash
   pnpm run watch:webview
   ```
4. **Run the extension:** Press `F5` in VS Code to launch an Extension Development Host.
5. **Run tests:** 
   ```bash
   pnpm test
   ```
6. **Linting:** 
   ```bash
   pnpm run lint
   ```

### Contribution Guidelines

1. Fork the repository and create your feature branch: `git checkout -b feature/my-new-feature`
2. Commit your changes: `git commit -m 'feat: add some feature'`
3. Push to the branch: `git push origin feature/my-new-feature`
4. Submit a Pull Request.

*Please ensure your code passes all lint checks and tests before submitting.*

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
