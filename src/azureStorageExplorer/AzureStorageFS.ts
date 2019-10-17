/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as mime from "mime";
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
import { validateDirectoryName } from "./fileShares/validateNames";
import { getFileSystemError } from "./getFileSystemError";
import { idToUri, IParsedUri, parseUri } from "./parseUri";
import { showRenameError } from "./showRenameError";

type EntryTreeItem = FileShareEntryTreeItem | BlobContainerEntryTreeItem;
type FileShareEntryTreeItem = FileShareTreeItem | FileTreeItem | DirectoryTreeItem;
type BlobContainerEntryTreeItem = BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;

export class AzureStorageFS implements vscode.FileSystemProvider {
    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return await callWithTelemetryAndErrorHandling('stat', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            let treeItem: EntryTreeItem = await this.lookup(uri, context);
            let fileType: vscode.FileType = treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem ? vscode.FileType.Directory : vscode.FileType.File;

            // creation and modification times as well as size of tree item are intentionally set to 0 for now
            return { type: fileType, ctime: 0, mtime: 0, size: 0 };

            // tslint:disable-next-line: strict-boolean-expressions
        }) || { type: vscode.FileType.Unknown, ctime: 0, mtime: 0, size: 0 };
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return this.isFileShareUri(uri) ? await this.readDirectoryFileShare(uri) : await this.readDirectoryBlobContainer(uri);
    }

    async readDirectoryFileShare(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('readDirectoryFileShare', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectoryFileShare(uri, context);
            let children: AzExtTreeItem[] = await entry.getCachedChildren(context);

            let result: [string, vscode.FileType][] = [];
            for (const child of children) {
                if (child instanceof FileTreeItem) {
                    result.push([child.file.name, vscode.FileType.File]);
                } else if (child instanceof DirectoryTreeItem) {
                    result.push([child.directory.name, vscode.FileType.Directory]);
                }
            }

            return result;
            // tslint:disable-next-line: strict-boolean-expressions
        }) || [];
    }

    async readDirectoryBlobContainer(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('readDirectoryBlobContainer', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            let ti = await this.lookupAsDirectoryBlobContainer(uri, context);
            await ti.refresh();
            let children: AzExtTreeItem[] = await ti.getCachedChildren(context);

            let result: [string, vscode.FileType][] = [];
            for (const child of children) {
                if (child instanceof BlobTreeItem) {
                    result.push([path.basename(child.label), vscode.FileType.File]);
                } else if (child instanceof BlobDirectoryTreeItem) {
                    result.push([child.label, vscode.FileType.Directory]);
                }
            }

            return result;
            // tslint:disable-next-line: strict-boolean-expressions
        }) || [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        // tslint:disable-next-line: no-void-expression
        this.isFileShareUri(uri) ? await this.createDirectoryFileShare(uri) : await this.createDirectoryBlobContainer(uri);
    }

    async createDirectoryFileShare(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('createDirectoryFileShare', async (context) => {
            context.errorHandling.rethrow = true;
            let parsedUri = parseUri(uri);

            let response: string | undefined | null = validateDirectoryName(parsedUri.baseName);
            if (response) {
                throw new Error(response);
            }

            try {
                let parentUri: vscode.Uri = idToUri(path.posix.join(parsedUri.rootPath, parsedUri.parentDirPath));
                let parent = await this.lookupAsDirectoryFileShare(parentUri, context);

                await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFileShareDirectory', childName: parsedUri.baseName });
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

    async createDirectoryBlobContainer(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('createDirectoryBlobContainer', async (context) => {
            context.errorHandling.rethrow = true;
            let ti = await this.lookupBlobContainer(uri, context, true);
            if (ti instanceof BlobTreeItem) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotADirectory);
            }

            let parsedUri = parseUri(uri);
            let tiParsedUri = parseUri(idToUri(ti.fullId));

            let matches = parsedUri.filePath.match(`^${tiParsedUri.filePath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\/?([^\/^]+)\/?(.*?)$`);
            while (!!matches) {
                ti = <BlobDirectoryTreeItem>await ti.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlobDirectory', childName: matches[1] });
                matches = matches[2].match("^([^\/]+)\/?(.*?)$");
            }
            return ti;
        });
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return this.isFileShareUri(uri) ? await this.readFileFileShare(uri) : await this.readFileBlobContainer(uri);
    }

    async readFileFileShare(uri: vscode.Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('readFileFileShare', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let parsedUri = parseUri(uri);
            let treeItem: FileShareTreeItem = await this.lookupRootFileShare(uri, context);
            let fileService = treeItem.root.createFileService();

            let result: string | undefined;
            try {
                result = await new Promise<string | undefined>((resolve, reject) => {
                    fileService.getFileToText(treeItem.share.name, parsedUri.parentDirPath, parsedUri.baseName, (error?: Error, text?: string) => {
                        if (!!error) {
                            reject(error);
                        } else {
                            resolve(text);
                        }
                    });
                });
            } catch (error) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            // tslint:disable-next-line: strict-boolean-expressions
            return Buffer.from(result || '');
            // tslint:disable-next-line: strict-boolean-expressions
        }) || Buffer.from('');
    }

    async readFileBlobContainer(uri: vscode.Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('readFileBlobContainer', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let parsedUri = parseUri(uri);
            let blobContainer: BlobContainerTreeItem = await this.getRootBlobContainer(uri, context);
            let blobService: azureStorage.BlobService = blobContainer.root.createBlobService();

            let result: string;
            try {
                result = await new Promise<string>((resolve, reject) => {
                    blobService.getBlobToText(parsedUri.rootName, parsedUri.filePath, (error?: Error, text?: string) => {
                        if (!!error) {
                            reject(error);
                        } else {
                            resolve(text);
                        }
                    });
                });
            } catch (error) {
                let pe = parseError(error);
                if (pe.errorType === 'BlobNotFound') {
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
        // tslint:disable-next-line: no-void-expression
        this.isFileShareUri(uri) ? await this.writeFileFileShare(uri, content, options) : await this.writeFileBlobContainer(uri, content, options);
    }

    async writeFileFileShare(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        await callWithTelemetryAndErrorHandling('writeFileFileShare', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            let parsedUri = parseUri(uri);
            let fileShare: FileShareTreeItem = await this.lookupRootFileShare(uri, context);

            const fileService = fileShare.root.createFileService();
            let fileResultChild = await new Promise<azureStorage.FileService.FileResult>((resolve, reject) => {
                fileService.doesFileExist(parsedUri.rootName, parsedUri.parentDirPath, parsedUri.baseName, (error?: Error, result?: azureStorage.FileService.FileResult) => {
                    if (!!error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });

            let createNewFile: boolean = !fileResultChild.exists;
            if (createNewFile && !options.create) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            } else if (fileResultChild.exists && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
            } else {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    if (fileResultChild.exists) {
                        progress.report({ message: `Saving file ${parsedUri.filePath}` });

                        await new Promise<azureStorage.FileService.FileResult>((resolve, reject) => {
                            fileService.createFileFromText(parsedUri.rootName, parsedUri.parentDirPath, parsedUri.baseName, content.toString(), (error?: Error, result?: azureStorage.FileService.FileResult) => {
                                if (!!error) {
                                    reject(error);
                                } else {
                                    resolve(result);
                                }
                            });
                        });
                    } else {
                        progress.report({ message: `Creating file ${parsedUri.filePath}` });

                        let parentUri: vscode.Uri = idToUri(path.posix.join(parsedUri.rootPath, parsedUri.parentDirPath));
                        let parent = await this.lookupAsDirectoryFileShare(parentUri, context);

                        await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFile', childName: parsedUri.baseName });
                    }
                });
            }
        });
    }

    async writeFileBlobContainer(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('writeFileBlobContainer', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            let parsedUri = parseUri(uri);
            let blobContainer: BlobContainerTreeItem = await this.getRootBlobContainer(uri, context);

            const blobService = blobContainer.root.createBlobService();
            let blobResultChild = await new Promise<azureStorage.BlobService.BlobResult>((resolve, reject) => {
                blobService.doesBlobExist(parsedUri.rootName, parsedUri.filePath, (error?: Error, result?: azureStorage.BlobService.BlobResult) => {
                    if (!!error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });

            if (!blobResultChild.exists && !options.create) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            } else if (blobResultChild.exists && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
            } else {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    if (blobResultChild.exists) {
                        progress.report({ message: `Saving blob ${parsedUri.filePath}` });
                        await new Promise<void>((resolve, reject) => {
                            let contentType: string | null = mime.getType(parsedUri.filePath);
                            let temp: string | undefined = contentType === null ? undefined : contentType;
                            blobService.createBlockBlobFromText(parsedUri.rootName, parsedUri.filePath, content.toString(), { contentSettings: { contentType: temp } }, (error?: Error) => {
                                if (!!error) {
                                    reject(error);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    } else {
                        progress.report({ message: `Creating blob ${parsedUri.filePath}` });
                        let parent = parsedUri.parentDirPath;
                        let dir = await this.lookupAsDirectoryBlobContainer(idToUri(path.posix.join(parsedUri.rootPath, parent)), context);
                        await dir.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlob', childName: parsedUri.filePath });
                    }
                });
            }
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        // tslint:disable-next-line: no-void-expression
        this.isFileShareUri(uri) ? await this.deleteFileShare(uri, options) : await this.deleteBlobContainer(uri, options);
    }

    async deleteFileShare(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('deleteFileShare', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            let parsedUri = parseUri(uri);
            let fileFound: EntryTreeItem = await this.lookupFileShare(uri, context);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                if (fileFound instanceof FileTreeItem || fileFound instanceof DirectoryTreeItem) {
                    progress.report({ message: `Deleting ${parsedUri.filePath}` });
                    await fileFound.deleteTreeItem(<IDirectoryDeleteContext>{ ...context, suppressMessage: true });
                } else {
                    throw new RangeError(`Unexpected entry ${fileFound.constructor.name}.`);
                }
            });
        });
    }

    async deleteBlobContainer(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('deleteBlobContainer', async (context) => {
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error('Do not support non recursive deletion of folders or files.');
            }

            let ti = await this.lookup(uri, context);
            if (ti instanceof BlobTreeItem) {
                context.errorHandling.rethrow = true;
            }
            await ti.deleteTreeItem(context);
        });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('rename', async (context) => {
            showRenameError(oldUri, newUri, context);
        });
    }

    async lookup(uri: vscode.Uri, context: IActionContext): Promise<BlobContainerEntryTreeItem | FileShareEntryTreeItem> {
        return this.isFileShareUri(uri) ? await this.lookupFileShare(uri, context) : await this.lookupBlobContainer(uri, context);
    }

    private async lookupFileShare(uri: vscode.Uri, context: IActionContext): Promise<EntryTreeItem> {
        let parsedUri = parseUri(uri);
        let uriPath = path.posix.join(parsedUri.rootPath, parsedUri.filePath);
        let ti = await ext.tree.findTreeItem(uriPath, context);
        if (!ti) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (ti instanceof FileShareTreeItem || ti instanceof FileTreeItem || ti instanceof DirectoryTreeItem) {
            return ti;
        } else {
            throw new RangeError(`Unexpected entry ${ti.constructor.name}.`);
        }
    }

    private async lookupBlobContainer(uri: vscode.Uri, context: IActionContext, endSearchEarly?: boolean): Promise<BlobContainerEntryTreeItem> {
        let parsedUri = parseUri(uri);
        let ti: BlobContainerEntryTreeItem = await this.getRootBlobContainer(uri, context);
        if (parsedUri.filePath === '') {
            return ti;
        }

        let pathToLook = parsedUri.filePath.split('/');
        for (const childName of pathToLook) {
            if (ti instanceof BlobTreeItem) {
                if (endSearchEarly) {
                    return ti;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            let children: AzExtTreeItem[] = await ti.getCachedChildren(context);
            let child = children.find(element => path.basename(element.label) === childName);
            if (!child) {
                if (endSearchEarly) {
                    return ti;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            if (child instanceof BlobTreeItem || child instanceof BlobDirectoryTreeItem) {
                ti = child;
            } else {
                throw new RangeError(`Unexpected entry ${child.label}`);
            }
        }

        return ti;
    }

    private async lookupRootFileShare(uri: vscode.Uri, context: IActionContext): Promise<FileShareTreeItem> {
        let parsedUri: IParsedUri = parseUri(uri);
        let ti = await ext.tree.findTreeItem(parsedUri.rootPath, context);
        if (!ti) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (ti instanceof FileShareTreeItem) {
            return ti;
        } else {
            throw new RangeError(`Unexpected entry ${ti.constructor.name}.`);
        }
    }

    private async lookupAsDirectoryFileShare(uri: vscode.Uri, context: IActionContext): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookupFileShare(uri, context);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw new RangeError(`Unexpected entry ${entry.constructor.name}.`);
    }

    private async lookupAsDirectoryBlobContainer(uri: vscode.Uri, context: IActionContext): Promise<BlobDirectoryTreeItem | BlobContainerTreeItem> {
        let ti = await this.lookupBlobContainer(uri, context);
        if (ti instanceof BlobDirectoryTreeItem || ti instanceof BlobContainerTreeItem) {
            return ti;
        } else {
            throw RangeError(`Unexpected entry ${ti.constructor.name}.`);
        }
    }

    private async getRootBlobContainer(uri: vscode.Uri, context: IActionContext): Promise<BlobContainerTreeItem> {
        let rootPath = parseUri(uri).rootPath;
        let root = await ext.tree.findTreeItem(rootPath, context);
        if (!root) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (root instanceof BlobContainerTreeItem) {
            return root;
        } else {
            throw new RangeError(`Unexpected entry ${root.constructor.name}.`);
        }
    }

    private isFileShareUri(uri: vscode.Uri): boolean {
        return uri.query.indexOf('File Shares') > 0;
    }
}
