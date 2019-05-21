/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { FileService } from 'azure-storage';
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { resourcesPath } from "../../constants";
import { IStorageRoot } from "../IStorageRoot";
import { FileShareTreeItem } from './fileShareNode';

const minQuotaGB = 1;
const maxQuotaGB = 5120;

export class FileShareGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    public label: string = "File Shares";
    public readonly childTypeLabel: string = "File Share";
    public static contextValue: string = 'azureFileShareGroup';
    public contextValue: string = FileShareGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(resourcesPath, 'light', 'AzureFileShare.svg'),
        dark: path.join(resourcesPath, 'dark', 'AzureFileShare.svg')
    };

    async loadMoreChildrenImpl(clearCache: boolean): Promise<FileShareTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // currentToken argument typed incorrectly in SDK
        let fileShares = await this.listFileShares(<azureStorage.common.ContinuationToken>this._continuationToken);
        let { entries, continuationToken } = fileShares;
        this._continuationToken = continuationToken;

        return entries.map((fileShare: azureStorage.FileService.ShareResult) => {
            return new FileShareTreeItem(
                this,
                fileShare);
        });
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFileShares(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListSharesResult> {
        return new Promise((resolve, reject) => {
            let fileService = this.root.createFileService();
            fileService.listSharesSegmented(currentToken, { maxResults: 50 }, (err?: Error, result?: azureStorage.FileService.ListSharesResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<FileShareTreeItem> {
        const shareName = await window.showInputBox({
            placeHolder: 'Enter a name for the new file share',
            validateInput: FileShareGroupTreeItem.validateFileShareName
        });

        if (shareName) {
            const quotaGB = await window.showInputBox({
                prompt: `Specify quota (in GB, between ${minQuotaGB} and ${maxQuotaGB}), to limit total storage size`,
                value: maxQuotaGB.toString(),
                validateInput: FileShareGroupTreeItem.validateQuota
            });

            if (quotaGB) {
                return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                    context.showCreatingTreeItem(shareName);
                    progress.report({ message: `Azure Storage: Creating file share '${shareName}'` });
                    const share = await this.createFileShare(shareName, Number(quotaGB));
                    return new FileShareTreeItem(this, share);
                });
            }
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createFileShare(name: string, quotaGB: number): Promise<azureStorage.FileService.ShareResult> {
        return new Promise((resolve, reject) => {
            let shareService = this.root.createFileService();
            const options = <FileService.CreateShareRequestOptions>{
                quota: quotaGB
            };
            shareService.createShare(name, options, (err?: Error, result?: azureStorage.FileService.ShareResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
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
