/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { basename, join, posix } from "path";
import { NotificationProgress } from "../../constants";
import { ITransferSrcOrDstTreeItem } from "../../tree/ITransferSrcOrDstTreeItem";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";
import { DirectoryTreeItem } from "../../tree/fileShare/DirectoryTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { FileTreeItem } from "../../tree/fileShare/FileTreeItem";
import { DownloadItem } from "../transfers/transfers";
import { IDownloadWizardContext } from "./IDownloadWizardContext";

export class GetAzCopyDownloadsStep extends AzureWizardExecuteStep<IDownloadWizardContext> {
    public priority: number = 200;

    public async execute(context: IDownloadWizardContext, _progress: NotificationProgress): Promise<void> {
        const destinationFolder = nonNullProp(context, 'destinationFolder');
        context.sasUrl ?
            await this.setDownloadItemsFromContextSasUrl(context, destinationFolder) :
            await this.setDownloadItemsFromTreeItems(context, destinationFolder, context.treeItems)
    }

    public shouldExecute(wizardContext: IDownloadWizardContext): boolean {
        return !wizardContext.allFileDownloads && !wizardContext.allFolderDownloads;
    }

    private async setDownloadItemsFromTreeItems(context: IDownloadWizardContext, destinationFolder: string, treeItems: ITransferSrcOrDstTreeItem[] = []): Promise<void> {

        const allFolderDownloads: DownloadItem[] = [];
        const allFileDownloads: DownloadItem[] = [];

        for (const treeItem of treeItems) {
            // if there is no remoteFilePath, then it is the root
            const remoteFilePath = treeItem.remoteFilePath ?? `${posix.sep}`;
            const sasToken = treeItem.transferSasToken;
            const resourceUri = treeItem.resourceUri;
            if (treeItem instanceof BlobTreeItem) {
                await treeItem.checkCanDownload(context);
                allFileDownloads.push({
                    type: "blob",
                    remoteFileName: treeItem.blobName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.blobName),
                    isDirectory: false,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof BlobDirectoryTreeItem) {
                allFolderDownloads.push({
                    type: "blob",
                    remoteFileName: treeItem.dirName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.dirName),
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof BlobContainerTreeItem) {
                allFolderDownloads.push({
                    type: "blob",
                    remoteFileName: treeItem.container.name,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.container.name),
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof FileTreeItem) {
                allFileDownloads.push({
                    type: "file",
                    remoteFileName: treeItem.fileName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.fileName),
                    isDirectory: false,
                    resourceUri,
                    sasToken,
                });
            } else if (treeItem instanceof DirectoryTreeItem) {
                allFolderDownloads.push({
                    type: "file",
                    remoteFileName: treeItem.directoryName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.directoryName),
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof FileShareTreeItem) {
                allFolderDownloads.push({
                    type: "file",
                    remoteFileName: treeItem.shareName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.shareName),
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            }
        }

        context.allFileDownloads = allFileDownloads;
        context.allFolderDownloads = allFolderDownloads;
    }

    private async setDownloadItemsFromContextSasUrl(context: IDownloadWizardContext, destinationFolder: string): Promise<void> {
        const allFolderDownloads: DownloadItem[] = [];
        const allFileDownloads: DownloadItem[] = [];

        const url = new URL(nonNullProp(context, "sasUrl"));
        const pathArgs = url.pathname.split("/");
        pathArgs.shift();
        const resourceName = pathArgs.shift();

        const download: DownloadItem = {
            type: url.origin.includes("blob.core") ? "blob" : "file",
            isDirectory: pathArgs.slice(-1)[0] === "",
            remoteFileName: basename(url.pathname),
            remoteFilePath: pathArgs.join("/"),
            localFilePath: join(destinationFolder, basename(url.pathname)),
            resourceUri: `${url.origin}/${resourceName}`,
            sasToken: url.search.substring(1),
        };

        download.isDirectory ? allFolderDownloads.push(download) : allFileDownloads.push(download);

        context.allFileDownloads = allFileDownloads;
        context.allFolderDownloads = allFolderDownloads;
    }
}
