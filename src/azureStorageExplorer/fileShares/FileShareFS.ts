/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { findRoot } from "../findRoot";
import { parseUri } from "../parseUri";
import { DirectoryTreeItem } from './directoryNode';
import { FileTreeItem } from "./fileNode";
import { FileShareGroupTreeItem } from './fileShareGroupNode';
import { FileShareTreeItem } from "./fileShareNode";

export type EntryTreeItem = FileShareGroupTreeItem | FileShareTreeItem | FileTreeItem | DirectoryTreeItem;

export class FileShareFS implements vscode.FileSystemProvider {

    private _fileShareString: string = 'File Shares';

    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return <vscode.FileStat>await callWithTelemetryAndErrorHandling('fs.stat', async (context) => {
            let treeItem: EntryTreeItem = await this.lookup(uri, context);

            if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            } else if (treeItem instanceof FileTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
            } else if (treeItem instanceof FileShareGroupTreeItem) {
                throw new Error('Cannot view multiple File Shares at once.');
            }

            throw vscode.FileSystemError.FileNotFound(uri);
        });
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return <[string, vscode.FileType][]>await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri, context);

            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
            let listFilesandDirectoryResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);
            let entries = listFilesandDirectoryResult.entries;

            let result: [string, vscode.FileType][] = [];
            for (const dir of entries.directories) {
                result.push([dir.name, vscode.FileType.Directory]);
            }
            for (const file of entries.files) {
                result.push([file.name, vscode.FileType.File]);
            }

            return result;
        });
    }

    createDirectory(_uri: vscode.Uri): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return <Uint8Array>await callWithTelemetryAndErrorHandling('fs.readFile', async (context) => {
            // let root: FileShareTreeItem | FileShareGroupTreeItem = await this.getRoot(context, uri);
            let treeItem: FileTreeItem = await this.lookupAsFile(uri, context);

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
        });
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw vscode.FileSystemError.NoPermissions(uri);
            }

            let parsedUri = parseUri(uri, this._fileShareString);
            let root: FileShareTreeItem | FileShareGroupTreeItem = await this.getRoot(context, uri);

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
                await new Promise<void>((resolve, reject) => {
                    fileService.createFileFromText(parsedUri.rootName, parsedUri.parentDirPath, parsedUri.baseName, content.toString(), (error?: Error) => {
                        if (!!error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.delete', async (context) => {
            context.errorHandling.rethrow = true;

            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            let fileFound: EntryTreeItem = await this.lookup(uri, context);
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

    public async lookupAsFile(uri: vscode.Uri, context: IActionContext): Promise<FileTreeItem> {
        let entry = await this.lookup(uri, context);
        if (entry instanceof FileTreeItem) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotFound(uri);
    }

    private async lookupAsDirectory(uri: vscode.Uri, context: IActionContext): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookup(uri, context);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private async lookup(uri: vscode.Uri, context: IActionContext): Promise<EntryTreeItem> {
        context.errorHandling.rethrow = true;
        context.errorHandling.suppressDisplay = true;

        let parsedUri = parseUri(uri, this._fileShareString);
        let entry: EntryTreeItem = await this.getRoot(context, uri);
        if (parsedUri.filePath === '') {
            return entry;
        }

        let parentPath = '';
        let parts = parsedUri.filePath.split('/');
        for (let part of parts) {
            if (entry instanceof FileTreeItem) {
                throw vscode.FileSystemError.FileNotFound(uri);
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
                    throw vscode.FileSystemError.FileNotFound(uri);
                }
            }
        }

        return entry;
    }

    private async getRoot(context: IActionContext, uri: vscode.Uri): Promise<FileShareTreeItem> {
        let root = await findRoot(context, uri, this._fileShareString);

        if (root instanceof FileShareTreeItem) {
            return root;
        } else {
            throw new RangeError('The root found must be a FileShareTreeItem.');
        }
    }
}
