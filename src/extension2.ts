import * as vscode from 'vscode';
import * as path from 'path';
const soundPlay = require('sound-play');

let previousErrors = 0;
let combo = 0;
let initialized = false;
let debounceTimer: NodeJS.Timeout | undefined;

export function activate2(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand('helloworld.testSound', () => {
    const filePath = path.join(context.extensionPath, 'media', 'error.wav');
    console.log("Trying to play:", filePath);
    soundPlay.play(filePath)
      .then(() => console.log("Sound played successfully"))
      .catch((err: any) => console.error("Sound failed:", err));
  });
  vscode.window.showInformationMessage("Sound Effects Extension loaded!");
  console.log("Extension activated");

  vscode.languages.onDidChangeDiagnostics(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const diagnostics = vscode.languages.getDiagnostics();
      let currentErrors = 0;

      for (const [uri, problems] of diagnostics) {
        for (const p of problems) {
          if (p.severity === vscode.DiagnosticSeverity.Error) {
            currentErrors++;
          }
        }
      }

      if (!initialized) {
        previousErrors = currentErrors;
        initialized = true;
        return;
      }

      if (currentErrors > previousErrors) {
        playSound(context, "error.wav");
        combo = 0;
        vscode.window.showInformationMessage("Error detected!");
      }

      if (currentErrors < previousErrors) {
        combo += (previousErrors - currentErrors);
        if (combo >= 3 ) {
          combo = 0;
          playSound(context, "combo.mp3");
          vscode.window.showInformationMessage(`🔥 Combo x${combo}!`);
        } else {
          playSound(context, "fix.mp3");
          vscode.window.showInformationMessage("Error fixed!");
        }
      }

      previousErrors = currentErrors;
    }, 1500);
  });
  function playSound(context: vscode.ExtensionContext, file: string) {
  const filePath = path.join(context.extensionPath, 'media', file);
  soundPlay.play(filePath).catch((err: any) => {
    console.error("Failed to play sound:", err);
  });
}
}

// function playSound(context: vscode.ExtensionContext, file: string) {
//   const filePath = path.join(context.extensionPath, 'media', file);
//   soundPlay.play(filePath).catch((err: any) => {
//     console.error("Failed to play sound:", err);
//   });
// }

export function deactivate() { }