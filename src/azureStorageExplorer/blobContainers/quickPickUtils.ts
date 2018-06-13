/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IAzureQuickPickItem, UserCancelledError, TelemetryProperties } from 'vscode-azureextensionui';

//asdf
export const extensionPrefix: string = 'azureStorage';

// asdf: move to common?
export async function showWorkspaceFoldersQuickPick(placeHolderString: string, telemetryProperties: TelemetryProperties, subPathSetting: string | undefined): Promise<string> {
    const folderQuickPickItems: IAzureQuickPickItem<string | undefined>[] = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map((value) => {
        {
            let fsPath: string = value.uri.fsPath;
            if (subPathSetting) {
                const subpath: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, value.uri).get(subPathSetting);
                if (subpath) {
                    fsPath = path.join(fsPath, subpath);
                }
            }

            return {
                label: path.basename(fsPath),
                description: fsPath,
                data: fsPath
            };
        }
    }) : [];

    folderQuickPickItems.unshift({ label: '$(file-directory) Browse...', description: '', data: undefined });

    const folderQuickPickOption = { placeHolder: placeHolderString };
    const pickedItem = await vscode.window.showQuickPick(folderQuickPickItems, folderQuickPickOption);

    if (!pickedItem) {
        telemetryProperties.cancelStep = 'showWorkspaceFolders';
        throw new UserCancelledError();
    } else if (!pickedItem.data) {
        const browseResult = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
        });

        if (!browseResult) {
            telemetryProperties.cancelStep = 'showWorkspaceFoldersBrowse';
            throw new UserCancelledError();
        }

        return browseResult[0].fsPath;
    } else {
        return pickedItem.data;
    }
}
