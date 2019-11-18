/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem } from "./blobContainerNode";

export class BlobContainerGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: string | undefined;

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

        let containersResponse = await this.listContainers(this._continuationToken);
        this._continuationToken = containersResponse.continuationToken;

        const result: AzExtTreeItem[] = await Promise.all(containersResponse.containerItems.map(async (container: azureStorageBlob.ContainerItem) => {
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
        }));

        return result;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listContainers(continuationToken?: string, maxPageSize: number = 50): Promise<azureStorageBlob.ListContainersSegmentResponse> {
        const blobServiceClient = this.root.createBlobServiceClient();
        let response = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize });

        // tslint:disable-next-line: no-unsafe-any
        return (await response.next()).value;
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
                return await BlobContainerTreeItem.createBlobContainerTreeItem(this, await this.createBlobContainer(containerName));
            });
        }

        throw new UserCancelledError();
    }

    private async createBlobContainer(name: string): Promise<azureStorageBlob.ContainerItem> {
        const containerClient = this.root.createBlobContainerClient(name);
        await containerClient.create();

        let containersResponse = await this.listContainers();
        let createdContainer: azureStorageBlob.ContainerItem | undefined;
        for (let container of containersResponse.containerItems) {
            if (container.name === name) {
                createdContainer = container;
                break;
            }
        }

        if (!createdContainer) {
            throw new Error(`Could not find container ${name}`);
        }

        return createdContainer;
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
