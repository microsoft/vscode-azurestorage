/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, GenericTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { createBlobContainerClient } from '../../utils/blobUtils';
import { AttachedStorageAccountTreeItem } from "../AttachedStorageAccountTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";

export class BlobContainerGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: string | undefined;

    public label: string = "Blob Containers";
    public readonly childTypeLabel: string = "Blob Container";
    public static contextValue: string = 'azureBlobContainerGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureBlobContainer.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureBlobContainer.svg')
    };

    public get description(): string {
        return this.active ? '' : 'stopped';
    }

    public get contextValue(): string {
        return `${BlobContainerGroupTreeItem.contextValue}${this.active ? '' : 'Stopped'}`;
    }

    public constructor(
        parent: StorageAccountTreeItem | AttachedStorageAccountTreeItem,
        public active: boolean = true) {
        super(parent);
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        if (!this.active) {
            return [new GenericTreeItem(this, {
                contextValue: 'startBlobEmulator',
                label: 'Start Blob Emulator',
                commandId: 'azureStorage.startBlobEmulator',
                includeInTreeItemPicker: false
            })];
        }

        let containersResponse: azureStorageBlob.ListContainersSegmentResponse = await this.listContainers(this._continuationToken);
        this._continuationToken = containersResponse.continuationToken;

        const result: AzExtTreeItem[] = await Promise.all(containersResponse.containerItems.map(async (container: azureStorageBlob.ContainerItem) => {
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
        }));

        return result;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listContainers(continuationToken?: string): Promise<azureStorageBlob.ListContainersSegmentResponse> {
        const blobServiceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        let response: AsyncIterableIterator<azureStorageBlob.ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize: maxPageSize });

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

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === BlobContainerTreeItem.contextValue;
    }

    private async createBlobContainer(name: string): Promise<azureStorageBlob.ContainerItem> {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, name);
        await containerClient.create();

        let containersResponse: azureStorageBlob.ListContainersSegmentResponse = await this.listContainers();
        let createdContainer: azureStorageBlob.ContainerItem | undefined;
        for (let container of containersResponse.containerItems) {
            if (container.name === name) {
                createdContainer = container;
                break;
            }
        }

        if (!createdContainer) {
            throw new Error(`Could not create container ${name}`);
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
