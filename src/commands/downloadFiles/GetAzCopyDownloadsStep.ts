/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption } from "@azure-tools/azcopy-node";
import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { basename, join, posix } from "path";
import { NotificationProgress } from "../../constants";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";
import { DirectoryTreeItem } from "../../tree/fileShare/DirectoryTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { FileTreeItem } from "../../tree/fileShare/FileTreeItem";
import { IDownloadableTreeItem } from "../../tree/IDownloadableTreeItem";
import { IAzCopyDownload } from "../downloadFile";
import { getResourceUri } from "./getResourceUri";
import { getSasToken } from "./getSasToken";
import { IDownloadWizardContext } from "./IDownloadWizardContext";

export class GetAzCopyDownloadsStep extends AzureWizardExecuteStep<IDownloadWizardContext> {
    public priority: number = 200;

    public async execute(context: IDownloadWizardContext, _progress: NotificationProgress): Promise<void> {
        const destinationFolder = nonNullProp(context, 'destinationFolder');
        context.sasUrl ?
            await this.getDownloadFromSasUrl(context, destinationFolder) :
            await this.getAzCopyDownloads(context, destinationFolder, context.treeItems)

    }

    public shouldExecute(wizardContext: IDownloadWizardContext): boolean {
        return !wizardContext.allFileDownloads && !wizardContext.allFolderDownloads;
    }

    private async getAzCopyDownloads(context: IDownloadWizardContext, destinationFolder: string, treeItems: IDownloadableTreeItem[] = []): Promise<void> {
        const allFolderDownloads: IAzCopyDownload[] = [];
        const allFileDownloads: IAzCopyDownload[] = [];

        for (const treeItem of treeItems) {
            // if there is no remoteFilePath, then it is the root
            const remoteFilePath = treeItem.remoteFilePath ?? `${posix.sep}`;
            const resourceUri: string = getResourceUri(treeItem);
            const sasToken: string = getSasToken(treeItem.root);
            if (treeItem instanceof BlobTreeItem) {
                await treeItem.checkCanDownload(context);
                allFileDownloads.push({
                    remoteFileName: treeItem.blobName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.blobName),
                    fromTo: 'BlobLocal',
                    isDirectory: false,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof BlobDirectoryTreeItem) {
                allFolderDownloads.push({
                    remoteFileName: treeItem.dirName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.dirName),
                    fromTo: 'BlobLocal',
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof BlobContainerTreeItem) {
                allFolderDownloads.push({
                    remoteFileName: treeItem.container.name,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.container.name),
                    fromTo: 'BlobLocal',
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof FileTreeItem) {
                allFileDownloads.push({
                    remoteFileName: treeItem.fileName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.fileName),
                    fromTo: 'FileLocal',
                    isDirectory: false,
                    resourceUri,
                    sasToken,
                });
            } else if (treeItem instanceof DirectoryTreeItem) {
                allFolderDownloads.push({
                    remoteFileName: treeItem.directoryName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.directoryName),
                    fromTo: 'FileLocal',
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            } else if (treeItem instanceof FileShareTreeItem) {
                allFolderDownloads.push({
                    remoteFileName: treeItem.shareName,
                    remoteFilePath,
                    localFilePath: join(destinationFolder, treeItem.shareName),
                    fromTo: 'FileLocal',
                    isDirectory: true,
                    resourceUri,
                    sasToken
                });
            }
        }

        context.allFileDownloads = allFileDownloads;
        context.allFolderDownloads = allFolderDownloads;
    }

    private async getDownloadFromSasUrl(context: IDownloadWizardContext, destinationFolder: string): Promise<void> {
        const allFolderDownloads: IAzCopyDownload[] = [];
        const allFileDownloads: IAzCopyDownload[] = [];

        const url = new URL(nonNullProp(context, 'sasUrl'));
        const pathArgs = url.pathname.split('/');
        pathArgs.shift();
        const resourceName = pathArgs.shift();

        const download = {
            fromTo: url.origin.includes('blob.core') ? 'BlobLocal' : 'FileLocal' as FromToOption,
            isDirectory: pathArgs.slice(-1)[0] === '',
            remoteFileName: basename(url.pathname),
            remoteFilePath: pathArgs.join('/'),
            localFilePath: join(destinationFolder, basename(url.pathname)),
            resourceUri: `${url.origin}/${resourceName}`,
            sasToken: url.search.substring(1),
        };

        download.isDirectory ? allFolderDownloads.push(download) : allFileDownloads.push(download);

        context.allFileDownloads = allFileDownloads;
        context.allFolderDownloads = allFolderDownloads;
    }
}
