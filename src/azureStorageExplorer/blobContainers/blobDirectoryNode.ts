/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, IActionContext, ICreateChildImplContext, parseError } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem, IExistingBlobContext } from "./blobContainerNode";
import { BlobTreeItem, ISuppressMessageContext } from "./blobNode";
import { createChildAsNewBlockBlob, IBlobContainerCreateChildContext, loadMoreBlobChildren } from './blobUtils';

export class BlobDirectoryTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: string | undefined;

    public static contextValue: string = 'azureBlobDirectory';
    public contextValue: string = 'azureBlobDirectory';

    public fullPath: string = path.posix.join(this.parentPath, this.directory.name);
    public dirPath: string = `${this.fullPath}/`;
    public label: string = this.directory.name;

    constructor(
        parent: BlobContainerTreeItem | BlobDirectoryTreeItem,
        public readonly parentPath: string,
        public readonly directory: azureStorageBlob.BlobPrefix, // directory.name should not include parent path
        public container: azureStorageBlob.ContainerItem) {
        super(parent);
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let { children, continuationToken } = await loadMoreBlobChildren(this, this._continuationToken);
        this._continuationToken = continuationToken;
        return children;
    }

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingBlobContext> & IBlobContainerCreateChildContext): Promise<BlobTreeItem | BlobDirectoryTreeItem> {
        if (context.childType === BlobTreeItem.contextValue) {
            return await createChildAsNewBlockBlob(this, context);
        } else {
            return new BlobDirectoryTreeItem(this, this.dirPath, { name: context.childName }, this.container);
        }
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
            progress.report({ message: `Deleting directory ${this.directory.name}` });
            let errors: boolean = await this.deleteFolder(context);

            if (errors) {
                ext.outputChannel.appendLine('Please refresh the viewlet to see the changes made.');

                const viewOutput: vscode.MessageItem = { title: 'View Errors' };
                const errorMessage: string = `Errors occurred when deleting "${this.directory.name}".`;
                vscode.window.showWarningMessage(errorMessage, viewOutput).then(async (result: vscode.MessageItem | undefined) => {
                    if (result === viewOutput) {
                        ext.outputChannel.show();
                    }
                });

                throw new Error(`Errors occurred when deleting "${this.directory.name}".`);
            }
        });
    }

    private async deleteFolder(context: IActionContext): Promise<boolean> {
        let dirPaths: BlobDirectoryTreeItem[] = [];
        // tslint:disable-next-line: no-var-self
        let dirPath: BlobDirectoryTreeItem | undefined = this;
        let errors: boolean = false;

        // tslint:disable-next-line: strict-boolean-expressions
        while (dirPath) {
            let children = await dirPath.getCachedChildren(context);
            for (const child of children) {
                if (child instanceof BlobTreeItem) {
                    try {
                        await child.deleteTreeItemImpl(<ISuppressMessageContext>{ ...context, suppressMessage: true });
                    } catch (error) {
                        ext.outputChannel.appendLine(`Cannot delete ${child.fullPath}. ${parseError(error).message}`);
                        errors = true;
                    }
                } else if (child instanceof BlobDirectoryTreeItem) {
                    dirPaths.push(child);
                }
            }

            dirPath = dirPaths.pop();
        }

        return errors;
    }
}
