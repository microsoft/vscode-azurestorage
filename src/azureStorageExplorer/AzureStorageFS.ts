/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext, parseError } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from './blobContainers/blobContainerNode';
import { BlobDirectoryTreeItem } from "./blobContainers/BlobDirectoryTreeItem";
import { BlobTreeItem } from './blobContainers/blobNode';
import { DirectoryTreeItem, IDirectoryDeleteContext } from './fileShares/directoryNode';
import { FileTreeItem } from "./fileShares/fileNode";
import { FileShareTreeItem, IFileShareCreateChildContext } from "./fileShares/fileShareNode";
import { validateDirectoryName } from "./fileShares/validateNames";
import { getFileSystemError } from "./getFileSystemError";
import { IParsedUri, parseUri } from "./parseUri";
import { showRenameError } from "./showRenameError";
// tslint:disable-next-line: no-require-imports tslint:disable-next-line: ordered-imports
import mime = require("mime");

export type EntryTreeItem = FileShareEntryTreeItem | BlobContainerEntryTreeItem;
export type FileShareEntryTreeItem = FileShareTreeItem | FileTreeItem | DirectoryTreeItem;
export type BlobContainerEntryTreeItem = BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;

export class AzureStorageFS implements vscode.FileSystemProvider {
    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    private _virtualDirCreatedUri: Set<string> = new Set();

    private _fileShareString: string = 'File Shares';

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return await callWithTelemetryAndErrorHandling('fileExplorer.stat', async (context) => {
            if (this._virtualDirCreatedUri.has(uri.path)) {
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            }

            let treeItem: EntryTreeItem = await this.lookup(uri, context);

            if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            } else {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
            }
            // tslint:disable-next-line: strict-boolean-expressions
        }) || { type: vscode.FileType.Unknown, ctime: 0, mtime: 0, size: 0 };
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        if (uri.query.indexOf(this._fileShareString) > 0) {
            return await this.readDirectoryFileShare(uri);
        } else {
            return await this.readDirectoryBlobContainer(uri);
        }
    }

    async readDirectoryFileShare(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
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
        return await callWithTelemetryAndErrorHandling('blob.readDirectory', async (context) => {
            let parsedUri = parseUri(uri);

            let blobContainer: BlobContainerTreeItem = await this.getRootBlobContainer(uri, context);
            const blobService = blobContainer.root.createBlobService();

            let listBlobResult: azureStorage.BlobService.ListBlobsResult;
            let listDirectoryResult: azureStorage.BlobService.ListBlobDirectoriesResult;

            try {
                listBlobResult = await this.listAllChildBlob(blobService, parsedUri.rootName, parsedUri.dirPath);
                listDirectoryResult = await this.listAllChildDirectory(blobService, parsedUri.rootName, parsedUri.dirPath);
            } catch (error) {
                let pe = parseError(error);
                if (pe.errorType === "ContainerNotFound") {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
                }
                throw error;
            }

            let directoryChildren: [string, vscode.FileType][] = [];
            for (const blobRes of listBlobResult.entries) {
                let baseName: string = path.basename(blobRes.name);
                directoryChildren.push([baseName, vscode.FileType.File]);
            }
            for (const dirRes of listDirectoryResult.entries) {
                let baseName: string = path.basename(dirRes.name);
                directoryChildren.push([baseName, vscode.FileType.Directory]);
            }
            for (let dirCreated of this._virtualDirCreatedUri) {
                let dirCreatedParsedUri = parseUri(dirCreated);
                let parentPath = path.posix.join(dirCreatedParsedUri.rootPath, dirCreatedParsedUri.parentDirPath);
                if (uri.path === parentPath || `${uri.path}\/` === parentPath) {
                    directoryChildren.push([dirCreatedParsedUri.baseName, vscode.FileType.Directory]);
                }
            }

            return directoryChildren;
            // tslint:disable-next-line: strict-boolean-expressions
        }) || [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        if (uri.query.indexOf(this._fileShareString) > 0) {
            await this.createDirectoryFileShare(uri);
        } else {
            await this.createDirectoryBlobContainer(uri);
        }
    }

    async createDirectoryFileShare(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.createDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            let parsedUri = parseUri(uri);

            let response: string | undefined | null = validateDirectoryName(parsedUri.baseName);
            if (response) {
                throw new Error(response);
            }

            try {
                let parentUri: vscode.Uri = vscode.Uri.file(path.posix.join(parsedUri.rootPath, parsedUri.parentDirPath));
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
        await callWithTelemetryAndErrorHandling('blob.createDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            if (this._virtualDirCreatedUri.has(uri.path)) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
            }

            this._virtualDirCreatedUri.add(uri.path);
        });
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        if (uri.query.indexOf(this._fileShareString) > 0) {
            return await this.readFileFileShare(uri);
        } else {
            return await this.readFileBlobContainer(uri);
        }
    }

    async readFileFileShare(uri: vscode.Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('fs.readFile', async (context) => {
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
        return await callWithTelemetryAndErrorHandling('blob.readFile', async (context) => {
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
        if (uri.query.indexOf(this._fileShareString) > 0) {
            await this.writeFileFileShare(uri, content, options);
        } else {
            await this.writeFileBlobContainer(uri, content, options);
        }
    }

    async writeFileFileShare(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.writeFile', async (context) => {
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

                        let parentUri: vscode.Uri = vscode.Uri.file(path.posix.join(parsedUri.rootPath, parsedUri.parentDirPath));
                        let parent = await this.lookupAsDirectoryFileShare(parentUri, context);

                        await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFile', childName: parsedUri.baseName });
                    }
                });
            }
        });
    }

    async writeFileBlobContainer(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('blob.writeFile', async (context) => {
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
                    } else {
                        progress.report({ message: `Creating blob ${parsedUri.filePath}` });
                    }

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
                });
            }
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        if (uri.query.indexOf(this._fileShareString) > 0) {
            await this.deleteFileShare(uri, options);
        } else {
            await this.deleteBlobContainer(uri, options);
        }
    }

    async deleteFileShare(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.delete', async (context) => {
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

    // tslint:disable-next-line: no-reserved-keywords
    async deleteBlobContainer(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('blob.delete', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error('Do not support non recursive deletion of folders or files.');
            }

            let parsedUri = parseUri(uri);
            let entry: EntryTreeItem;
            try {
                entry = await this.lookupBlobContainer(uri, context);
            } catch (err) {
                if (this._virtualDirCreatedUri.has(uri.path)) {
                    for (const virDirUri of this._virtualDirCreatedUri) {
                        if (virDirUri.startsWith(uri.path)) {
                            this._virtualDirCreatedUri.delete(virDirUri);
                        }
                    }
                    return;
                } else {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
                }
            }

            const blobService = entry.root.createBlobService();
            if (entry instanceof BlobTreeItem) {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    progress.report({ message: `Deleting blob ${parsedUri.filePath}` });
                    await this.deleteBlob(parsedUri.rootName, parsedUri.filePath, blobService);
                });
            } else if (entry instanceof BlobDirectoryTreeItem) {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    progress.report({ message: `Deleting directory ${parsedUri.filePath}` });
                    let errors: boolean = await this.deleteBlobFolder(parsedUri, blobService);

                    if (errors) {
                        // tslint:disable-next-line: no-multiline-string
                        ext.outputChannel.appendLine(`Please refresh the viewlet to see the changes made.`);

                        const viewOutput: vscode.MessageItem = { title: 'View Errors' };
                        const errorMessage: string = `Errors occured when deleting "${parsedUri.filePath}".`;
                        vscode.window.showWarningMessage(errorMessage, viewOutput).then(async (result: vscode.MessageItem | undefined) => {
                            if (result === viewOutput) {
                                ext.outputChannel.show();
                            }
                        });

                    }
                });
            } else if (entry instanceof BlobContainerTreeItem) {
                throw new Error('Cannot delete a Blob Container.');
            }
        });
    }

    private async deleteBlobFolder(parsedUri: IParsedUri, blobService: azureStorage.BlobService): Promise<boolean> {
        let dirPath: string | undefined = parsedUri.dirPath;
        let dirPaths: string[] = [];
        let errors: boolean = false;

        while (dirPath) {
            let childBlob = await this.listAllChildBlob(blobService, parsedUri.rootName, dirPath);
            for (const blob of childBlob.entries) {
                try {
                    await this.deleteBlob(parsedUri.rootName, blob.name, blobService);
                } catch (error) {
                    ext.outputChannel.appendLine(`Cannot delete ${blob.name}. ${parseError(error).message}`);
                    errors = true;
                }
            }

            let childDir = await this.listAllChildDirectory(blobService, parsedUri.rootName, dirPath);
            for (const dir of childDir.entries) {
                dirPaths.push(dir.name);
            }

            dirPath = dirPaths.pop();
        }
        return errors;
    }

    private async deleteBlob(containerName: string, prefix: string, blobService: azureStorage.BlobService): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            blobService.deleteBlob(containerName, prefix, (error?: Error) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('fileExplorer.rename', async (context) => {
            showRenameError(oldUri, newUri, context);
        });
    }

    async lookup(uri: vscode.Uri, context: IActionContext): Promise<BlobContainerEntryTreeItem | FileShareEntryTreeItem> {
        if (uri.query.indexOf(this._fileShareString) > 0) {
            return await this.lookupFileShare(uri, context);
        } else {
            return await this.lookupBlobContainer(uri, context);
        }
    }

    private async lookupFileShare(uri: vscode.Uri | string, context: IActionContext): Promise<EntryTreeItem> {
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

    private async lookupBlobContainer(uri: vscode.Uri, context: IActionContext): Promise<EntryTreeItem> {
        let parsedUri = parseUri(uri);

        let entry = await this.getRootBlobContainer(uri, context);
        if (parsedUri.filePath === '') {
            return entry;
        }

        let blobService = entry.root.createBlobService();

        const listBlobDirectoryResult = await this.listAllChildDirectory(blobService, parsedUri.rootName, parsedUri.parentDirPath);
        const directoryResultChild = listBlobDirectoryResult.entries.find(element => element.name === parsedUri.dirPath);
        if (!!directoryResultChild) {
            return new BlobDirectoryTreeItem(entry.root, parsedUri.baseName, parsedUri.parentDirPath, entry.container);
        } else {
            const listBlobResult = await this.listAllChildBlob(blobService, parsedUri.rootName, parsedUri.parentDirPath);
            const blobResultChild = listBlobResult.entries.find(element => element.name === parsedUri.filePath);
            if (!!blobResultChild) {
                return new BlobTreeItem(entry, blobResultChild, entry.container);
            }
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        }
    }

    private async lookupRootFileShare(uri: vscode.Uri, context: IActionContext): Promise<FileShareTreeItem> {
        let parsedUri: IParsedUri = parseUri(uri);
        let entry = await this.lookupFileShare(parsedUri.rootPath, context);
        if (entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw new RangeError(`Unexpected entry ${entry.constructor.name}.`);
    }

    private async lookupAsDirectoryFileShare(uri: vscode.Uri, context: IActionContext): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookupFileShare(uri, context);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw new RangeError(`Unexpected entry ${entry.constructor.name}.`);
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

    private async listAllChildDirectory(blobService: azureStorage.BlobService, blobContainerName: string, prefix: string): Promise<azureStorage.BlobService.ListBlobDirectoriesResult> {
        return await new Promise<azureStorage.BlobService.ListBlobDirectoriesResult>((resolve, reject) => {
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobDirectoriesSegmentedWithPrefix(blobContainerName, prefix, <azureStorage.common.ContinuationToken>undefined!, (error?: Error, result?: azureStorage.BlobService.ListBlobDirectoriesResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private async listAllChildBlob(blobService: azureStorage.BlobService, blobContainerName: string, prefix: string): Promise<azureStorage.BlobService.ListBlobsResult> {
        return await new Promise<azureStorage.BlobService.ListBlobsResult>((resolve, reject) => {
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobsSegmentedWithPrefix(blobContainerName, prefix, <azureStorage.common.ContinuationToken>undefined!, { delimiter: '/' }, (error?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }
}
