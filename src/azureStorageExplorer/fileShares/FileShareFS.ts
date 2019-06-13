/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { DirectoryTreeItem } from './directoryNode';
import { FileTreeItem } from "./fileNode";
import { FileShareGroupTreeItem } from './fileShareGroupNode';
import { FileShareTreeItem } from "./fileShareNode";

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
            } else if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return new FileStatImpl(vscode.FileType.Directory, 0, 0, 0);
            }
        }

        throw vscode.FileSystemError.FileNotFound(uri);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri, false);

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

    readFile(_uri: vscode.Uri): Uint8Array {
        throw new Error("Method not implemented.");
    }

    async writeFile(_uri: vscode.Uri, _content: Uint8Array, _options: { create: boolean; overwrite: boolean; }): Promise<void> {
        let treeItem: FileTreeItem = await this.lookupAsFile(_uri, false);

        let fileService = treeItem.root.createFileService();

        let text: string = this.uint8ArrayToStr(_content);

        // tslint:disable-next-line: no-void-expression
        return await new Promise<void>((resolve, reject) => {
            fileService.createFileFromText(treeItem.share.name, treeItem.directoryPath, treeItem.file.name, text, (error?: Error, _result?: azureStorage.FileService.FileResult, _response?: azureStorage.ServiceResponse) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private uint8ArrayToStr(arr: Uint8Array): string {
        // tslint:disable-next-line: no-unsafe-any
        return String.fromCharCode.apply(null, arr);
    }

    // tslint:disable-next-line: no-reserved-keywords
    delete(_uri: vscode.Uri, _options: { recursive: boolean; }): void {
        throw new Error("Method not implemented.");
    }

    rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): void {
        throw new Error("Method not implemented.");
    }

    private async lookupAsDirectory(uri: vscode.Uri, silent: boolean): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookup(uri, silent);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private async lookup(uri: vscode.Uri, silent: boolean): Promise<EntryTreeItem | undefined> {
        return <EntryTreeItem>await callWithTelemetryAndErrorHandling('fs.lookup', async (context) => {
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

                    // Intentionally passing undefined for token - only supports listing first batch of files for now
                    // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
                    let listShareResult = await entry.listFileShares(<azureStorage.common.ContinuationToken>undefined!);

                    let entries = listShareResult.entries;
                    let fileShareResultChild = entries.find(element => element.name === part);

                    if (fileShareResultChild) {
                        shareResult = fileShareResultChild;
                        entry = new FileShareTreeItem(entry, shareResult);
                    }
                } else if (entry instanceof FileShareTreeItem || entry instanceof DirectoryTreeItem) {

                    // Intentionally passing undefined for token - only supports listing first batch of files for now
                    // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
                    let listFilesAndDirectoriesResult = await entry.listFiles(<azureStorage.common.ContinuationToken>undefined!);

                    let entries = listFilesAndDirectoriesResult.entries;

                    let directoryResultChild = entries.directories.find(element => element.name === part);
                    let fileResultChild = entries.files.find(element => element.name === part);

                    if (directoryResultChild) {
                        entry = new DirectoryTreeItem(entry, parentPath, directoryResultChild, <azureStorage.FileService.ShareResult>shareResult);
                        // tslint:disable-next-line: prefer-template
                        parentPath = parentPath + part + '/';
                    }
                    if (fileResultChild) {
                        entry = new FileTreeItem(entry, fileResultChild, parentPath, <azureStorage.FileService.ShareResult>shareResult);
                    }
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
