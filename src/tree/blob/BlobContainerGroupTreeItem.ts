/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, parseError } from '@microsoft/vscode-azext-utils';
import { ResolvedAppResourceTreeItem } from "@microsoft/vscode-azext-utils/hostapi";
import * as path from 'path';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { ResolvedStorageAccount } from "../../StorageAccountResolver";
import { localize } from "../../utils/localize";
import { AttachedStorageAccountTreeItem } from "../AttachedStorageAccountTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { IStorageTreeItem } from "../IStorageTreeItem";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";

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

        let containersResponse: azureStorageBlob.ListContainersSegmentResponse;
        try {
            containersResponse = await this.listContainers(this._continuationToken);
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.root.isEmulated && errorType === 'ECONNREFUSED') {
                const item = new GenericTreeItem(this, {
                    contextValue: 'startBlobEmulator',
                    label: 'Start Blob Emulator',
                    commandId: 'azureStorage.startBlobEmulator',
                    includeInTreeItemPicker: false
                });

                item.commandArgs = [
                    context => {
                        return ext.rgApi.workspaceResourceTree.refresh(context, ext.attachedStorageAccountsTreeItem);
                    }
                ];

                return [item];
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportBlobs', 'This storage account does not support blobs.'));
            } else {
                throw error;
            }
        }

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
        const response: AsyncIterableIterator<azureStorageBlob.ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize: maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === BlobContainerTreeItem.contextValue;
    }
}
