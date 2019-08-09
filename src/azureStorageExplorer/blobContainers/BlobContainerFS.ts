/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as mime from "mime";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext, parseError } from "vscode-azureextensionui";
import { findRoot } from "../findRoot";
import { getFileSystemError } from "../getFileSystemError";
import { parseUri } from "../parseUri";
import { showRenameError } from "../showRenameError";
import { BlobContainerTreeItem, IBlobContainerCreateChildContext } from './blobContainerNode';
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";
import { BlobTreeItem } from './blobNode';

export type EntryTreeItem = BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;

export class BlobContainerFS implements vscode.FileSystemProvider {
    private _blobContainerString: string = 'Blob Containers';

    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return await callWithTelemetryAndErrorHandling('blob.stat', async (context) => {
            let entry: EntryTreeItem = await this.lookup(uri, context);
            if (entry instanceof BlobDirectoryTreeItem || entry instanceof BlobContainerTreeItem) {
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
        return await callWithTelemetryAndErrorHandling('blob.readDirectory', async (context) => {
            let ti = await this.lookupAsDirectory(uri, context);
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

    private regexEscape(s: string): string {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('blob.createDirectory', async (context) => {
            let ti = await this.lookup(uri, context, true);

            if (ti instanceof BlobTreeItem) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotADirectory);
            }

            let parsedUri = parseUri(uri, this._blobContainerString);
            let tiParsedUri = parseUri(ti.fullId, this._blobContainerString);

            let matches = parsedUri.filePath.match(`^${this.regexEscape(tiParsedUri.filePath)}\/?([^\/]+)\/?(.*?)`);
            while (!!matches) {
                ti = <BlobDirectoryTreeItem>await ti.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlobDirectory', childName: matches[1] });
                // tslint:disable-next-line: no-multiline-string
                matches = matches[2].match(`^([^\/]+)\/?(.*?)$`);
            }
            return ti;
        });
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return await callWithTelemetryAndErrorHandling('blob.readFile', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            let parsedUri = parseUri(uri, this._blobContainerString);

            let blobContainer: BlobContainerTreeItem = await this.getRoot(uri, context);
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
        return await callWithTelemetryAndErrorHandling('blob.writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            let parsedUri = parseUri(uri, this._blobContainerString);
            let blobContainer: BlobContainerTreeItem = await this.getRoot(uri, context);

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
                        if (parent.endsWith('/')) {
                            parent = parent.substring(0, parent.length - 1);
                        }

                        let dir = await this.lookupAsDirectory(path.posix.join(parsedUri.rootPath, parent), context);
                        await dir.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlob', childName: parsedUri.filePath });
                    }
                });
            }
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('blob.delete', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error('Do not support non recursive deletion of folders or files.');
            }

            let ti = await this.lookup(uri, context);
            try {
                await ti.deleteTreeItem(context);
            } catch (error) {
                let pe = parseError(error);
                console.log(pe.message);
            }
        });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('blob.rename', async (context) => {
            showRenameError(oldUri, newUri, this._blobContainerString, context);
        });
    }

    private async lookupAsDirectory(uri: vscode.Uri | string, context: IActionContext): Promise<BlobDirectoryTreeItem | BlobContainerTreeItem> {
        let ti = await this.lookup(uri, context);
        if (ti instanceof BlobDirectoryTreeItem || ti instanceof BlobContainerTreeItem) {
            return ti;
        } else {
            // tslint:disable-next-line: no-multiline-string
            throw RangeError(`Unexpected entry.`);
        }
    }

    private async lookup(uri: vscode.Uri | string, context: IActionContext, halfSearch?: boolean): Promise<EntryTreeItem> {
        let parsedUri = parseUri(uri, this._blobContainerString);

        let ti: EntryTreeItem = await this.getRoot(uri, context);
        if (parsedUri.filePath === '') {
            return ti;
        }

        let pathToLook = parsedUri.filePath.split('/');
        for (const childName of pathToLook) {
            if (ti instanceof BlobTreeItem) {
                if (halfSearch) {
                    return ti;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            let children: AzExtTreeItem[] = await ti.getCachedChildren(context);
            let child = children.find(element => path.basename(element.label) === childName);
            if (!child) {
                if (halfSearch) {
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

    private async getRoot(uri: vscode.Uri | string, context: IActionContext): Promise<BlobContainerTreeItem> {
        let root = await findRoot(uri, this._blobContainerString, context);
        if (root instanceof BlobContainerTreeItem) {
            return root;
        } else {
            throw new RangeError(`Unexpected entry ${root.constructor.name}.`);
        }
    }
}
