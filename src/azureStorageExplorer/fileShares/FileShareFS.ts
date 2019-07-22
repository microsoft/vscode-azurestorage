/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, GenericTreeItem, IActionContext } from "vscode-azureextensionui";
import { findRoot } from "../findRoot";
import { parseUri } from "../parseUri";
import { DirectoryTreeItem } from './directoryNode';
import { createDirectory, deleteDirectoryAndContents } from "./directoryUtils";
import { FileTreeItem } from "./fileNode";
import { FileShareGroupTreeItem } from './fileShareGroupNode';
import { FileShareTreeItem } from "./fileShareNode";
import { deleteFile } from "./fileUtils";
import { validateDirectoryName } from "./validateNames";

export type EntryTreeItem = FileShareGroupTreeItem | FileShareTreeItem | FileTreeItem | DirectoryTreeItem;

export class FileShareFS implements vscode.FileSystemProvider {

    private _fileShareString: string = 'File Shares';

    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    // To detect uris that vscode automatically calls so that we do not throw unnecessary errors
    private _configUri: string[] = ['pom.xml', 'node_modules', '.vscode', '.vscode/settings.json', '.vscode/tasks.json', '.vscode/launch.json', '.git/config'];
    private _configRootNames: string[] = ['pom.xml', 'node_modules', '.git', '.vscode'];

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return <vscode.FileStat>await callWithTelemetryAndErrorHandling('fs.stat', async (context) => {
            let treeItem: EntryTreeItem | undefined = await this.lookup(uri, context);

            if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            } else if (treeItem instanceof FileTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
            } else if (treeItem instanceof FileShareGroupTreeItem) {
                throw new Error('Cannot view multiple File Shares at once.');
            } else {
                throw this.getFileNotFoundError(uri, context);
            }
        });
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return <[string, vscode.FileType][]>await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
            let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri, context);

            let children: AzExtTreeItem[] = [];
            if (entry.hasMoreChildrenImpl()) {
                children = await entry.loadMoreChildrenImpl(false);
            }
            let previousChildren: AzExtTreeItem[] = await entry.getCachedChildren(context);
            let allChildren: AzExtTreeItem[] = previousChildren.concat(children);

            let result: [string, vscode.FileType][] = [];
            for (const child of allChildren) {
                if (child instanceof DirectoryTreeItem) {
                    result.push([child.label, vscode.FileType.Directory]);
                } else if (child instanceof FileTreeItem) {
                    result.push([child.label, vscode.FileType.File]);
                } else if (child instanceof GenericTreeItem) {
                    // do nothing
                }
            }

            if (entry.hasMoreChildrenImpl()) {
                result.push(['Load More...', vscode.FileType.File]);
            }

            return result;
        });
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        return <void>await callWithTelemetryAndErrorHandling('fs.createDirectory', async (context) => {
            let parsedUri = parseUri(uri, this._fileShareString);
            let root: FileShareTreeItem = await this.getRoot(uri, context);

            let response: string | undefined | null = validateDirectoryName(parsedUri.baseName);
            if (response) {
                throw new Error(response);
            }

            await createDirectory(root.share, root.root, parsedUri.parentDirPath, parsedUri.baseName);
        });
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array | undefined> {
        return <Uint8Array | undefined>await callWithTelemetryAndErrorHandling('fs.readFile', async (context) => {
            context.errorHandling.suppressDisplay = true;
            context.errorHandling.rethrow = true;

            let parsedUri = parseUri(uri, this._fileShareString);

            if (parsedUri.baseName === 'Load More...') {
                // detect you are trying to load more instead of actually getting a file called load more...
                return Buffer.from('');
            }

            if (this._configUri.includes(parsedUri.filePath) || this._configRootNames.includes(parsedUri.rootName)) {
                context.errorHandling.suppressDisplay = true;
                return undefined;
            }

            let treeItem: FileShareTreeItem = await this.getRoot(uri, context);
            let fileService = treeItem.root.createFileService();
            const result = await new Promise<string | undefined>((resolve, reject) => {
                fileService.getFileToText(treeItem.share.name, parsedUri.parentDirPath, parsedUri.baseName, (error?: Error, text?: string) => {
                    if (!!error) {
                        reject(error);
                    } else {
                        resolve(text);
                    }
                });
            });

            // tslint:disable-next-line: strict-boolean-expressions
            return Buffer.from(result || '');
        });
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        return <void>await callWithTelemetryAndErrorHandling('fs.writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw vscode.FileSystemError.NoPermissions(uri);
            }

            let parsedUri = parseUri(uri, this._fileShareString);
            let root: FileShareTreeItem = await this.getRoot(uri, context);

            const fileService = root.root.createFileService();
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
                throw vscode.FileSystemError.FileNotFound(uri);
            } else if (fileResultChild.exists && !options.overwrite) {
                throw vscode.FileSystemError.FileExists(uri);
            } else {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    if (fileResultChild.exists) {
                        progress.report({ message: `Saving blob ${parsedUri.filePath}` });
                    } else {
                        progress.report({ message: `Creating blob ${parsedUri.filePath}` });
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
        return <void>await callWithTelemetryAndErrorHandling('fs.delete', async (context) => {
            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            let parsedUri = parseUri(uri, this._fileShareString);
            let fileFound: EntryTreeItem | undefined = await this.lookup(uri, context);
            if (fileFound instanceof FileTreeItem) {
                await deleteFile(fileFound.directoryPath, fileFound.file.name, fileFound.share.name, fileFound.root);
            } else if (fileFound instanceof DirectoryTreeItem) {
                await deleteDirectoryAndContents(parsedUri.filePath, fileFound.share.name, fileFound.root);
            } else if (fileFound instanceof FileShareGroupTreeItem || fileFound instanceof FileShareTreeItem) {
                throw new RangeError("Cannot delete a FileShare or the folder of FileShares.");
            } else {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
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
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private async lookup(uri: vscode.Uri, context: IActionContext): Promise<EntryTreeItem | undefined> {
        let parsedUri = parseUri(uri, this._fileShareString);

        if (this._configUri.includes(parsedUri.filePath) || this._configRootNames.includes(parsedUri.rootName)) {
            context.errorHandling.suppressDisplay = true;
            return undefined;
        }

        let entry: EntryTreeItem = await this.getRoot(uri, context);
        if (parsedUri.filePath === '') {
            return entry;
        }

        let parentPath = '';
        let parts = parsedUri.filePath.split('/');
        for (let part of parts) {
            if (entry instanceof FileTreeItem) {
                throw this.getFileNotFoundError(uri, context);
            }
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
            let listFilesAndDirectoriesResult: azureStorage.FileService.ListFilesAndDirectoriesResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);
            let entries = listFilesAndDirectoriesResult.entries;

            let directoryResultChild = entries.directories.find(element => element.name === part);
            if (!!directoryResultChild) {
                entry = new DirectoryTreeItem(entry, parentPath, directoryResultChild, <azureStorage.FileService.ShareResult>entry.share);
                parentPath = path.posix.join(parentPath, part);
            } else {
                let fileResultChild = entries.files.find(element => element.name === part);
                if (!!fileResultChild) {
                    entry = new FileTreeItem(entry, fileResultChild, parentPath, <azureStorage.FileService.ShareResult>entry.share);
                } else {
                    throw this.getFileNotFoundError(uri, context);
                }
            }
        }

        return entry;
    }

    private async getRoot(uri: vscode.Uri, context: IActionContext): Promise<FileShareTreeItem> {
        let root = await findRoot(uri, this._fileShareString, context);

        if (root instanceof FileShareTreeItem) {
            return root;
        } else {
            throw new RangeError('The root found must be a FileShareTreeItem.');
        }
    }

    private getFileNotFoundError(uri: vscode.Uri, context: IActionContext): Error {
        context.errorHandling.rethrow = true;
        context.errorHandling.suppressDisplay = true;
        return vscode.FileSystemError.FileNotFound(uri);
    }
}
