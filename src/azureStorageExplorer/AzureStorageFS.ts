/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from "path";
import * as vscode from "vscode";
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext, parseError } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem, IBlobContainerCreateChildContext } from "./blobContainers/blobContainerNode";
import { BlobDirectoryTreeItem } from "./blobContainers/BlobDirectoryTreeItem";
import { BlobTreeItem } from "./blobContainers/blobNode";
import { DirectoryTreeItem, IDirectoryDeleteContext } from "./fileShares/directoryNode";
import { FileTreeItem } from "./fileShares/fileNode";
import { FileShareTreeItem, IFileShareCreateChildContext } from "./fileShares/fileShareNode";
import { createFileFromText, doesFileExist } from "./fileShares/fileUtils";
import { validateDirectoryName } from "./fileShares/validateNames";
import { getFileSystemError } from "./getFileSystemError";
import { idToUri, parseUri } from "./parseUri";
import { showRenameError } from "./showRenameError";

type AzureStorageFileTreeItem = FileTreeItem | DirectoryTreeItem | FileShareTreeItem;
type AzureStorageBlobTreeItem = BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;
type AzureStorageTreeItem = AzureStorageFileTreeItem | AzureStorageBlobTreeItem;
type AzureStorageDirectoryTreeItem = DirectoryTreeItem | FileShareTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;

export class AzureStorageFS implements vscode.FileSystemProvider {
    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return await callWithTelemetryAndErrorHandling('stat', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            let treeItem: AzureStorageTreeItem = await this.lookup(uri, context);
            let fileType: vscode.FileType = treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem ? vscode.FileType.Directory : vscode.FileType.File;

            // creation and modification times as well as size of tree item are intentionally set to 0 for now
            return { type: fileType, ctime: 0, mtime: 0, size: 0 };

            // tslint:disable-next-line: strict-boolean-expressions
        }) || { type: vscode.FileType.Unknown, ctime: 0, mtime: 0, size: 0 };
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('readDirectory', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            let treeItem: AzureStorageDirectoryTreeItem = await this.lookupAsDirectory(uri, context);
            await treeItem.refresh();

            let children: AzExtTreeItem[] = await treeItem.getCachedChildren(context);
            let result: [string, vscode.FileType][] = [];
            for (const child of children) {
                if (child instanceof FileTreeItem) {
                    result.push([child.file.name, vscode.FileType.File]);
                } else if (child instanceof DirectoryTreeItem) {
                    result.push([child.directory.name, vscode.FileType.Directory]);
                } else if (child instanceof BlobTreeItem) {
                    result.push([path.basename(child.blob.name), vscode.FileType.File]);
                } else if (child instanceof BlobDirectoryTreeItem) {
                    result.push([child.directory.name, vscode.FileType.Directory]);
                }
            }

            return result;
            // tslint:disable-next-line: strict-boolean-expressions
        }) || [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('createDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            try {
                // tslint:disable-next-line: no-void-expression
                this.isFileShareUri(uri) ? await this.createDirectoryFileShare(uri, context) : await this.createDirectoryBlobContainer(uri, context);
            } catch (error) {
                let pe = parseError(error);
                if (pe.errorType === "ResourceAlreadyExists") {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
                } else {
                    throw error;
                }
            }
        });
    }

    async createDirectoryFileShare(uri: vscode.Uri, context: IActionContext): Promise<void> {
        let parsedUri = parseUri(uri);
        let response: string | undefined | null = validateDirectoryName(parsedUri.baseName);
        if (response) {
            throw new Error(response);
        }

        let parentUri: vscode.Uri = idToUri(parsedUri.resourceId, parsedUri.parentDirPath);
        let parent = await this.lookupAsDirectory(parentUri, context, parsedUri.resourceId, parsedUri.parentDirPath);
        await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFileShareDirectory', childName: parsedUri.baseName });
    }

    async createDirectoryBlobContainer(uri: vscode.Uri, context: IActionContext): Promise<void> {
        let parsedUri = parseUri(uri);
        let treeItem: AzureStorageBlobTreeItem = await this.lookupBlobContainer(uri, context, parsedUri.resourceId, parsedUri.filePath, true);
        if (treeItem instanceof BlobTreeItem) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotADirectory);
        }

        let tiParsedUri = parseUri(idToUri(parsedUri.resourceId, path.dirname(parsedUri.filePath)));
        let matches = parsedUri.filePath.match(`^${this.regexEscape(tiParsedUri.filePath)}\/?([^\/^]+)\/?(.*?)$`);
        while (!!matches) {
            treeItem = <BlobDirectoryTreeItem>await treeItem.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlobDirectory', childName: matches[1] });
            matches = matches[2].match("^([^\/]+)\/?(.*?)$");
        }
    }

    private regexEscape(s: string): string {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('readFile', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let result: string | undefined;
            let parsedUri = parseUri(uri);
            let treeItem: FileShareTreeItem | BlobContainerTreeItem = await this.lookupRoot(uri, context, parsedUri.resourceId);

            try {
                if (treeItem instanceof FileShareTreeItem) {
                    let service: azureStorage.FileService = treeItem.root.createFileService();
                    let shareName: string = treeItem.share.name;
                    result = await new Promise<string | undefined>((resolve, reject) => {
                        service.getFileToText(shareName, parsedUri.parentDirPath, parsedUri.baseName, (error?: Error, text?: string) => {
                            if (!!error) {
                                reject(error);
                            } else {
                                resolve(text);
                            }
                        });
                    });
                } else {
                    let service: azureStorage.BlobService = treeItem.root.createBlobService();
                    let containerName: string = treeItem.container.name;
                    result = await new Promise<string | undefined>((resolve, reject) => {
                        service.getBlobToText(containerName, parsedUri.filePath, (error?: Error, text?: string) => {
                            if (!!error) {
                                reject(error);
                            } else {
                                resolve(text);
                            }
                        });
                    });
                }
            } catch (error) {
                let pe = parseError(error);
                if (pe.errorType === 'BlobNotFound' || pe.errorType === 'ResourceNotFound') {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
                }
                throw error;
            }

            // tslint:disable-next-line: strict-boolean-expressions
            return Buffer.from(result || '');
            // tslint:disable-next-line: strict-boolean-expressions
        }) || Buffer.from('');
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            const writeToFileShare: boolean = this.isFileShareUri(uri);
            let parsedUri = parseUri(uri);
            let treeItem: FileShareTreeItem | BlobContainerTreeItem = await this.lookupRoot(uri, context, parsedUri.resourceId);

            let childExists: boolean;
            if (treeItem instanceof FileShareTreeItem) {
                childExists = await doesFileExist(parsedUri.baseName, treeItem, parsedUri.parentDirPath, treeItem.share);
            } else {
                childExists = await treeItem.doesBlobExist(parsedUri.filePath);
            }

            if (!childExists && !options.create) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            } else if (childExists && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
            } else {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    if (childExists) {
                        progress.report({ message: `Saving ${writeToFileShare ? 'file' : 'blob'} ${parsedUri.filePath}` });

                        if (treeItem instanceof FileShareTreeItem) {
                            await createFileFromText(parsedUri.parentDirPath, parsedUri.baseName, treeItem.share, treeItem.root, content.toString());
                        } else {
                            await treeItem.createBlockBlob(parsedUri.filePath, content.toString());
                        }
                    } else {
                        progress.report({ message: `Creating ${writeToFileShare ? 'file' : 'blob'} ${parsedUri.filePath}` });
                        let parentUri: vscode.Uri = idToUri(parsedUri.resourceId, parsedUri.parentDirPath);
                        let parent = await this.lookupAsDirectory(parentUri, context, parsedUri.resourceId, parsedUri.parentDirPath);

                        if (writeToFileShare) {
                            await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFile', childName: parsedUri.baseName });
                        } else {
                            await parent.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlob', childName: parsedUri.filePath });
                        }
                    }
                });
            }
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('delete', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            let parsedUri = parseUri(uri);
            let treeItem: AzureStorageTreeItem = await this.lookup(uri, context, parsedUri.resourceId, parsedUri.filePath);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                if (treeItem instanceof FileTreeItem || treeItem instanceof DirectoryTreeItem || treeItem instanceof BlobTreeItem || treeItem instanceof BlobDirectoryTreeItem) {
                    if (!(treeItem instanceof BlobDirectoryTreeItem)) {
                        // The deletion message from deleteTreeItem is not supressed for BlobDirectoryTreeItems so avoid duplicate notifications
                        progress.report({ message: `Deleting ${parsedUri.filePath}` });
                    }

                    await treeItem.deleteTreeItem(<IDirectoryDeleteContext>{ ...context, suppressMessage: true });
                } else {
                    throw new RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
                }
            });
        });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('rename', async (context) => {
            showRenameError(oldUri, newUri, context);
        });
    }

    async lookup(uri: vscode.Uri, context: IActionContext, resourceId?: string, filePath?: string): Promise<AzureStorageTreeItem> {
        if (!resourceId || !filePath) {
            let parsedUri = parseUri(uri);
            resourceId = parsedUri.resourceId;
            filePath = parsedUri.filePath;
        }

        return this.isFileShareUri(uri) ? await this.lookupFileShare(uri, context, resourceId, filePath) : await this.lookupBlobContainer(uri, context, resourceId, filePath);
    }

    private async lookupFileShare(uri: vscode.Uri, context: IActionContext, resourceId: string, filePath: string): Promise<AzureStorageFileTreeItem> {
        let uriPath = path.posix.join(resourceId, filePath);
        let treeItem = await ext.tree.findTreeItem(uriPath, context);
        if (!treeItem) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (treeItem instanceof FileShareTreeItem || treeItem instanceof FileTreeItem || treeItem instanceof DirectoryTreeItem) {
            return treeItem;
        } else {
            throw new RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
        }
    }

    private async lookupBlobContainer(uri: vscode.Uri, context: IActionContext, resourceId: string, filePath: string, endSearchEarly?: boolean): Promise<AzureStorageBlobTreeItem> {
        let treeItem: AzureStorageBlobTreeItem = <BlobContainerTreeItem>await this.lookupRoot(uri, context, resourceId);
        if (filePath === '') {
            return treeItem;
        }

        let pathToLook = filePath.split('/');
        for (const childName of pathToLook) {
            if (treeItem instanceof BlobTreeItem) {
                if (endSearchEarly) {
                    return treeItem;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            let children: AzExtTreeItem[] = await treeItem.getCachedChildren(context);
            let child = children.find((element) => {
                if (element instanceof BlobTreeItem) {
                    return path.basename(element.blob.name) === childName;
                } else if (element instanceof BlobDirectoryTreeItem) {
                    return path.basename(element.directory.name) === childName;
                }
                return false;
            });
            if (!child) {
                if (endSearchEarly) {
                    return treeItem;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            treeItem = <BlobTreeItem | BlobDirectoryTreeItem>child;
        }

        return treeItem;
    }

    private async lookupRoot(uri: vscode.Uri, context: IActionContext, resourceId: string): Promise<FileShareTreeItem | BlobContainerTreeItem> {
        let treeItem = await ext.tree.findTreeItem(resourceId, context);
        if (!treeItem) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (treeItem instanceof FileShareTreeItem || treeItem instanceof BlobContainerTreeItem) {
            return treeItem;
        } else {
            throw new RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
        }
    }

    private async lookupAsDirectory(uri: vscode.Uri, context: IActionContext, resourceId?: string, filePath?: string): Promise<AzureStorageDirectoryTreeItem> {
        let treeItem: AzureStorageTreeItem = await this.lookup(uri, context, resourceId, filePath);
        if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem) {
            return treeItem;
        } else {
            throw RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
        }
    }

    private isFileShareUri(uri: vscode.Uri): boolean {
        return uri.query.indexOf('File Shares') > 0;
    }
}
