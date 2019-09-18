/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem } from "./blobContainerNode";

export class BlobContainerGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    public label: string = "Blob Containers";
    public readonly childTypeLabel: string = "Blob Container";
    public static contextValue: string = 'azureBlobContainerGroup';
    public contextValue: string = BlobContainerGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureBlobContainer.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureBlobContainer.svg')
    };

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let containers = await this.listContainers(this._continuationToken);
        let { entries, continuationToken } = containers;
        this._continuationToken = continuationToken;

        const result: AzExtTreeItem[] = await Promise.all(entries.map(async (container: azureStorage.BlobService.ContainerResult) => {
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
        }));

        return result;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listContainers(currentToken: azureStorage.common.ContinuationToken | undefined): Promise<azureStorage.BlobService.ListContainerResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.root.createBlobService();
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

    public async createChildImpl(context: ICreateChildImplContext): Promise<BlobContainerTreeItem> {
        const containerName = await ext.ui.showInputBox({
            placeHolder: 'Enter a name for the new blob container',
            validateInput: BlobContainerGroupTreeItem.validateContainerName
        });

        if (containerName) {
            return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(containerName);
                progress.report({ message: `Azure Storage: Creating blob container '${containerName}'` });
                const container = await this.createBlobContainer(containerName);
                return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
            });
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createBlobContainer(name: string): Promise<azureStorage.BlobService.ContainerResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.root.createBlobService();
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
