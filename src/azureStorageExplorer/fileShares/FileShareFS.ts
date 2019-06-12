/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { DirectoryTreeItem } from './directoryNode';
import { FileFileHandler } from "./fileFileHandler";
import { FileTreeItem } from "./fileNode";
import { FileShareGroupTreeItem } from './fileShareGroupNode';
import { FileShareTreeItem2 } from './fileShareNode2';

export type EntryTreeItem = FileShareGroupTreeItem | FileShareTreeItem2 | FileTreeItem | DirectoryTreeItem;

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

    // tslint:disable-next-line: typedef
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat | Thenable<vscode.FileStat>> {
        let entry: EntryTreeItem | undefined = await this.lookup(uri, false);

        if (!!entry) {
            if (entry instanceof FileTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return new FileStatImpl(vscode.FileType.File, 0, 0, 0);
            } else if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem2) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return new FileStatImpl(vscode.FileType.Directory, 0, 0, 0);
            }
        }

        throw vscode.FileSystemError.FileNotFound(uri);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        let entry: DirectoryTreeItem | FileShareTreeItem2 = await this.lookupAsDirectory(uri, false);

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

    createDirectory(_uri: vscode.Uri): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        let fileFound: FileTreeItem = await this.lookupAsFile(uri, false);

        let fileFileHandler: FileFileHandler = new FileFileHandler();
        await fileFileHandler.downloadFile(fileFound, fileFound.fullId);

        let data = new Uint8Array(0);
        return data;
    }

    writeFile(_uri: vscode.Uri, _content: Uint8Array, _options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    // tslint:disable-next-line: no-reserved-keywords
    delete(_uri: vscode.Uri, _options: { recursive: boolean; }): void {
        throw new Error("Method not implemented.");
    }

    rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): void {
        throw new Error("Method not implemented.");
    }

    private async lookupAsFile(uri: vscode.Uri, silent: boolean): Promise<FileTreeItem> {
        let entry = await this.lookup(uri, silent);
        if (entry instanceof FileTreeItem) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    private async lookupAsDirectory(uri: vscode.Uri, silent: boolean): Promise<DirectoryTreeItem | FileShareTreeItem2> {
        let entry = await this.lookup(uri, silent);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem2) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private async lookup(uri: vscode.Uri, silent: boolean): Promise<EntryTreeItem | undefined> {
        return <EntryTreeItem>await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let parentPath = '/';

            let temp = uri.authority + uri.path;

            let endOfRootPath = temp.indexOf('File Shares');
            let rootPath = temp.substring(0, endOfRootPath + 11);
            let root: EntryTreeItem = <EntryTreeItem>await ext.tree.findTreeItem(rootPath, context);

            let branchPath = temp.substring(endOfRootPath + 11);
            let parts = branchPath.split('/').slice(1);

            let entry: EntryTreeItem = root;

            let shareResult: azureStorage.FileService.ShareResult | undefined;

            for (const part of parts) {
                if (entry instanceof FileShareGroupTreeItem) {

                    let continuationToken: azureStorage.common.ContinuationToken | undefined;

                    do {
                        // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
                        let listShareResult = await entry.listFileShares(<azureStorage.common.ContinuationToken>continuationToken!);

                        continuationToken = listShareResult.continuationToken;

                        let entries = listShareResult.entries;
                        let fileShareResultChild = entries.find(element => element.name === part);

                        if (fileShareResultChild) {
                            shareResult = fileShareResultChild;
                            entry = new FileShareTreeItem2(entry, shareResult);
                            break;
                        }
                    } while (continuationToken !== undefined);
                } else if (entry instanceof FileShareTreeItem2 || entry instanceof DirectoryTreeItem) {

                    let continuationToken: azureStorage.common.ContinuationToken | undefined;

                    do {
                        // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
                        let listFilesAndDirectoriesResult = await entry.listFiles(<azureStorage.common.ContinuationToken>continuationToken!);

                        continuationToken = listFilesAndDirectoriesResult.continuationToken;

                        let entries = listFilesAndDirectoriesResult.entries;

                        let directoryResultChild = entries.directories.find(element => element.name === part);
                        let fileResultChild = entries.files.find(element => element.name === part);

                        if (directoryResultChild) {
                            entry = new DirectoryTreeItem(entry, parentPath, directoryResultChild, <azureStorage.FileService.ShareResult>shareResult);
                            // tslint:disable-next-line: prefer-template
                            parentPath = parentPath + part + '/';
                            break;
                        }
                        if (fileResultChild) {
                            entry = new FileTreeItem(entry, fileResultChild, parentPath, <azureStorage.FileService.ShareResult>shareResult);
                            break;
                        }
                    } while (continuationToken !== undefined);
                } else {
                    if (!silent) {
                        throw vscode.FileSystemError.FileNotFound(uri);
                    } else {
                        return undefined;
                    }
                }
            }

            return entry;
        });
    }
}
