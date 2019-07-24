/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as mime from "mime";
import * as path from 'path';
import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext, parseError } from "vscode-azureextensionui";
import { findRoot } from "../findRoot";
import { IParsedUri, parseUri } from "../parseUri";
import { BlobContainerTreeItem } from './blobContainerNode';
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";
import { BlobTreeItem } from './blobNode';

export type EntryTreeItem = BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;

export type blobDeletionErrors = { snapshotDetected: boolean, leaseDetected: boolean };

export class BlobContainerFS implements vscode.FileSystemProvider {
    private _blobContainerString: string = 'Blob Containers';
    private _virtualDirCreatedUri: Set<string> = new Set();

    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    private _configUri: string[] = ['pom.xml', 'node_modules', '.vscode', '.vscode/settings.json', '.vscode/tasks.json', '.vscode/launch.json', '.git/config'];
    private _configRootNames: string[] = ['pom.xml', 'node_modules', '.git', '.vscode'];

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return <vscode.FileStat>await callWithTelemetryAndErrorHandling('blob.stat', async (context) => {
            if (this._virtualDirCreatedUri.has(uri.path)) {
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            }

            let entry: EntryTreeItem = await this.lookup(context, uri);

            if (entry instanceof BlobDirectoryTreeItem || entry instanceof BlobContainerTreeItem) {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
            } else {
                // creation and modification times as well as size of tree item are intentionally set to 0 for now
                return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
            }
        });
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return <[string, vscode.FileType][]>await callWithTelemetryAndErrorHandling('blob.readDirectory', async (context) => {
            let blobContainer: BlobContainerTreeItem = await this.getRoot(context, uri);
            let parsedUri = parseUri(uri, this._blobContainerString);

            const blobService = blobContainer.root.createBlobService();
            const listBlobResult = await this.listAllChildBlob(blobService, parsedUri.rootName, parsedUri.dirPath);
            const listDirectoryResult = await this.listAllChildDirectory(blobService, parsedUri.rootName, parsedUri.dirPath);

            let directoryChildren: [string, vscode.FileType][] = [];
            listBlobResult.entries.forEach(value => directoryChildren.push([path.basename(value.name), vscode.FileType.File]));
            listDirectoryResult.entries.forEach(value => directoryChildren.push([path.basename(value.name), vscode.FileType.Directory]));

            for (let dirCreated of this._virtualDirCreatedUri) {
                let dirCreatedParsedUri = parseUri(dirCreated, this._blobContainerString);

                let parentPath = path.posix.join(dirCreatedParsedUri.rootPath, dirCreatedParsedUri.parentDirPath);
                if (parentPath.endsWith("/")) {
                    parentPath = parentPath.substring(0, parentPath.length - 1);
                }

                if (uri.path === parentPath) {
                    directoryChildren.push([dirCreatedParsedUri.baseName, vscode.FileType.Directory]);
                }
            }

            return directoryChildren;
        });
    }

    createDirectory(uri: vscode.Uri): void {
        this._virtualDirCreatedUri.add(uri.path);
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return <Uint8Array>await callWithTelemetryAndErrorHandling('blob.readFile', async (context) => {
            context.errorHandling.rethrow = true;
            let parsedUri = parseUri(uri, this._blobContainerString);

            if (this._configUri.includes(parsedUri.filePath) || this._configRootNames.includes(parsedUri.rootName)) {
                context.errorHandling.suppressDisplay = true;
            }

            let blobContainer: BlobContainerTreeItem = await this.getRoot(context, uri);

            let blobService: azureStorage.BlobService = blobContainer.root.createBlobService();
            let result = await new Promise<string | undefined>((resolve, reject) => {
                blobService.getBlobToText(parsedUri.rootName, parsedUri.filePath, (error?: Error, text?: string) => {
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
        await callWithTelemetryAndErrorHandling('blob.writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw vscode.FileSystemError.NoPermissions(uri);
            }

            let blobContainer: BlobContainerTreeItem = await this.getRoot(context, uri);
            let parsedUri = parseUri(uri, this._blobContainerString);

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
                throw vscode.FileSystemError.FileNotFound(uri);
            } else if (blobResultChild.exists && !options.overwrite) {
                throw vscode.FileSystemError.FileExists(uri);
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

                let parentDirPath = parsedUri.parentDirPath;
                while (parentDirPath) {
                    if (parentDirPath.endsWith("/")) {
                        parentDirPath = parentDirPath.substring(0, parentDirPath.length - 1);
                    }

                    let fullPath: string = path.posix.join(parsedUri.rootPath, parentDirPath);
                    if (this._virtualDirCreatedUri.has(fullPath)) {
                        this._virtualDirCreatedUri.delete(fullPath);
                    } else {
                        return;
                    }

                    parentDirPath = parentDirPath.substring(0, parentDirPath.lastIndexOf('/'));
                }
            }
        });
    }

    // tslint:disable-next-line: no-reserved-keywords
    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('blob.delete', async (context) => {
            if (!options.recursive) {
                throw new Error('Do not support non recursive deletion of folders or files.');
            }

            let parsedUri = parseUri(uri, this._blobContainerString);
            let entry: EntryTreeItem;
            try {
                entry = await this.lookup(context, uri);
            } catch (err) {
                if (this._virtualDirCreatedUri.has(uri.path)) {
                    this._virtualDirCreatedUri.forEach(value => {
                        if (value.startsWith(uri.path)) {
                            this._virtualDirCreatedUri.delete(value);
                        }
                    });
                    return;
                } else {
                    throw new Error(`Cannot delete ${parsedUri.filePath} because it wasn't found.`);
                }
            }

            const blobService = entry.root.createBlobService();

            if (entry instanceof BlobTreeItem) {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    progress.report({ message: `Deleting blob ${parsedUri.filePath}` });
                    let deletionErrors: blobDeletionErrors = await this.deleteBlob(parsedUri.rootName, parsedUri.filePath, blobService);
                    if (deletionErrors.snapshotDetected) {
                        context.errorHandling.suppressDisplay = true;
                        context.errorHandling.rethrow = true;
                        throw vscode.FileSystemError.NoPermissions(`Failed to delete ${parsedUri.filePath}. This operation is not permitted because the blob has snapshots.`);
                    } else if (deletionErrors.leaseDetected) {
                        context.errorHandling.suppressDisplay = true;
                        context.errorHandling.rethrow = true;
                        throw vscode.FileSystemError.NoPermissions(`Failed to delete ${parsedUri.filePath} because there is currenlty a lease on the blob.`);
                    }
                });
            } else if (entry instanceof BlobDirectoryTreeItem) {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    progress.report({ message: `Deleting directory ${parsedUri.filePath}` });
                    let deletionErrors: blobDeletionErrors = await this.deleteFolder(parsedUri, blobService);
                    if (deletionErrors.snapshotDetected && deletionErrors.leaseDetected) {
                        vscode.window.showInformationMessage(`Blobs with snapshots and leases were detected when deleting ${parsedUri.filePath} and could be not deleted. All other blobs were successfully deleted. Please refresh to see the updates.`);
                    } else if (deletionErrors.snapshotDetected) {
                        vscode.window.showInformationMessage(`Blobs with snapshots were detected when deleting ${parsedUri.filePath} and could be not deleted. All other blobs were successfully deleted. Please refresh to see the updates.`);
                    } else if (deletionErrors.leaseDetected) {
                        vscode.window.showInformationMessage(`Blobs with snapshots were leases when deleting ${parsedUri.filePath} and could be not deleted. All other blobs were successfully deleted. Please refresh to see the updates.`);
                    }
                });
            } else if (entry instanceof BlobContainerTreeItem) {
                throw new Error('Cannot delete a Blob Container.');
            }

        });
    }

    private async deleteFolder(parsedUri: IParsedUri, blobService: azureStorage.BlobService): Promise<blobDeletionErrors> {
        let dirPaths: string[] = [];
        let dirPath: string | undefined = parsedUri.dirPath;
        let errors: blobDeletionErrors = { snapshotDetected: false, leaseDetected: false };

        while (dirPath) {
            let childBlob = await this.listAllChildBlob(blobService, parsedUri.rootName, dirPath);
            for (const blob of childBlob.entries) {
                let blobSnapshotLease: blobDeletionErrors = await this.deleteBlob(parsedUri.rootName, blob.name, blobService);
                errors = { snapshotDetected: (errors.snapshotDetected || blobSnapshotLease.snapshotDetected), leaseDetected: (errors.leaseDetected || blobSnapshotLease.leaseDetected) };
            }

            let childDir = await this.listAllChildDirectory(blobService, parsedUri.rootName, dirPath);
            for (const dir of childDir.entries) {
                dirPaths.push(dir.name);
            }

            dirPath = dirPaths.pop();
        }

        return errors;
    }

    private async deleteBlob(containerName: string, prefix: string, blobService: azureStorage.BlobService): Promise<blobDeletionErrors> {
        try {
            await new Promise<void>((resolve, reject) => {
                blobService.deleteBlob(containerName, prefix, (error?: Error) => {
                    if (!!error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            const pe = parseError(error);
            if (pe.errorType === "SnapshotsPresent") {
                return { snapshotDetected: true, leaseDetected: false };
            } else if (pe.errorType === 'LeaseIdMissing') {
                return { snapshotDetected: false, leaseDetected: true };
            }
        }

        return { snapshotDetected: false, leaseDetected: false };
    }

    async rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('blob.rename', async (context) => {
            context.errorHandling.rethrow = true;
            throw new Error('Renaming/moving folders or files not supported.');
        });
    }

    private async lookup(context: IActionContext, uri: vscode.Uri): Promise<EntryTreeItem> {
        context.errorHandling.rethrow = true;

        let parsedUri = parseUri(uri, this._blobContainerString);

        if (this._configUri.includes(parsedUri.filePath) || this._configRootNames.includes(parsedUri.rootName)) {
            context.errorHandling.suppressDisplay = true;
        }

        let entry = await this.getRoot(context, uri);
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
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    private async getRoot(context: IActionContext, uri: vscode.Uri): Promise<BlobContainerTreeItem> {
        let root = await findRoot(context, uri, this._blobContainerString);
        if (root instanceof BlobContainerTreeItem) {
            return root;
        } else {
            throw new Error('The root found must be a BlobContainerTreeItem.');
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
            let options = { delimiter: '/' };
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobsSegmentedWithPrefix(blobContainerName, prefix, <azureStorage.common.ContinuationToken>undefined!, options, (error?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }
}
