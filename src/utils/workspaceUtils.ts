import * as vscode from 'vscode';

export function getSingleRootWorkspace(): vscode.WorkspaceFolder | undefined {
    // if this is a multi-root workspace, return undefined
    return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1 ? vscode.workspace.workspaceFolders[0] : undefined;
}
