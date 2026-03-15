import * as vscode from 'vscode';
import { activate2 as activateSecond } from './extension2';
import * as path from 'path';
const soundPlay = require('sound-play');

let previousErrors = 0;
let combo = 0;
let initialized = false;
let debounceTimer: NodeJS.Timeout | undefined;

let currentInset: any = undefined;
let stickyInterval: NodeJS.Timeout | undefined;
let lastLine = -1;
let pinnedCode = '';
let isExpanded = true;
let isRecreating = false;

export function activate(context: vscode.ExtensionContext) {
  activateSecond(context);
  const pinCommand = vscode.commands.registerCommand(
    'pin.function',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage('Highlight code to pin it!');
        return;
      }

      pinnedCode = selection;
      isExpanded = true;

      if (stickyInterval) clearInterval(stickyInterval);
      if (currentInset) {
        currentInset.dispose();
        currentInset = undefined;
      }

      lastLine = editor.visibleRanges[0].start.line + 1;
      createInset(lastLine);

      stickyInterval = setInterval(() => {
        if (isRecreating) return;
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !pinnedCode) return;

        const currentLine = activeEditor.visibleRanges[0]?.start.line ?? 0;

        // Recreate if line changed OR if inset was disposed by VS Code
        if (
          currentLine !== lastLine ||
          !currentInset ||
          currentInset.webview === undefined
        ) {
          lastLine = currentLine;
          createInset(currentLine);
        }
      }, 16);
    },
  );

  const unpinCommand = vscode.commands.registerCommand('pin.unpinAll', () => {
    if (stickyInterval) {
      clearInterval(stickyInterval);
      stickyInterval = undefined;
    }
    if (currentInset) {
      currentInset.dispose();
      currentInset = undefined;
    }
    pinnedCode = '';
    lastLine = -1;
    isExpanded = true;
  });

  context.subscriptions.push(pinCommand, unpinCommand);
}

function createInset(line: number) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !pinnedCode) return;

  isRecreating = true;
  if (currentInset) {
    try {
      currentInset.dispose();
    } catch (_) {}
    currentInset = undefined;
  }

  if (!(vscode.window as any).createWebviewTextEditorInset) {
    vscode.window.showErrorMessage('EditorInset API not available.');
    isRecreating = false;
    return;
  }

  const codeLines = pinnedCode.split('\n').length;
  const height = isExpanded ? codeLines + 3 : 2;

  try {
    currentInset = (vscode.window as any).createWebviewTextEditorInset(
      editor,
      line - 1,
      height,
      { enableScripts: true },
    );
  } catch (e) {
    isRecreating = false;
    return;
  }

  currentInset.webview.html = getStickyHTML(pinnedCode, isExpanded);

  const capturedInset = currentInset;
  capturedInset.webview.onDidReceiveMessage((msg: any) => {
    if (capturedInset !== currentInset) return;

    const newExpanded = msg.command === 'expand';
    if (newExpanded === isExpanded) return;

    isExpanded = newExpanded;
    isRecreating = true;
    if (currentInset) {
      try {
        currentInset.dispose();
      } catch (_) {}
      currentInset = undefined;
    }
    createInset(lastLine);
  });

  setTimeout(() => {
    isRecreating = false;
  }, 300);
}

function getStickyHTML(code: string, expanded: boolean) {
  const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const display = expanded ? 'block' : 'none';
  const btnText = expanded ? '[ - ] Collapse' : '[ + ] Expand';
  const pinText = safeCode.split('\n')[0];

  return `<!DOCTYPE html><html>
    <head><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: var(--vscode-editor-lineHighlightBackground);
            border-bottom: 1px solid var(--vscode-focusBorder);
            font-family: sans-serif;
            overflow: hidden;
        }
        #bar {
            cursor: pointer;
            padding: 4px 10px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            color: var(--vscode-editor-foreground);
            user-select: none;
        }
        #bar:hover { background: var(--vscode-list-hoverBackground); }
        #codeBox {
            display: ${display};
            padding: 8px 12px;
            background: var(--vscode-editor-background);
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            overflow: auto;
            white-space: pre;
            color: var(--vscode-editor-foreground);
        }
    </style></head>
    <body>
        <div id="bar">
            <span>📌 ${pinText}</span>
            <span id="btn">${btnText}</span>
        </div>
        <pre id="codeBox"><code>${safeCode}</code></pre>
        <script>
            const vscode = acquireVsCodeApi();

            // Restore state so clicking always works regardless of recreate
            let expanded = ${expanded};

            document.getElementById('bar').onclick = () => {
                expanded = !expanded;
                document.getElementById('codeBox').style.display = expanded ? 'block' : 'none';
                document.getElementById('btn').innerText = expanded ? '[ - ] Collapse' : '[ + ] Expand';
                vscode.postMessage({ command: expanded ? 'expand' : 'collapse' });
            };
        </script>
    </body></html>`;
}

export function deactivate() {
  if (stickyInterval) clearInterval(stickyInterval);
  if (currentInset) currentInset.dispose();
}
