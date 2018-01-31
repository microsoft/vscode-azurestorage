/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProgressLocation, Uri, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { FileShareNode } from './fileShareNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureParentTreeItem, IAzureNode, UserCancelledError, } from 'vscode-azureextensionui';
import { FileService } from 'azure-storage';

const minQuotaGB = 1;
const maxQuotaGB = 5120;

export class FileShareGroupNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public id: string = undefined;
    public label: string = "File Shares";
    public contextValue: string = 'azureFileShareGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureFileShare_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureFileShare_16x.png')
    };

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        var fileShares = await this.listFileShares(this._continuationToken);
        var { entries, continuationToken } = fileShares;
        this._continuationToken = continuationToken;

        return entries.map((fileShare: azureStorage.FileService.ShareResult) => {
            return new FileShareNode(
                fileShare,
                this.storageAccount,
                this.key);
        });
    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listFileShares(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListSharesResult> {
        return new Promise((resolve, reject) => {
            var fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            fileService.listSharesSegmented(currentToken, { maxResults: 50 }, (err: Error, result: azureStorage.FileService.ListSharesResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        });
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const shareName = await window.showInputBox({
            placeHolder: `Enter a name for the new file share`,
            validateInput: FileShareGroupNode.validateFileShareName
        });

        if (shareName) {
            const quotaGB = await window.showInputBox({
                prompt: `Specify quota (in GB, between ${minQuotaGB} and ${maxQuotaGB}), to limit total storage size`,
                value: maxQuotaGB.toString(),
                validateInput: FileShareGroupNode.validateQuota
            });

            if (quotaGB) {
                return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                    showCreatingNode(shareName);
                    progress.report({ message: `Azure Storage: Creating file share '${shareName}'` });
                    const share = await this.createFileShare(shareName, Number(quotaGB));
                    return new FileShareNode(share, this.storageAccount, this.key);
                });
            }
        }

        throw new UserCancelledError();
    }

    private createFileShare(name: string, quotaGB: number): Promise<azureStorage.FileService.ShareResult> {
        return new Promise((resolve, reject) => {
            var shareService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            const options = <FileService.CreateShareRequestOptions>{
                quota: quotaGB
            };
            shareService.createShare(name, options, (err: Error, result: azureStorage.FileService.ShareResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private static validateFileShareName(name: string): string | undefined | null {
        if (!name) {
            return "Share name cannot be empty";
        }
        if (name.indexOf(" ") >= 0) {
            return "Share name cannot contain spaces";
        }

        if (name.length < 3 || name.length > 63) {
            return 'Share name must contain between 3 and 63 characters';
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
                return `Value must be between ${minQuotaGB} and ${maxQuotaGB}`
            }
        } catch (err) {
            return "Input must be a number"
        }
        return undefined;
    }
}
