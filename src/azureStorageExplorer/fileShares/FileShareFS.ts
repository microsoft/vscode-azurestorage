/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext, parseError } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { getFileSystemError } from "../getFileSystemError";
import { parseUri } from "../parseUri";
import { showRenameError } from "../showRenameError";
import { DirectoryTreeItem, IDirectoryDeleteContext } from './directoryNode';
import { FileTreeItem } from "./fileNode";
import { FileShareTreeItem, IFileShareCreateChildContext } from "./fileShareNode";
import { validateDirectoryName } from "./validateNames";

export type EntryTreeItem = FileShareTreeItem | FileTreeItem | DirectoryTreeItem;

export class FileShareFS implements vscode.FileSystemProvider {
    private _fileShareString: string = 'File Shares';

    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return await callWithTelemetryAndErrorHandling('fs.stat', async (context) => {
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

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('fs.readDirectory', async (context) => {
            let entry: DirectoryTreeItem | FileShareTreeItem = await this.lookupAsDirectory(uri, context);
            let children: AzExtTreeItem[] = await entry.getCachedChildren(context);

            let result: [string, vscode.FileType][] = [];
            for (const child of children) {
                let baseName: string = path.basename(child.label);
                if (child instanceof FileTreeItem) {
                    result.push([baseName, vscode.FileType.File]);
                } else if (child instanceof DirectoryTreeItem) {
                    result.push([baseName, vscode.FileType.Directory]);
                }
            }
            return result;
            // tslint:disable-next-line: strict-boolean-expressions
        }) || [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.createDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            let parsedUri = parseUri(uri, this._fileShareString);

            let response: string | undefined | null = validateDirectoryName(parsedUri.baseName);
            if (response) {
                throw new Error(response);
            }

            try {
                let parentUri: vscode.Uri = vscode.Uri.file(path.posix.join(parsedUri.rootPath, parsedUri.parentDirPath));
                let parent = await this.lookupAsDirectory(parentUri, context);

                await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFileShareDirectory', childName: parsedUri.baseName });
            } catch (error) {
                let pe = parseError(error);
                if (pe.errorType === "ResourceAlreadyExists" || pe.errorType === 'ResourceTypeMismatch') {
                    throw new Error(`A file or folder ${parsedUri.baseName} already exists at this location. Please choose a different name`);
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

            let treeItem: FileShareTreeItem = await this.lookupRoot(uri, context);
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

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('fs.writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            let parsedUri = parseUri(uri, this._fileShareString);
            let fileShare: FileShareTreeItem = await this.lookupRoot(uri, context);

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
                        let parent = await this.lookupAsDirectory(parentUri, context);

                        try {
                            await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFile', childName: parsedUri.baseName });
                        } catch (error) {
                            let pe = parseError(error);
                            if (pe.errorType === 'ResourceTypeMismatch') {
                                throw new Error(`A file or folder ${parsedUri.baseName} already exists at this location. Please choose a different name`);
                            }
                        }
                    }
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
                if (fileFound instanceof FileTreeItem || fileFound instanceof DirectoryTreeItem) {
                    progress.report({ message: `Deleting ${parsedUri.filePath}` });
                    await fileFound.deleteTreeItem(<IDirectoryDeleteContext>{ ...context, suppressMessage: true });
                } else {
                    throw new RangeError(`Unexpected entry ${fileFound.constructor.name}.`);
                }
            });
        });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('fs.rename', async (context) => {
            showRenameError(oldUri, newUri, this._fileShareString, context);
        });
    }

    private async lookupRoot(uri: vscode.Uri, context: IActionContext): Promise<FileShareTreeItem> {
        let parsedUri = parseUri(uri, this._fileShareString);
        let entry = await this.lookup(parsedUri.rootPath, context);
        if (entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw new RangeError(`Unexpected entry ${entry.constructor.name}.`);
    }

    private async lookupAsDirectory(uri: vscode.Uri, context: IActionContext): Promise<DirectoryTreeItem | FileShareTreeItem> {
        let entry = await this.lookup(uri, context);
        if (entry instanceof DirectoryTreeItem || entry instanceof FileShareTreeItem) {
            return entry;
        }
        throw new RangeError(`Unexpected entry ${entry.constructor.name}.`);
    }

    private async lookup(uri: vscode.Uri | string, context: IActionContext): Promise<EntryTreeItem> {
        let uriString = uri instanceof vscode.Uri ? uri.path : uri;
        if (uriString.endsWith('/')) {
            uriString = uriString.substr(0, uriString.length - 1);
        }

        let ti = await ext.tree.findTreeItem(uriString, context);
        if (!ti) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (ti instanceof FileShareTreeItem || ti instanceof FileTreeItem || ti instanceof DirectoryTreeItem) {
            return ti;
        } else {
            throw new RangeError(`Unexpected entry ${ti.constructor.name}.`);
        }
    }
}
