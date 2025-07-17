/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobServiceClient, ContainerClient, ContainerItem, ListContainersSegmentResponse, ServiceListContainersSegmentResponse } from '@azure/storage-blob';

import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, GenericTreeItem, IActionContext, ICreateChildImplContext, parseError } from '@microsoft/vscode-azext-utils';

import { ListContainerItem } from '@azure/arm-storage';
import { getResourceGroupFromId, uiUtils } from '@microsoft/vscode-azext-azureutils';
import { ResolvedAppResourceTreeItem } from "@microsoft/vscode-azext-utils/hostapi";
import * as path from 'path';
import * as vscode from 'vscode';
import { ResolvedStorageAccount } from "../../StorageAccountResolver";
import { getResourcesPath, maxPageSize } from "../../constants";
import { createBlobContainerClient } from '../../utils/blobUtils';
import { localize } from "../../utils/localize";
import { nonNullProp } from "../../utils/nonNull";
import { AttachedStorageAccountTreeItem } from "../AttachedStorageAccountTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { IStorageTreeItem } from "../IStorageTreeItem";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";
import { BlobContainerNameStep } from "./createBlobContainer/BlobContainerNameStep";

export class BlobContainerGroupTreeItem extends AzExtParentTreeItem implements IStorageTreeItem {
    private _continuationToken: string | undefined;

    public label: string = "Blob Containers";
    public readonly childTypeLabel: string = "Blob Container";
    public static contextValue: string = 'azureBlobContainerGroup';
    public contextValue: string = BlobContainerGroupTreeItem.contextValue;
    public parent: (StorageAccountTreeItem & AzExtParentTreeItem) | AttachedStorageAccountTreeItem;

    public constructor(parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureBlobContainer.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureBlobContainer.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        const isAttached = this.fullId.startsWith("/attachedStorageAccounts/")

        let containersResponse: ListContainerItem[] | ListContainersSegmentResponse;
        try {
            containersResponse = await this.listContainers(isAttached, this._continuationToken);
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.root.isEmulated && errorType === 'ECONNREFUSED') {
                return [new GenericTreeItem(this, {
                    contextValue: 'startBlobEmulator',
                    label: 'Start Blob Emulator',
                    commandId: 'azureStorage.startBlobEmulator',
                    includeInTreeItemPicker: false
                })];
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportBlobs', 'This storage account does not support blobs.'));
            } else {
                throw error;
            }
        }

        return await this.getContainerItems(containersResponse, isAttached);
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listContainers(isAttached: boolean, continuationToken?: string): Promise<ListContainerItem[] | ListContainersSegmentResponse> {
        return isAttached ? await this.listAttachedContainers(continuationToken) : await this.listAzureContainers();
    }

    async listAttachedContainers(continuationToken?: string): Promise<ListContainersSegmentResponse> {
        const blobServiceClient: BlobServiceClient = await this.root.createBlobServiceClient();
        const response: AsyncIterableIterator<ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize: maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }

    async listAzureContainers(): Promise<ListContainerItem[]> {
        const storageAccountName = this.root.storageAccountName;
        const resourceGroupName = getResourceGroupFromId(this.root.storageAccountId);
        // Use the ARM storage management client because the blob service client has access right issues
        const containers = await uiUtils.listAllIterator(this.root.getStorageManagementClient().blobContainers.list(resourceGroupName, storageAccountName));
        return containers;
    }

    async getContainerItems(containersResponse: ListContainersSegmentResponse | ListContainerItem[], isAttached: boolean): Promise<BlobContainerTreeItem[]> {
        return isAttached ?
            await this.getAttachedContainerItems(containersResponse as ListContainersSegmentResponse) :
            await this.getAzureContainerItems(containersResponse as ListContainerItem[]);
    }

    async getAttachedContainerItems(containersResponse: ListContainersSegmentResponse): Promise<BlobContainerTreeItem[]> {
        this._continuationToken = containersResponse.continuationToken;
        return await Promise.all(containersResponse.containerItems.map(async (container: ContainerItem) => {
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
        }));
    }

    async getAzureContainerItems(containersResponse: ListContainerItem[]): Promise<BlobContainerTreeItem[]> {
        return await Promise.all(containersResponse.map(async (container: ContainerItem) => {
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
        }));
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<BlobContainerTreeItem> {
        const wizardContext: IActionContext & { name?: string } = { ...context };
        const wizard = new AzureWizard(wizardContext, { promptSteps: [new BlobContainerNameStep()] });
        await wizard.prompt();

        const name = nonNullProp(wizardContext, 'name');

        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(name);
            progress.report({ message: `Azure Storage: Creating blob container '${name}'` });
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, await this.createBlobContainer(name));
        });
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === BlobContainerTreeItem.contextValue;
    }

    private async createBlobContainer(name: string): Promise<ContainerItem> {
        const containerClient: ContainerClient = await createBlobContainerClient(this.root, name);
        await containerClient.create();

        const containersResponse: ListContainerItem[] = await this.listContainers();
        let createdContainer: ListContainerItem | undefined;
        for (const container of containersResponse) {
            if (container.name === name) {
                createdContainer = container;
                break;
            }
        }

        if (!createdContainer) {
            throw new Error(`Could not create container ${name}`);
        }

        return createdContainer as ContainerItem;
    }
}
