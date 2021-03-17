/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, ICreateChildImplContext, parseError, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from '../../utils/localize';
import { IStorageRoot } from "../IStorageRoot";
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileShareTreeItem } from './FileShareTreeItem';
import { FileTreeItem } from './FileTreeItem';

const minQuotaGB = 1;
const maxQuotaGB = 5120;

export class FileShareGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: string | undefined;

    public label: string = "File Shares";
    public readonly childTypeLabel: string = "File Share";
    public static contextValue: string = 'azureFileShareGroup';
    public contextValue: string = FileShareGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
    };

    async loadMoreChildrenImpl(clearCache: boolean): Promise<FileShareTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        const shareServiceClient: azureStorageShare.ShareServiceClient = this.root.createShareServiceClient();
        const response: AsyncIterableIterator<azureStorageShare.ServiceListSharesSegmentResponse> = shareServiceClient.listShares().byPage({ continuationToken: this._continuationToken, maxPageSize });

        let responseValue: azureStorageShare.ServiceListSharesSegmentResponse;
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

        const shares: azureStorageShare.ShareItem[] = responseValue.shareItems || [];
        this._continuationToken = responseValue.continuationToken;

        return shares.map((share: azureStorageShare.ShareItem) => {
            return new FileShareTreeItem(this, share.name);
        });
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<FileShareTreeItem> {
        const shareName = await ext.ui.showInputBox({
            placeHolder: 'Enter a name for the new file share',
            validateInput: FileShareGroupTreeItem.validateFileShareName
        });

        if (shareName) {
            const quotaGB = await ext.ui.showInputBox({
                prompt: `Specify quota (in GB, between ${minQuotaGB} and ${maxQuotaGB}), to limit total storage size`,
                value: maxQuotaGB.toString(),
                validateInput: FileShareGroupTreeItem.validateQuota
            });

            if (quotaGB) {
                return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                    context.showCreatingTreeItem(shareName);
                    progress.report({ message: `Azure Storage: Creating file share '${shareName}'` });
                    const shareServiceClient: azureStorageShare.ShareServiceClient = this.root.createShareServiceClient();
                    await shareServiceClient.createShare(shareName, { quota: Number(quotaGB) });
                    return new FileShareTreeItem(this, shareName);
                });
            }
        }

        throw new UserCancelledError();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === FileShareTreeItem.contextValue ||
            contextValue === DirectoryTreeItem.contextValue ||
            contextValue === FileTreeItem.contextValue;
    }

    private static validateFileShareName(name: string): string | undefined | null {
        const validLength = { min: 3, max: 63 };

        if (!name) {
            return "Share name cannot be empty";
        }
        if (name.indexOf(" ") >= 0) {
            return "Share name cannot contain spaces";
        }
        if (name.length < validLength.min || name.length > validLength.max) {
            return `Share name must contain between ${validLength.min} and ${validLength.max} characters`;
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
            return 'Share name can only contain lowercase letters, numbers and hyphens';
        }
        if (/--/.test(name)) {
            return 'Share name cannot contain two hyphens in a row';
        }
        if (/(^-)|(-$)/.test(name)) {
            return 'Share name cannot begin or end with a hyphen';
        }

        return undefined;
    }

    private static validateQuota(input: string): string | undefined {
        try {
            const value = Number(input);
            if (value < minQuotaGB || value > maxQuotaGB) {
                return `Value must be between ${minQuotaGB} and ${maxQuotaGB}`;
            }
        } catch (err) {
            return "Input must be a number";
        }
        return undefined;
    }
}
