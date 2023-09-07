/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, IActionContext, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { extensionPrefix } from '../constants';

export async function showWorkspaceFoldersQuickPick(placeHolderString: string, context: IActionContext, subPathSetting: string | undefined): Promise<string> {
    const folderQuickPickItems: IAzureQuickPickItem<string | undefined>[] = [];
    if (vscode.workspace.workspaceFolders) {
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            {
                let fsPath: string = workspaceFolder.uri.fsPath;
                if (subPathSetting) {
                    const subpath: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, workspaceFolder.uri).get(subPathSetting);
                    if (subpath) {
                        fsPath = path.join(fsPath, subpath);
                    }
                }

                folderQuickPickItems.push({
                    label: path.basename(fsPath),
                    description: fsPath,
                    data: fsPath
                });

                // If the workspace has any of build, dist, or out, show those as well
                const buildDefaultPaths = ["build", "dist", "out"];
                for (const defaultPath of buildDefaultPaths) {
                    const buildPath: string = path.join(fsPath, defaultPath);
                    if (await AzExtFsExtra.pathExists(buildPath)) {
                        folderQuickPickItems.push({
                            label: path.basename(buildPath),
                            description: buildPath,
                            data: buildPath
                        });
                    }
                }

            }
        }
    }

    folderQuickPickItems.unshift({ label: '$(file-directory) Browse...', description: '', data: undefined });

    const folderQuickPickOption = { placeHolder: placeHolderString };
    context.telemetry.properties.cancelStep = 'showWorkspaceFolders';
    const pickedItem = await context.ui.showQuickPick(folderQuickPickItems, folderQuickPickOption);

    if (!pickedItem.data) {
        context.telemetry.properties.cancelStep = 'showWorkspaceFoldersBrowse';
        const browseResult = await context.ui.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
        });

        context.telemetry.properties.cancelStep = undefined;
        return browseResult[0].fsPath;
    } else {
        context.telemetry.properties.cancelStep = undefined;
        return pickedItem.data;
    }
}
