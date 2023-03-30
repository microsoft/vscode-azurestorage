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

        const treeItem = nonNullProp(context, 'treeItem');

        if (!AzureStorageFS.isAttachedAccount(treeItem)) {
            const storageAccountId = treeItem.root.storageAccountId;
            const serviceType = 'container' in treeItem ? "blob" : "fileShare";
            const containerName = 'container' in treeItem ? treeItem.container.name : treeItem.shareName;
            let uriByService: Uri;
            if (serviceType === "blob") {
                uriByService = BlobContainerFS.constructUri(containerName, storageAccountId);
            } else {
                // @todo: Use static methods from FileShareFS
                uriByService = Uri.parse(`azurestorage:///${containerName}?resourceId=${storageAccountId}&name=${containerName}`);
            }

            if (context.openBehavior === 'AddToWorkspace') {
                workspace.updateWorkspaceFolders(openFolders.length, 0, { uri: uriByService });
                await commands.executeCommand('workbench.view.explorer');
            } else {
                await commands.executeCommand('vscode.openFolder', uriByService, context.openBehavior === 'OpenInNewWindow' /* forceNewWindow */);
            }
        } else {
            // @todo: Support attached accounts in BlobContainerFS
            const uri = AzureStorageFS.idToUri(nonNullProp(context, 'treeItem').fullId);
            if (context.openBehavior === 'AddToWorkspace') {
                // @todo: Test if this should the BlobContainerFS uri or the original uri
                workspace.updateWorkspaceFolders(openFolders.length, 0, { uri: uri });
                await commands.executeCommand('workbench.view.explorer');
            } else {
                await commands.executeCommand('vscode.openFolder', uri, context.openBehavior === 'OpenInNewWindow' /* forceNewWindow */);
            }
        }
    }

    public shouldExecute(context: IOpenInFileExplorerWizardContext): boolean {
        return !!context.openBehavior && context.openBehavior !== 'AlreadyOpen' && context.openBehavior !== 'DontOpen';
    }
}
