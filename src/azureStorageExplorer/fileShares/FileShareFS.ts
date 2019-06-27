/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling } from "vscode-azureextensionui";
import { ext } from '../../extensionVariables';
import { DirectoryTreeItem } from './directoryNode';
import { createDirectory } from "./directoryUtils";
import { FileTreeItem } from "./fileNode";
import { FileShareGroupTreeItem } from './fileShareGroupNode';
import { FileShareTreeItem } from "./fileShareNode";
import { createFile } from "./fileUtils";
import { validateDirectoryName } from "./validateNames";

export type EntryTreeItem = FileShareGroupTreeItem | FileShareTreeItem | FileTreeItem | DirectoryTreeItem;

class FileStatImpl implements vscode.FileStat {
    // tslint:disable-next-line: no-reserved-keywords
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    constructor(
        // tslint:disable-next-line: no-reserved-keywords
        type: vscode.FileType,
        ctime: number,
        mtime: number,
        size: number
    ) {
        this.type = type;
        this.ctime = ctime;
        this.mtime = mtime;
        this.size = size;
    }
}

export class FileShareFS implements vscode.FileSystemProvider {

    private _rootMap: Map<string, FileShareTreeItem> = new Map<string, FileShareTreeItem>();

    // tslint:disable-next-line: typedef
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat | Thenable<vscode.FileStat>> {
        let treeItem: EntryTreeItem = await this.lookup(uri);

        if (treeItem instanceof FileTreeItem) {
            // creation and modification times as well as size of tree item are intentionally set to 0 for now
            return new FileStatImpl(vscode.FileType.File, 0, 0, 0);
        } else if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem) {
            // creation and modification times as well as size of tree item are intentionally set to 0 for now
            return new FileStatImpl(vscode.FileType.Directory, 0, 0, 0);
        }

        throw vscode.FileSystemError.FileNotFound(uri);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri);

        // Intentionally passing undefined for token - only supports listing first batch of files for now
        // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
        let listFilesandDirectoryResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);
        let entries = listFilesandDirectoryResult.entries;

        let result: [string, vscode.FileType][] = [];
        for (const directory of entries.directories) {
            result.push([directory.name, vscode.FileType.Directory]);
        }
        for (const file of entries.files) {
            result.push([file.name, vscode.FileType.File]);
        }

        return result;
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        let parsedUri = this.parseUri(uri);

        const foundRoot = this._rootMap.get(parsedUri.fileShareName);
        const root = !!foundRoot ? foundRoot : await this.findRoot(uri);

        if (!root) {
            throw new Error('Cannot make a directory that is more than one level down.');
        }

        let dirName = parsedUri.baseName;
        let parentPath = parsedUri.parentPath;

        let response: string | undefined | null = validateDirectoryName(dirName);
        if (response) {
            throw new Error(response); // how to show to user???
        }

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            progress.report({ message: `Azure Storage: Creating directory '${path.posix.join(parentPath, dirName)}'` });
            let dir = await createDirectory(root.share, root.root, parentPath, dirName);

            // DirectoryResult.name contains the parent path in this call, but doesn't in other places such as listing directories.
            // Remove it here to be consistent.
            dir.name = dirName;
        });

        // have a reset here
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        let treeItem: FileTreeItem = await this.lookupAsFile(uri);

        let fileService = treeItem.root.createFileService();

        const result = await new Promise<string | undefined>((resolve, reject) => {
            fileService.getFileToText(treeItem.share.name, treeItem.directoryPath, treeItem.file.name, (error?: Error, text?: string) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(text);
                }
            });
        });

        // tslint:disable-next-line: strict-boolean-expressions
        return Buffer.from(result || '');
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        if (!options.create && !options.overwrite) {
            throw vscode.FileSystemError.NoPermissions(uri);
        }

        let dirUri = vscode.Uri.file(path.dirname(uri.path));
        let dirTreeItem: FileShareTreeItem | DirectoryTreeItem = await this.lookupAsDirectory(dirUri);

        const parentPath: string = dirTreeItem instanceof DirectoryTreeItem ? path.join(dirTreeItem.parentPath, dirTreeItem.directory.name) : '';

        let fileResultChild = await new Promise<azureStorage.FileService.FileResult>((resolve, reject) => {
            const fileService = dirTreeItem.root.createFileService();
            fileService.doesFileExist(dirTreeItem.share.name, parentPath, path.basename(uri.path), (error?: Error, result?: azureStorage.FileService.FileResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        if (!fileResultChild.exists && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        if (fileResultChild.exists && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }

        if (!fileResultChild.exists && options.create) {
            const fileName: string = path.basename(uri.path);
            fileResultChild = await createFile(parentPath, fileName, dirTreeItem.share, dirTreeItem.root);
        }

        if (options.overwrite) {
            let fileTreeItem: FileTreeItem = new FileTreeItem(dirTreeItem, fileResultChild, parentPath, <azureStorage.FileService.ShareResult>dirTreeItem.share);
            await this.updateFileContent(fileTreeItem, content);
        }
    }

    private async updateFileContent(fileTreeItem: FileTreeItem, content: Uint8Array): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const fileService = fileTreeItem.root.createFileService();
            fileService.createFileFromText(fileTreeItem.share.name, fileTreeItem.directoryPath, fileTreeItem.file.name, content.toString(), (error?: Error) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.delete', async (context) => {
            context.errorHandling.rethrow = true;

            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            let fileFound: EntryTreeItem = await this.lookup(uri);

            if (fileFound instanceof FileTreeItem || fileFound instanceof DirectoryTreeItem) {
                await fileFound.deleteTreeItem(context);
            } else {
                throw new RangeError("Tried to delete a FileShare or the folder of FileShares.");
            }
        });
    }

    rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): void {
        throw new Error("Method not implemented.");
    }

    private async lookupAsFile(uri: vscode.Uri): Promise<FileTreeItem> {
        let entry = await this.lookup(uri);
        if (entry instanceof FileTreeItem) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotFound(uri);
    }

    private async lookupAsDirectory(uri: vscode.Uri): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookup(uri);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {

            return entry;
        }

        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private async lookup(uri: vscode.Uri): Promise<EntryTreeItem> {
        return <EntryTreeItem>await callWithTelemetryAndErrorHandling('fs.lookup', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            const fileShareString = 'File Shares';
            const endOfRootPathIndx = uri.path.indexOf(fileShareString) + fileShareString.length;
            let parts = uri.path.substring(endOfRootPathIndx).split('/').slice(1);

            const foundRoot = this._rootMap.get(parts[0]);
            const root = !!foundRoot ? foundRoot : await this.findRoot(uri);
            let entry: EntryTreeItem | undefined = !root ? undefined : root;

            if (!entry) {
                throw new RangeError('Could not find File Share.');
            }

            let parentPath = '';

            for (let part of parts.slice(1)) {
                if (entry instanceof FileShareTreeItem || entry instanceof DirectoryTreeItem) {
                    // Intentionally passing undefined for token - only supports listing first batch of files for now
                    // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
                    let listFilesAndDirectoriesResult: azureStorage.FileService.ListFilesAndDirectoriesResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);

                    let entries = listFilesAndDirectoriesResult.entries;

                    let directoryResultChild = entries.directories.find(element => element.name === part);
                    if (directoryResultChild) {
                        entry = new DirectoryTreeItem(entry, parentPath, directoryResultChild, <azureStorage.FileService.ShareResult>entry.share);
                        parentPath = path.join(parentPath, part);
                    } else {
                        let fileResultChild = entries.files.find(element => element.name === part);
                        if (fileResultChild) {
                            entry = new FileTreeItem(entry, fileResultChild, parentPath, <azureStorage.FileService.ShareResult>entry.share);
                        } else {
                            throw vscode.FileSystemError.FileNotFound(uri);
                        }
                    }
                } else {
                    throw vscode.FileSystemError.FileNotFound(uri);
                }
            }

            return entry;
        });
    }

    private async findRoot(uri: vscode.Uri): Promise<FileShareTreeItem | null> {
        return <FileShareTreeItem>await callWithTelemetryAndErrorHandling('fs.findRoot', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let parsedUri = this.parseUri(uri);
            let rootPath = path.join(parsedUri.rootPath, parsedUri.fileShareName);

            const rootFound = await ext.tree.findTreeItem(rootPath, context);

            if (rootFound instanceof FileShareTreeItem) {
                // const fileShareName = uri.path.substring(endOfFileShareIndx, endOfFileShareName);
                this._rootMap.set(parsedUri.fileShareName, <FileShareTreeItem>rootFound);
                return <FileShareTreeItem>rootFound;
            } else {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
        });
    }

    // Assumes 'File Shares' will be in the uri
    // returns [up to and including File Share (subscription stuff), file share name, parentPath, base name]
    private parseUri(uri: vscode.Uri): { rootPath: string, fileShareName: string, parentPath: string, baseName: string } {
        let parsedUri = path.parse(uri.path);

        let fileShareString = 'File Shares';
        let endOfRootPathIndx = parsedUri.dir.indexOf(fileShareString) + fileShareString.length;
        let postRootPath = endOfRootPathIndx === parsedUri.dir.length - 1 ? '' : parsedUri.dir.substring(endOfRootPathIndx + 1);
        let endOfFileShareNameIndx = postRootPath.indexOf('/');

        let rootPath = parsedUri.dir.substring(0, endOfRootPathIndx);
        let fileShareName = endOfFileShareNameIndx === -1 ? '' : postRootPath.substring(0, endOfFileShareNameIndx);
        let parentPath = endOfFileShareNameIndx === -1 ? '' : postRootPath.substring(endOfFileShareNameIndx + 1);
        let baseName = parsedUri.base;

        return { rootPath, fileShareName, parentPath, baseName };
    }
}
