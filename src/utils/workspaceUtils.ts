/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IAzureQuickPickItem, IAzureUserInput } from 'vscode-azureextensionui';
import { localize } from './localize';

export function getSingleRootWorkspace(): vscode.WorkspaceFolder | undefined {
    // if this is a multi-root workspace, return undefined
    return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1 ? vscode.workspace.workspaceFolders[0] : undefined;
}

export async function selectWorkspaceItem(ui: IAzureUserInput, placeHolder: string, options: vscode.OpenDialogOptions, getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined | Promise<string | undefined>): Promise<string> {
    let folder: IAzureQuickPickItem<string | undefined> | undefined;
    if (vscode.workspace.workspaceFolders) {
        const folderPicks: IAzureQuickPickItem<string | undefined>[] = await Promise.all(vscode.workspace.workspaceFolders.map(async (f: vscode.WorkspaceFolder) => {
            let subpath: string | undefined;
            if (getSubPath) {
                subpath = await getSubPath(f);
            }

            const fsPath: string = subpath ? path.join(f.uri.fsPath, subpath) : f.uri.fsPath;
            return { label: path.basename(fsPath), description: fsPath, data: fsPath };
        }));

        folderPicks.push({ label: localize('browse', '$(file-directory) Browse...'), description: '', data: undefined });
        folder = await ui.showQuickPick(folderPicks, { placeHolder });
    }

    return folder && folder.data ? folder.data : (await ui.showOpenDialog(options))[0].fsPath;
}
