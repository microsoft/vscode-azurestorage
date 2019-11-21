/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Uri, workspace, WorkspaceFolder } from 'vscode';
import { AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { nonNullProp } from "../../utils/nonNull";
import { AzureStorageFS } from '../AzureStorageFS';
import { IOpenInFileExplorerWizardContext } from './IOpenInFileExplorerWizardContext';

export class OpenTreeItemStep extends AzureWizardExecuteStep<IOpenInFileExplorerWizardContext> {
    public priority: number = 250;
    public hideStepCount: boolean = true;

    public async execute(context: IOpenInFileExplorerWizardContext): Promise<void> {
        // tslint:disable-next-line:strict-boolean-expressions
        const openFolders: WorkspaceFolder[] = workspace.workspaceFolders || [];
        if (context.openBehavior === 'AddToWorkspace' && openFolders.length === 0) {
            // no point in adding to an empty workspace
            context.openBehavior = 'OpenInCurrentWindow';
        }

        const uri: Uri = AzureStorageFS.idToUri(nonNullProp(context, 'treeItem').fullId);
        if (context.openBehavior === 'AddToWorkspace') {
            workspace.updateWorkspaceFolders(openFolders.length, 0, { uri: uri });
            await commands.executeCommand('workbench.view.explorer');
        } else {
            await commands.executeCommand('vscode.openFolder', uri, context.openBehavior === 'OpenInNewWindow' /* forceNewWindow */);
        }
    }

    public shouldExecute(context: IOpenInFileExplorerWizardContext): boolean {
        return !!context.openBehavior && context.openBehavior !== 'AlreadyOpen' && context.openBehavior !== 'DontOpen';
    }
}
