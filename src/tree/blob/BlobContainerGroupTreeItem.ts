/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobServiceClient, ContainerClient, ContainerItem, ListContainersSegmentResponse, ServiceListContainersSegmentResponse } from '@azure/storage-blob';

import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, callWithTelemetryAndErrorHandling, GenericTreeItem, IActionContext, ICreateChildImplContext, parseError } from '@microsoft/vscode-azext-utils';

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

        const isAttached = this.fullId.startsWith("/attachedStorageAccounts/");

        let containersResponse: ContainerItem[];
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

        return await this.getContainerItems(containersResponse);
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listContainers(isAttached: boolean, continuationToken?: string): Promise<ContainerItem[]> {
        return isAttached ? await this.listAttachedContainers(continuationToken) : await this.listAzureContainers();
    }

    async listAttachedContainers(continuationToken?: string): Promise<ContainerItem[]> {
        const blobServiceClient: BlobServiceClient = await this.root.createBlobServiceClient();
        const response: AsyncIterableIterator<ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize: maxPageSize });

        const value = (await response.next()).value as ListContainersSegmentResponse;
        this._continuationToken = value.continuationToken ? value.continuationToken : undefined;
        return value.containerItems;
    }

    async listAzureContainers(): Promise<ContainerItem[]> {
        const storageAccountName = this.root.storageAccountName;
        const resourceGroupName = getResourceGroupFromId(this.root.storageAccountId);
        // Use the ARM storage management client because the blob service client has access right issues
        return await callWithTelemetryAndErrorHandling('listAzureContainers', async (context: IActionContext) => {
            const containers = await uiUtils.listAllIterator((await this.root.getStorageManagementClient(context)).blobContainers.list(resourceGroupName, storageAccountName));
            // Convert ListContainerItem[] to ContainerItem[] for consistency
            return containers.map(container => this.convertToContainerItem(container));
        }) ?? [];
    }

    async getContainerItems(containersResponse: ContainerItem[]): Promise<BlobContainerTreeItem[]> {
        return await Promise.all(containersResponse.map(async (container: ContainerItem) => {
            return await BlobContainerTreeItem.createBlobContainerTreeItem(this, container);
        }));
    }

    private convertToContainerItem(listContainer: ListContainerItem): ContainerItem {
        return {
            name: listContainer.name || '',
            properties: {
                lastModified: listContainer.lastModifiedTime,
                etag: listContainer.etag,
                leaseStatus: listContainer.leaseStatus as never,
                leaseState: listContainer.leaseState as never,
                hasImmutabilityPolicy: listContainer.hasImmutabilityPolicy,
                hasLegalHold: listContainer.hasLegalHold
            }
        } as ContainerItem;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<BlobContainerTreeItem> {
        const wizardContext: IActionContext & { name?: string } = { ...context };
        const wizard = new AzureWizard(wizardContext, { promptSteps: [new BlobContainerNameStep()] });
        await wizard.prompt();

        const name = nonNullProp(wizardContext, 'name');

        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(name);
            progress.report({ message: `Azure Storage: Creating blob container '${name}'` });
            const container = await BlobContainerTreeItem.createBlobContainerTreeItem(this, await this.createBlobContainer(name));
            void this.refresh(context)
            return container;
        });

    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === BlobContainerTreeItem.contextValue;
    }

    private async createBlobContainer(name: string): Promise<ContainerItem> {
        // need to reset the continuation token to start at the beginning of the list
        this._continuationToken = undefined;
        const containerClient: ContainerClient = await createBlobContainerClient(this.root, name);
        await containerClient.create();
        const isAttached = this.fullId.startsWith("/attachedStorageAccounts/");
        const containersResponse: ContainerItem[] = [];
        // load all of the containers until we find the one we just created
        do {
            const containers = await this.listContainers(isAttached, this._continuationToken);
            containersResponse.push(...containers);
        } while (this._continuationToken);

        let createdContainer: ContainerItem | undefined;
        for (const container of containersResponse) {
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
}
