/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { FileShareTreeItem } from './FileShareTreeItem';

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

        let { shares, continuationToken }: { shares: azureStorageShare.ShareItem[]; continuationToken: string; } = await this.listFileShares(this._continuationToken);
        this._continuationToken = continuationToken;

        return shares.map((share: azureStorageShare.ShareItem) => {
            return new FileShareTreeItem(this, share.name);
        });
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listFileShares(currentToken: string | undefined): Promise<{ shares: azureStorageShare.ShareItem[], continuationToken: string }> {
        let responseValue: azureStorageShare.ServiceListSharesSegmentResponse;
        let shares: azureStorageShare.ShareItem[] = [];
        const shareServiceClient: azureStorageShare.ShareServiceClient = this.root.createShareServiceClient();
        const response: AsyncIterableIterator<azureStorageShare.ServiceListSharesSegmentResponse> = shareServiceClient.listShares().byPage({ continuationToken: currentToken, maxPageSize });

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            // tslint:disable-next-line: no-unsafe-any
            responseValue = (await response.next()).value;

            if (responseValue.shareItems) {
                shares.push(...responseValue.shareItems);
            }

            currentToken = responseValue.continuationToken;
            if (!currentToken) {
                break;
            }
        }

        return { shares, continuationToken: currentToken };
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
                    const shareResponse = await this.createFileShare(shareName, Number(quotaGB));

                    if (shareResponse.errorCode) {
                        throw new Error(`Could not create share ${shareName}. ${shareResponse.errorCode}`);
                    }

                    return new FileShareTreeItem(this, shareName);
                });
            }
        }

        throw new UserCancelledError();
    }

    private async createFileShare(name: string, quotaGB: number): Promise<azureStorageShare.ShareCreateResponse> {
        const shareServiceClient: azureStorageShare.ShareServiceClient = this.root.createShareServiceClient();
        const options: azureStorageShare.ShareCreateOptions = {
            quota: quotaGB
        };

        return (await shareServiceClient.createShare(name, options)).shareCreateResponse;
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
