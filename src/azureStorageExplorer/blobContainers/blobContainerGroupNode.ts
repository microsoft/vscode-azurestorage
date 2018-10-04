/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from "../../components/storageWrappers";
import { BlobContainerTreeItem } from "./blobContainerNode";

export class BlobContainerGroupTreeItem extends AzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    constructor(
        parent: AzureParentTreeItem,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly key: StorageAccountKeyWrapper) {
        super(parent);
    }

    public label: string = "Blob Containers";
    public contextValue: string = 'azureBlobContainerGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let containers = await this.listContainers(this._continuationToken);
        let { entries, continuationToken } = containers;
        this._continuationToken = continuationToken;

        return entries.map((container: azureStorage.BlobService.ContainerResult) => {
            return new BlobContainerTreeItem(this, container, this.storageAccount, this.key);
        });
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private listContainers(currentToken: azureStorage.common.ContinuationToken | undefined): Promise<azureStorage.BlobService.ListContainerResult> {
        return new Promise((resolve, reject) => {
            let blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
            // currentToken argument typed incorrectly in SDK
            blobService.listContainersSegmented(<azureStorage.common.ContinuationToken>currentToken, { maxResults: 50 }, (err?: Error, result?: azureStorage.BlobService.ListContainerResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem> {
        const containerName = await vscode.window.showInputBox({
            placeHolder: 'Enter a name for the new blob container',
            validateInput: BlobContainerGroupTreeItem.validateContainerName
        });

        if (containerName) {
            return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
                showCreatingTreeItem(containerName);
                progress.report({ message: `Azure Storage: Creating blob container '${containerName}'` });
                const container = await this.createBlobContainer(containerName);
                return new BlobContainerTreeItem(this, container, this.storageAccount, this.key);
            });
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createBlobContainer(name: string): Promise<azureStorage.BlobService.ContainerResult> {
        return new Promise((resolve, reject) => {
            let blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
            blobService.createContainer(name, (err?: Error, result?: azureStorage.BlobService.ContainerResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private static validateContainerName(name: string): string | undefined | null {
        const validLength = { min: 3, max: 63 };

        if (!name) {
            return "Container name cannot be empty";
        }
        if (name.indexOf(" ") >= 0) {
            return "Container name cannot contain spaces";
        }
        if (name.length < validLength.min || name.length > validLength.max) {
            return `Container name must contain between ${validLength.min} and ${validLength.max} characters`;
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
            return 'Container name can only contain lowercase letters, numbers and hyphens';
        }
        if (/--/.test(name)) {
            return 'Container name cannot contain two hyphens in a row';
        }
        if (/(^-)|(-$)/.test(name)) {
            return 'Container name cannot begin or end with a hyphen';
        }

        return undefined;
    }
}
