/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ServiceListSharesSegmentResponse, ShareItem, ShareServiceClient } from '@azure/storage-file-share';

import { AzExtParentTreeItem, AzureWizard, ICreateChildImplContext, parseError } from '@microsoft/vscode-azext-utils';
import { ResolvedAppResourceTreeItem } from '@microsoft/vscode-azext-utils/hostapi';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { ResolvedStorageAccount } from '../../StorageAccountResolver';
import { getResourcesPath, maxPageSize } from "../../constants";
import { localize } from '../../utils/localize';
import { nonNullProp } from '../../utils/nonNull';
import { AttachedStorageAccountTreeItem } from '../AttachedStorageAccountTreeItem';
import { IStorageRoot } from '../IStorageRoot';
import { IStorageTreeItem } from '../IStorageTreeItem';
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileShareTreeItem } from './FileShareTreeItem';
import { FileTreeItem } from './FileTreeItem';
import { FileShareNameStep } from './createFileShare/FileShareNameStep';
import { IFileShareWizardContext } from './createFileShare/IFileShareWizardContext';
import { StorageQuotaPromptStep } from './createFileShare/StorageQuotaPromptStep';

export class FileShareGroupTreeItem extends AzExtParentTreeItem implements IStorageTreeItem {
    private _continuationToken: string | undefined;

    public label: string = "File Shares";
    public readonly childTypeLabel: string = "File Share";
    public static contextValue: string = 'azureFileShareGroup';
    public contextValue: string = FileShareGroupTreeItem.contextValue;
    public parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem;

    public constructor(parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<FileShareTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        const shareServiceClient: ShareServiceClient = await this.root.createShareServiceClient();
        const response: AsyncIterableIterator<ServiceListSharesSegmentResponse> = shareServiceClient.listShares().byPage({ continuationToken: this._continuationToken, maxPageSize });

        let responseValue: ServiceListSharesSegmentResponse;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            responseValue = (await response.next()).value;
        } catch (error) {
            if (parseError(error).errorType === 'REQUEST_SEND_ERROR') {
                throw new Error(localize('storageAccountDoesNotSupportFileShares', 'This storage account does not support file shares.'));
            } else {
                throw error;
            }
        }

        const shares: ShareItem[] = responseValue.shareItems || [];
        this._continuationToken = responseValue.continuationToken;

        return shares.map((share: ShareItem) => {
            return new FileShareTreeItem(this, share.name, shareServiceClient.getShareClient(share.name).url);
        });
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<FileShareTreeItem> {
        const wizardContext: IFileShareWizardContext = { ...context };
        const promptSteps = [new FileShareNameStep(), new StorageQuotaPromptStep()];

        const wizard = new AzureWizard(wizardContext, { title: localize('createFileShare', "Create File Share"), promptSteps });
        await wizard.prompt();
        const shareName = nonNullProp(wizardContext, 'name');
        const quota = nonNullProp(wizardContext, 'quota');

        return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(shareName);
            progress.report({ message: localize('creatingFileShare', 'Azure Storage: Creating file share "{0}"...', shareName) });
            const shareServiceClient: ShareServiceClient = await this.root.createShareServiceClient();
            await shareServiceClient.createShare(shareName, { quota });
            return new FileShareTreeItem(this, shareName, shareServiceClient.getShareClient(shareName).url);
        });
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === FileShareTreeItem.contextValue ||
            contextValue === DirectoryTreeItem.contextValue ||
            contextValue === FileTreeItem.contextValue;
    }
}
