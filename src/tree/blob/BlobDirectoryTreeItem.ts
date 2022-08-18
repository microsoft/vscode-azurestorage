/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, DeleteConfirmationStep, ICreateChildImplContext, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { DeleteBlobDirectoryStep } from '../../commands/deleteBlobDirectory/DeleteBlobDirectoryStep';
import { IDeleteBlobDirectoryWizardContext } from "../../commands/deleteBlobDirectory/IDeleteBlobDirectoryWizardContext";
import { createActivityContext } from "../../utils/activityUtils";
import { createBlobClient, createChildAsNewBlockBlob, IBlobContainerCreateChildContext, loadMoreBlobChildren } from '../../utils/blobUtils';
import { copyAndShowToast } from "../../utils/copyAndShowToast";
import { localize } from "../../utils/localize";
import { ICopyUrl } from "../ICopyUrl";
import { IDownloadableTreeItem } from "../IDownloadableTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";
import { BlobTreeItem, ISuppressMessageContext } from "./BlobTreeItem";

export class BlobDirectoryTreeItem extends AzExtParentTreeItem implements ICopyUrl, IDownloadableTreeItem {
    public static contextValue: string = 'azureBlobDirectory';
    public contextValue: string = BlobDirectoryTreeItem.contextValue;
    public parent: BlobContainerTreeItem | BlobDirectoryTreeItem;

    /**
     * The name (and only the name) of the directory
     */
    public readonly dirName: string;

    /**
     * The full path of the directory within the container. This will always end in `/`
     */
    public readonly dirPath: string;

    private _continuationToken: string | undefined;

    constructor(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, dirPath: string, public container: azureStorageBlob.ContainerItem) {
        super(parent);
        if (!dirPath.endsWith(path.posix.sep)) {
            dirPath += path.posix.sep;
        }

        this.dirPath = dirPath;
        this.dirName = path.basename(dirPath);
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public get remoteFilePath(): string {
        return this.dirPath;
    }

    public get label(): string {
        return this.dirName;
    }

    public get iconPath(): TreeItemIconPath {
        return new vscode.ThemeIcon('folder');
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        const { children, continuationToken } = await loadMoreBlobChildren(this, this._continuationToken);
        this._continuationToken = continuationToken;
        return children;
    }

    public async createChildImpl(context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.childType === BlobTreeItem.contextValue) {
            child = await createChildAsNewBlockBlob(this, context);
        } else {
            child = new BlobDirectoryTreeItem(this, path.posix.join(this.dirPath, context.childName), this.container);
        }
        AzureStorageFS.fireCreateEvent(child);
        return child;
    }

    public async copyUrl(): Promise<void> {
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.root, this.container.name, this.dirPath);
        const url = blobClient.url;
        await copyAndShowToast(url, 'Blob Directory URL');
    }

    public async deleteTreeItemImpl(context: ISuppressMessageContext): Promise<void> {
        const deletingDirectory: string = localize('deleteDirectory', 'Delete directory "{0}"', this.dirName);
        const wizardContext: IDeleteBlobDirectoryWizardContext = Object.assign(context, {
            dirName: this.dirName,
            blobDirectory: this,
            ...(await createActivityContext()),
            activityTitle: deletingDirectory
        });

        const message: string = localize('deleteBlobDir', "Are you sure you want to delete the blob directory '{0}' and all its contents?", this.dirName);
        const wizard = new AzureWizard(wizardContext, {
            promptSteps: [new DeleteConfirmationStep(message)],
            executeSteps: [new DeleteBlobDirectoryStep()]
        });

        if(!context.suppressMessage) {
            await wizard.prompt();
        }
        await wizard.execute();

        AzureStorageFS.fireDeleteEvent(this);
    }
}
