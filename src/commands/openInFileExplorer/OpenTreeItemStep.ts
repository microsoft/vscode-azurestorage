/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
import { commands, Uri, workspace, WorkspaceFolder } from 'vscode';
import { AzureStorageFS } from '../../AzureStorageFS';
import { BlobContainerFS } from '../../BlobContainerFS';
import { nonNullProp } from "../../utils/nonNull";
import { IOpenInFileExplorerWizardContext } from './IOpenInFileExplorerWizardContext';

export class OpenTreeItemStep extends AzureWizardExecuteStep<IOpenInFileExplorerWizardContext> {
    public priority: number = 250;
    public hideStepCount: boolean = true;

    public async execute(context: IOpenInFileExplorerWizardContext): Promise<void> {
        const openFolders: readonly WorkspaceFolder[] = workspace.workspaceFolders || [];
        if (context.openBehavior === 'AddToWorkspace' && openFolders.length === 0) {
            // no point in adding to an empty workspace
            context.openBehavior = 'OpenInCurrentWindow';
        }

        const ti = nonNullProp(context, 'treeItem');
        const uri: Uri = AzureStorageFS.idToUri(nonNullProp(context, 'treeItem').fullId);

        const storageAccountId = ti.root.storageAccountId;
        const serviceType = 'container' in ti ? "blob" : "fileShare";
        const containerName = 'container' in ti ? ti.container.name : ti.shareName;
        let uri3: Uri;
        if (serviceType === "blob") {
            uri3 = BlobContainerFS.constructUri(containerName, storageAccountId);
        } else {
            // @todo: Use static methods from FileShareFS
            uri3 = Uri.parse(`azurestorage:///${containerName}?resourceId=${storageAccountId}&name=${containerName}`);
        }

        if (context.openBehavior === 'AddToWorkspace') {
            workspace.updateWorkspaceFolders(openFolders.length, 0, { uri: uri });
            await commands.executeCommand('workbench.view.explorer');
        } else {
            try {
                await commands.executeCommand('vscode.openFolder', uri3, context.openBehavior === 'OpenInNewWindow' /* forceNewWindow */);
            } catch (error) {
                console.log(error);
                throw error;
            }
        }
    }

    public shouldExecute(context: IOpenInFileExplorerWizardContext): boolean {
        return !!context.openBehavior && context.openBehavior !== 'AlreadyOpen' && context.openBehavior !== 'DontOpen';
    }
}
