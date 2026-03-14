import * as vscode from 'vscode';

function secondCommand() {
  vscode.window.showInformationMessage('This is from the second file');
}

module.exports = {
  secondCommand,
};
