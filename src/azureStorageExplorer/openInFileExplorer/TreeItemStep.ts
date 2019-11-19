/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { BlobContainerTreeItem } from '../blobContainers/blobContainerNode';
import { FileShareTreeItem } from '../fileShares/fileShareNode';
import { IOpenInFileExplorerWizardContext } from './IOpenInFileExplorerWizardContext';

export class TreeItemStep extends AzureWizardPromptStep<IOpenInFileExplorerWizardContext> {
    public hideStepCount: boolean = true;

    public async prompt(context: IOpenInFileExplorerWizardContext): Promise<void> {
        if (!context.treeItem) {
            const placeHolder: string = localize('selectResourceTypeToOpenInFileExplorer', 'Select the resource type to open in File Explorer');

            let quickPicks: IAzureQuickPickItem<string>[] = [
                {
                    label: "Blob Container",
                    data: BlobContainerTreeItem.contextValue
                },
                {
                    label: "File Share",
                    data: FileShareTreeItem.contextValue
                }];
            let contextValue: string = (await ext.ui.showQuickPick(quickPicks, { placeHolder })).data;
            context.treeItem = <BlobContainerTreeItem | FileShareTreeItem>await ext.tree.showTreeItemPicker(contextValue, context);
        }
    }

    public shouldPrompt(context: IOpenInFileExplorerWizardContext): boolean {
        return !context.treeItem;
    }
}
