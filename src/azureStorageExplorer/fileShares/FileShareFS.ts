/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext, parseError } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { findRoot } from "../findRoot";
import { getFileSystemError } from "../getFileSystemError";
import { parseUri } from "../parseUri";
import { DirectoryTreeItem } from './directoryNode';
import { createDirectory, deleteDirectoryAndContents } from "./directoryUtils";
import { FileTreeItem } from "./fileNode";
import { FileShareTreeItem } from "./fileShareNode";
import { deleteFile } from "./fileUtils";
import { validateDirectoryName } from "./validateNames";

export type EntryTreeItem = FileShareTreeItem | FileTreeItem | DirectoryTreeItem;

export class FileShareFS implements vscode.FileSystemProvider {
    private _fileShareString: string = 'File Shares';

    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    private _fileStatCache: Set<string> = new Set<string>();

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return await callWithTelemetryAndErrorHandling('fs.stat', async (context) => {
            if (this._fileStatCache.has(path.posix.join(uri.path, "1"))) {
                return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
            } else if (this._fileStatCache.has(path.posix.join(uri.path, "2"))) {
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            }

            let treeItem: EntryTreeItem = await this.lookup(uri, context);

            if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            } else {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
            }
            // tslint:disable-next-line: strict-boolean-expressions
        }) || { type: vscode.FileType.Unknown, ctime: 0, mtime: 0, size: 0 };
    }

    async readDirectory2(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
            let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri, context);

            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
            let listFilesandDirectoryResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);
            let entries = listFilesandDirectoryResult.entries;

            let result: [string, vscode.FileType][] = [];
            for (const dir of entries.directories) {
                let baseName: string = path.basename(dir.name);

                result.push([dir.name, vscode.FileType.Directory]);

                let childUri: string = path.posix.join(uri.path, baseName, "2");
                this._fileStatCache.add(childUri);
            }
            for (const file of entries.files) {
                let baseName: string = path.basename(file.name);

                result.push([file.name, vscode.FileType.File]);

                let childUri: string = path.posix.join(uri.path, baseName, "1");
                this._fileStatCache.add(childUri);
            }

            return result;
            // tslint:disable-next-line: strict-boolean-expressions
        }) || [];
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return <[string, vscode.FileType][]>await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
            let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri, context);

            await entry.loadMoreChildrenImpl(false);
            let children: AzExtTreeItem[] = await entry.getCachedChildren(context);

            return this.putChildrenIntoCache(uri, entry, children);
        });
    }

    putChildrenIntoCache(uri: vscode.Uri, entry: DirectoryTreeItem | FileShareTreeItem, children: AzExtTreeItem[]): [string, vscode.FileType][] {
        let result: [string, vscode.FileType][] = [];
        for (const child of children) {
            if (child instanceof FileTreeItem) {
                let baseName: string = path.basename(child.label);

                result.push([baseName, vscode.FileType.File]);

                let childUri: string = path.posix.join(uri.path, baseName, "1");
                this._fileStatCache.add(childUri);
            } else if (child instanceof DirectoryTreeItem) {
                let baseName: string = path.basename(child.label);

                result.push([baseName, vscode.FileType.Directory]);

                let childUri: string = path.posix.join(uri.path, baseName, "2");
                this._fileStatCache.add(childUri);
            }
        }

        // if (entry.hasMoreChildrenImpl()) {
        //     result.push(['Load More...', vscode.FileType.File]);
        //     let loadMoreUri: string = path.posix.join(uri.path, 'Load More...', "1");
        //     this._fileStatCache.add(loadMoreUri);
        // }

        return result;
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.createDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            let parsedUri = parseUri(uri, this._fileShareString);
            let fileShare: FileShareTreeItem = await this.getRoot(uri, context);

            let response: string | undefined | null = validateDirectoryName(parsedUri.baseName);
            if (response) {
                throw new Error(response);
            }

            try {
                await createDirectory(fileShare.share, fileShare.root, parsedUri.parentDirPath, parsedUri.baseName);
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

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('fs.readFile', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let parsedUri = parseUri(uri, this._fileShareString);

            if (parsedUri.baseName === 'Load More...') {
                await this.loadMore(uri, context);
                return Buffer.from(''); // to do: fix so that it doesn't show an empty file for Load More...
            }

            let treeItem: FileShareTreeItem = await this.getRoot(uri, context);
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

    async loadMore(uri: vscode.Uri, context: IActionContext): Promise<void> {
        let parsedUri = parseUri(uri, this._fileShareString);
        let parentUri = vscode.Uri.file(path.posix.join(parsedUri.rootPath, parsedUri.parentDirPath));

        let entry: FileShareTreeItem | DirectoryTreeItem = await this.lookupAsDirectory(context, parentUri);

        await ext.tree.loadMore(entry, context);

        let children = await entry.getCachedChildren(context);

        this.putChildrenIntoCache(uri, entry, children);

        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri: parentUri }]); // to do: can't trigger read directory
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            let parsedUri = parseUri(uri, this._fileShareString);
            let fileShare: FileShareTreeItem = await this.getRoot(uri, context);

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

            if (!fileResultChild.exists && !options.create) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            } else if (fileResultChild.exists && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
            } else {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    if (fileResultChild.exists) {
                        progress.report({ message: `Saving file ${parsedUri.filePath}` });
                    } else {
                        progress.report({ message: `Creating file ${parsedUri.filePath}` });
                    }

                    await new Promise<void>((resolve, reject) => {
                        fileService.createFileFromText(parsedUri.rootName, parsedUri.parentDirPath, parsedUri.baseName, content.toString(), (error?: Error) => {
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
        await callWithTelemetryAndErrorHandling('fs.delete', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            let parsedUri = parseUri(uri, this._fileShareString);

            let fileFound: EntryTreeItem = await this.lookup(uri, context);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                if (fileFound instanceof FileTreeItem) {
                    progress.report({ message: `Deleting file ${parsedUri.filePath}` });
                    await deleteFile(fileFound.directoryPath, fileFound.file.name, fileFound.share.name, fileFound.root);
                } else if (fileFound instanceof DirectoryTreeItem) {
                    progress.report({ message: `Deleting directory ${parsedUri.filePath}` });
                    await deleteDirectoryAndContents(parsedUri.filePath, fileFound.share.name, fileFound.root);
                } else {
                    throw new RangeError(`Unexpected entry ${fileFound.constructor.name}.`);
                }
            });
        });
    }

    async rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('fs.rename', async () => {
            throw new Error('Renaming/moving folders or files not supported.');
        });
    }

    private async lookupAsDirectory(uri: vscode.Uri, context: IActionContext): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookup(uri, context);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw new RangeError(`Unexpected entry ${entry.constructor.name}.`);
    }

    private async lookup(uri: vscode.Uri, context: IActionContext): Promise<EntryTreeItem> {
        let parsedUri = parseUri(uri, this._fileShareString);

        let entry: EntryTreeItem = await this.getRoot(uri, context);
        if (parsedUri.filePath === '') {
            return entry;
        }

        let parentPath = '';
        let parts = parsedUri.filePath.split('/');
        for (let part of parts) {
            if (entry instanceof FileTreeItem) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            let temp: AzExtTreeItem[] = await entry.getCachedChildren(context);
            let childFound: AzExtTreeItem | undefined = temp.find(element => element.label === part);

            if (!childFound) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }

            if (childFound instanceof DirectoryTreeItem) {
                let dirResult: azureStorage.FileService.DirectoryResult = { name: parsedUri.baseName, etag: "", lastModified: "" };
                entry = new DirectoryTreeItem(entry, parentPath, dirResult, <azureStorage.FileService.ShareResult>entry.share);
            } else if (childFound instanceof FileTreeItem) {
                let fileResult: azureStorage.FileService.FileResult = { share: parsedUri.rootName, directory: parsedUri.parentDirPath, name: parsedUri.baseName, etag: "", lastModified: "", acceptRanges: "", contentRange: "", contentLength: "" };
                entry = new FileTreeItem(entry, fileResult, parentPath, <azureStorage.FileService.ShareResult>entry.share);
            }

            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            // let listFilesAndDirectoriesResult: azureStorage.FileService.ListFilesAndDirectoriesResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);
            // let entries = listFilesAndDirectoriesResult.entries;

            // let directoryResultChild = entries.directories.find(element => element.name === part);
            // if (!!directoryResultChild) {
            //     entry = new DirectoryTreeItem(entry, parentPath, directoryResultChild, <azureStorage.FileService.ShareResult>entry.share);
            //     parentPath = path.posix.join(parentPath, part);
            // } else {
            //     let fileResultChild = entries.files.find(element => element.name === part);
            //     if (!!fileResultChild) {
            //         entry = new FileTreeItem(entry, fileResultChild, parentPath, <azureStorage.FileService.ShareResult>entry.share);
            //     } else {
            //         throw vscode.FileSystemError.FileNotFound(uri);
            //     }
            // }
        }

        return entry;
    }

    private async getRoot(uri: vscode.Uri, context: IActionContext): Promise<FileShareTreeItem> {
        let root = await findRoot(uri, this._fileShareString, context);
        if (root instanceof FileShareTreeItem) {
            return root;
        } else {
            throw new RangeError(`Unexpected entry ${root.constructor.name}.`);
        }
    }
}
