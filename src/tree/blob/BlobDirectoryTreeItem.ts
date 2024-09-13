/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AccountSASSignatureValues, BlobClient, ContainerItem } from "@azure/storage-blob";

import { polyfill } from '../../polyfill.worker';
polyfill();

import { AccountSASPermissions } from '@azure/storage-blob';

import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, DeleteConfirmationStep, ICreateChildImplContext, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { DeleteBlobDirectoryStep } from '../../commands/deleteBlobDirectory/DeleteBlobDirectoryStep';
import { IDeleteBlobDirectoryWizardContext } from "../../commands/deleteBlobDirectory/IDeleteBlobDirectoryWizardContext";
import { threeDaysInMS } from "../../constants";
import { createActivityContext } from "../../utils/activityUtils";
import { IBlobContainerCreateChildContext, createBlobClient, createChildAsNewBlockBlob, loadMoreBlobChildren } from '../../utils/blobUtils';
import { copyAndShowToast } from "../../utils/copyAndShowToast";
import { localize } from "../../utils/localize";
import { ICopyUrl } from "../ICopyUrl";
import { IStorageRoot } from "../IStorageRoot";
import { ITransferSrcOrDstTreeItem } from "../ITransferSrcOrDstTreeItem";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";
import { BlobTreeItem, ISuppressMessageContext } from "./BlobTreeItem";

export class BlobDirectoryTreeItem extends AzExtParentTreeItem implements ICopyUrl, ITransferSrcOrDstTreeItem {
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

    constructor(
        parent: BlobContainerTreeItem | BlobDirectoryTreeItem,
        dirPath: string,
        public container: ContainerItem,
        public readonly resourceUri: string) {
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

    public get transferSasToken(): string {
        const accountSASSignatureValues: AccountSASSignatureValues = {
            expiresOn: new Date(Date.now() + threeDaysInMS),
            permissions: AccountSASPermissions.parse("rwl"), // read, write, list
            services: 'b', // blob
            resourceTypes: 'co' // container, object
        };
        return this.root.generateSasToken(accountSASSignatureValues);
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
            child = new BlobDirectoryTreeItem(this, path.posix.join(this.dirPath, context.childName), this.container, this.resourceUri);
        }
        AzureStorageFS.fireCreateEvent(child);
        return child;
    }

    public async copyUrl(): Promise<void> {
        const blobClient: BlobClient = await createBlobClient(this.root, this.container.name, this.dirPath);
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

        if (!context.suppressMessage) {
            await wizard.prompt();
        }
        await wizard.execute();

        AzureStorageFS.fireDeleteEvent(this);
    }
}
