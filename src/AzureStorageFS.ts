/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobClient, BlobGetPropertiesResponse, BlockBlobClient } from "@azure/storage-blob";
import type { FileGetPropertiesResponse, ShareFileClient } from "@azure/storage-file-share";

import { AzExtTreeItem, IActionContext, UserCancelledError, callWithTelemetryAndErrorHandling, parseError } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import * as querystring from "querystring";
import * as vscode from "vscode";
import { download } from "./commands/downloadFile";
import { maxRemoteFileEditSizeBytes, maxRemoteFileEditSizeMB } from "./constants";
import { ext } from "./extensionVariables";
import { BlobContainerTreeItem } from "./tree/blob/BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "./tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "./tree/blob/BlobTreeItem";
import { DirectoryTreeItem, IDirectoryDeleteContext } from "./tree/fileShare/DirectoryTreeItem";
import { FileShareTreeItem, IFileShareCreateChildContext } from "./tree/fileShare/FileShareTreeItem";
import { FileTreeItem } from "./tree/fileShare/FileTreeItem";
import { getAppResourceIdFromId } from "./utils/azureUtils";
import { IBlobContainerCreateChildContext, createBlobClient, createBlockBlobClient, createOrUpdateBlockBlob, doesBlobExist } from './utils/blobUtils';
import { createFileClient, doesFileExist, updateFileFromText } from "./utils/fileUtils";
import { localize } from "./utils/localize";
import { nonNullValue } from "./utils/nonNull";
import { validateBlobDirectoryName, validateFileOrDirectoryName } from "./utils/validateNames";

type AzureStorageFileTreeItem = FileTreeItem | DirectoryTreeItem | FileShareTreeItem;
type AzureStorageBlobTreeItem = BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;
type AzureStorageTreeItem = AzureStorageFileTreeItem | AzureStorageBlobTreeItem;
type AzureStorageDirectoryTreeItem = DirectoryTreeItem | FileShareTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem;

/**
 * Still used to support the following scenarios:
 * 1. Editing blobs from attached or emulated storage accounts
 * 2. Opening an attached or emulated blob container in the explorer
 *
 * @deprecated Use BlobContainerFS as FileSystemProvider for blob containers.
 */
export class AzureStorageFS implements vscode.FileSystemProvider, vscode.TextDocumentContentProvider {
    private _emitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    private _queryCache: Map<string, { query: string, invalid?: boolean }> = new Map<string, { query: string, invalid?: boolean }>(); // Key: rootName
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    static isAttachedAccount(treeItem: BlobContainerTreeItem | FileShareTreeItem | BlobTreeItem): boolean {
        return treeItem.fullId.startsWith("/attachedStorageAccounts/");
    }

    static idToUri(resourceId: string, filePath?: string): vscode.Uri {
        let idRegExp: RegExp;
        if (resourceId.startsWith('/attachedStorageAccounts')) {
            idRegExp = /(\/attachedStorageAccounts\/[^\/]+\/[^\/]+\/[^\/]+)\/?(.*)/i;
        } else {

            if (/\/subscriptions\/.*\/subscriptions\//.test(resourceId)) {
                // compatible with Resource Groups v1
                idRegExp = /(\/subscriptions\/.*\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft.Storage\/storageAccounts\/[^\/]+\/[^\/]+\/[^\/]+)\/?(.*)/i;
            } else {
                // resource groups v2
                idRegExp = /(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft.Storage\/storageAccounts\/[^\/]+\/[^\/]+\/[^\/]+)\/?(.*)/i;
            }
        }

        let matches: RegExpMatchArray | null = resourceId.match(idRegExp);
        matches = nonNullValue(matches, 'resourceIdMatches');

        const rootId = matches[1];
        const rootName = path.basename(rootId);
        filePath = filePath || matches[2];

        return vscode.Uri.parse(`azurestorage:///${path.posix.join(rootName, filePath)}?resourceId=${rootId}`);
    }

    static async showEditor(context: IActionContext, treeItem: BlobTreeItem | FileTreeItem): Promise<void> {
        let client: BlockBlobClient | ShareFileClient;
        if (treeItem instanceof BlobTreeItem) {
            client = await createBlockBlobClient(treeItem.root, treeItem.container.name, treeItem.blobPath);
        } else {
            client = await createFileClient(treeItem.root, treeItem.shareName, treeItem.directoryPath, treeItem.fileName);
        }

        const uri = this.idToUri(treeItem.fullId);
        const properties: BlobGetPropertiesResponse | FileGetPropertiesResponse = await client.getProperties();
        if (properties.contentLength && properties.contentLength > maxRemoteFileEditSizeBytes) {
            const downloadInstead: vscode.MessageItem = {
                title: localize('downloadInstead', 'Download file instead')
            };
            const message: string = localize('failedToOpen', 'Failed to open "{0}". Cannot edit remote files larger than {1}MB.', uri.fsPath, maxRemoteFileEditSizeMB);
            const result: vscode.MessageItem | undefined = await vscode.window.showErrorMessage(message, downloadInstead);
            if (result === downloadInstead) {
                await download(context, [treeItem]);
            }
            throw new UserCancelledError(message);
        }

        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preserveFocus: false, preview: false });
    }

    public static fireDeleteEvent(node: AzExtTreeItem): void {
        ext.azureStorageFS.fireSoon({ uri: AzureStorageFS.idToUri(node.fullId), type: vscode.FileChangeType.Deleted });
    }

    public static fireCreateEvent(node: AzExtTreeItem): void {
        ext.azureStorageFS.fireSoon({ uri: AzureStorageFS.idToUri(node.fullId), type: vscode.FileChangeType.Created });
    }

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        return new vscode.Disposable(() => {
            // Since we're not actually watching "in Azure" (i.e. polling for changes), there's no need to selectively watch based on the Uri passed in here. Thus there's nothing to dispose
        });
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        return (await this.readFile(uri)).toString();
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        let ctime: number = 0;
        let mtime: number = 0;
        let size: number = 0;

        return await callWithTelemetryAndErrorHandling('stat', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            if (uri.path.endsWith('/')) {
                // Ignore trailing forward slashes
                // https://github.com/microsoft/vscode-azurestorage/issues/576
                uri = uri.with({ path: uri.path.slice(0, -1) });
            }

            const treeItem: AzureStorageTreeItem = await this.lookup(uri, context);
            const fileType: vscode.FileType = treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem ? vscode.FileType.Directory : vscode.FileType.File;
            let props: (BlobGetPropertiesResponse & FileGetPropertiesResponse) | undefined;
            try {
                if (treeItem instanceof BlobTreeItem) {
                    const blockBlobClient: BlockBlobClient = await createBlockBlobClient(treeItem.root, treeItem.container.name, treeItem.blobPath);
                    props = await blockBlobClient.getProperties();
                } else if (treeItem instanceof FileTreeItem) {
                    const fileClient: ShareFileClient = await createFileClient(treeItem.root, treeItem.shareName, treeItem.directoryPath, treeItem.fileName);
                    props = await fileClient.getProperties();
                }
            } catch (error) {
                const pe = parseError(error);
                if (pe.errorType === '404') {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
                }
                throw error;
            }

            ctime = props?.createdOn?.valueOf() || props?.fileCreatedOn?.valueOf() || 0;
            mtime = props?.lastModified?.valueOf() || 0;
            size = props?.contentLength || 0;

            return { type: fileType, ctime, mtime, size };
        }) || { type: vscode.FileType.Unknown, ctime, mtime, size };
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        return await callWithTelemetryAndErrorHandling('readDirectory', async (context) => {
            context.telemetry.suppressIfSuccessful = true;
            const treeItem: AzureStorageDirectoryTreeItem = await this.lookupAsDirectory(uri, context);

            const loadingMessage: string = localize('loadingDir', 'Loading directory "{0}"...', treeItem.label);
            const children: AzExtTreeItem[] = await treeItem.loadAllChildren({ ...context, loadingMessage });
            const result: [string, vscode.FileType][] = [];
            for (const child of children) {
                if (child instanceof FileTreeItem) {
                    result.push([child.fileName, vscode.FileType.File]);
                } else if (child instanceof DirectoryTreeItem) {
                    result.push([child.directoryName, vscode.FileType.Directory]);
                } else if (child instanceof BlobTreeItem) {
                    result.push([child.blobName, vscode.FileType.File]);
                } else if (child instanceof BlobDirectoryTreeItem) {
                    result.push([child.dirName, vscode.FileType.Directory]);
                }
            }

            return result;
        }) || [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        await callWithTelemetryAndErrorHandling('createDirectory', async (context) => {
            context.errorHandling.rethrow = true;

            try {
                const parsedUri: IParsedUri = this.parseUri(uri);
                const response: string | undefined = this.isFileShareUri(uri) ? validateFileOrDirectoryName(parsedUri.baseName) : validateBlobDirectoryName(parsedUri.baseName);
                if (response) {
                    // Use getFileSystemError to prevent multiple error notifications
                    throw getFileSystemError(uri, context, () => { return new vscode.FileSystemError(response); });
                }

                this.isFileShareUri(uri) ? await this.createDirectoryFileShare(parsedUri, context) : await this.createDirectoryBlobContainer(uri, parsedUri, context);
            } catch (error) {
                const pe = parseError(error);
                if (pe.errorType === "ResourceAlreadyExists") {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
                } else {
                    throw error;
                }
            }
        });
    }

    async createDirectoryFileShare(parsedUri: IParsedUri, context: IActionContext): Promise<void> {
        const parentUri: vscode.Uri = AzureStorageFS.idToUri(parsedUri.resourceId, parsedUri.parentDirPath);
        const parent = await this.lookupAsDirectory(parentUri, context, parsedUri.resourceId, parsedUri.parentDirPath);
        await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: 'azureFileShareDirectory', childName: parsedUri.baseName });
    }

    async createDirectoryBlobContainer(uri: vscode.Uri, parsedUri: IParsedUri, context: IActionContext): Promise<void> {
        let treeItem: AzureStorageBlobTreeItem = await this.lookupBlobContainer(uri, context, parsedUri.resourceId, parsedUri.filePath, true);
        if (treeItem instanceof BlobTreeItem) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotADirectory);
        }

        const tiParsedUri = this.parseUri(AzureStorageFS.idToUri(parsedUri.resourceId, path.dirname(parsedUri.filePath)));
        let matches = parsedUri.filePath.match(`^${this.regexEscape(tiParsedUri.filePath)}\/?([^\/^]+)\/?(.*?)$`);
        while (matches) {
            treeItem = <BlobDirectoryTreeItem>await treeItem.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: 'azureBlobDirectory', childName: matches[1] });
            matches = matches[2].match("^([^\/]+)\/?(.*?)$");
        }
    }

    private regexEscape(s: string): string {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        let client: ShareFileClient | BlobClient;
        return await callWithTelemetryAndErrorHandling('readFile', async (context) => {
            context.errorHandling.suppressDisplay = true;
            const parsedUri = this.parseUri(uri);
            const treeItem: FileShareTreeItem | BlobContainerTreeItem = await this.lookupRoot(uri, context, parsedUri.resourceId);

            try {
                let buffer: Buffer;
                if (treeItem instanceof FileShareTreeItem) {
                    client = await createFileClient(treeItem.root, treeItem.shareName, parsedUri.parentDirPath, parsedUri.baseName);
                    buffer = await client.downloadToBuffer();
                } else {
                    client = await createBlobClient(treeItem.root, treeItem.container.name, parsedUri.filePath);
                    buffer = await client.downloadToBuffer();
                }
                return buffer;
            } catch (error) {
                const pe = parseError(error);
                if (pe.errorType === '404') {
                    throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
                }
                throw error;
            }
        }) || Buffer.from('');
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('writeFile', async (context) => {
            if (!options.create && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.NoPermissions);
            }

            if (uri.path.endsWith('/')) {
                // https://github.com/microsoft/vscode-azurestorage/issues/576
                context.errorHandling.rethrow = true;
                context.errorHandling.suppressDisplay = true;
                void vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer'); // Show any parent directories that may have already been created
                throw new Error("File/blob names with a trailing '/' are not allowed.");
            }

            const writeToFileShare: boolean = this.isFileShareUri(uri);
            const parsedUri = this.parseUri(uri);
            const treeItem: FileShareTreeItem | BlobContainerTreeItem = await this.lookupRoot(uri, context, parsedUri.resourceId);

            let childExists: boolean;
            try {
                await this.lookup(uri, context);
                childExists = true;
            } catch {
                childExists = false;
            }

            let childExistsRemote: boolean;
            if (treeItem instanceof FileShareTreeItem) {
                childExistsRemote = await doesFileExist(parsedUri.baseName, treeItem, parsedUri.parentDirPath, treeItem.shareName);
            } else {
                childExistsRemote = await doesBlobExist(treeItem, parsedUri.filePath);
            }

            if (childExists !== childExistsRemote) {
                // Need to be extra careful here to prevent possible data-loss. Related to https://github.com/microsoft/vscode-azurestorage/issues/436
                throw new Error(localize('outOfSync', 'Your Azure Storage file system is out of sync and must be refreshed.'));
            }

            if (!childExists && !options.create) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            } else if (childExists && !options.overwrite) {
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileExists);
            } else {
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                    if (childExists) {
                        progress.report({ message: `Saving ${writeToFileShare ? 'file' : 'blob'} ${parsedUri.filePath}` });

                        if (treeItem instanceof FileShareTreeItem) {
                            await updateFileFromText(parsedUri.parentDirPath, parsedUri.baseName, treeItem.shareName, treeItem.root, content.toString());
                        } else {
                            await createOrUpdateBlockBlob(treeItem, parsedUri.filePath, content.toString());
                        }

                        // NOTE: This is the only event handled directly in this class and not in the tree item
                        this.fireSoon({ type: vscode.FileChangeType.Changed, uri });
                    } else {
                        progress.report({ message: `Creating ${writeToFileShare ? 'file' : 'blob'} ${parsedUri.filePath}` });
                        const parentUri: vscode.Uri = AzureStorageFS.idToUri(parsedUri.resourceId, parsedUri.parentDirPath);
                        const parent = await this.lookupAsDirectory(parentUri, context, parsedUri.resourceId, parsedUri.parentDirPath);

                        if (writeToFileShare) {
                            await parent.createChild(<IFileShareCreateChildContext>{ ...context, childType: FileTreeItem.contextValue, childName: parsedUri.baseName });
                        } else {
                            await parent.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: BlobTreeItem.contextValue, childName: parsedUri.filePath, contents: Buffer.from(content) });
                        }
                    }
                });
            }
        });
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        await callWithTelemetryAndErrorHandling('delete', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            if (!options.recursive) {
                throw new Error("Azure storage does not support nonrecursive deletion of folders.");
            }

            const parsedUri = this.parseUri(uri);
            const treeItem: AzureStorageTreeItem = await this.lookup(uri, context, parsedUri.resourceId, parsedUri.filePath);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
                if (treeItem instanceof FileTreeItem || treeItem instanceof DirectoryTreeItem || treeItem instanceof BlobTreeItem || treeItem instanceof BlobDirectoryTreeItem) {
                    if (!(treeItem instanceof BlobDirectoryTreeItem)) {
                        // The deletion message from deleteTreeItem is not suppressed for BlobDirectoryTreeItems so avoid duplicate notifications
                        progress.report({ message: `Deleting ${parsedUri.filePath}` });
                    }

                    await treeItem.deleteTreeItem(<IDirectoryDeleteContext>{ ...context, suppressMessage: true });
                } else {
                    throw new RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
                }
            });
        });
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { overwrite: boolean; }): Promise<void> {
        return await callWithTelemetryAndErrorHandling('rename', (context) => {
            const oldUriParsed = this.parseUri(oldUri);
            const newUriParsed = this.parseUri(newUri);

            context.errorHandling.rethrow = true;
            if (oldUriParsed.baseName === newUriParsed.baseName) {
                throw getFileSystemError(oldUri, context, () => { return new vscode.FileSystemError('Moving folders or files is not supported.'); });
            } else {
                throw getFileSystemError(oldUri, context, () => { return new vscode.FileSystemError('Renaming folders or files is not supported.'); });
            }
        });
    }

    async lookup(uri: vscode.Uri, context: IActionContext, resourceId?: string, filePath?: string): Promise<AzureStorageTreeItem> {
        if (!resourceId || !filePath) {
            const parsedUri = this.parseUri(uri);
            resourceId = parsedUri.resourceId;
            filePath = parsedUri.filePath;
        }

        return this.isFileShareUri(uri) ? await this.lookupFileShare(uri, context, resourceId, filePath) : await this.lookupBlobContainer(uri, context, resourceId, filePath);
    }

    /**
     * Uses a simple buffer to group events that occur within a few milliseconds of each other
     * Adapted from https://github.com/microsoft/vscode-extension-samples/blob/master/fsprovider-sample/src/fileSystemProvider.ts
     */
    private fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(
            () => {
                this._emitter.fire(this._bufferedEvents);
                this._bufferedEvents.length = 0; // clear buffer
            },
            5
        );
    }

    private async lookupFileShare(uri: vscode.Uri, context: IActionContext, resourceId: string, filePath: string): Promise<AzureStorageFileTreeItem> {
        // Lookup the root first to address https://github.com/microsoft/vscode-azurestorage/issues/556
        // We don't actually use the result of this, but it caches tree items and will make `findTreeItem` faster below
        await this.lookupRoot(uri, context, resourceId);

        const uriPath = path.posix.join(resourceId, filePath);
        const treeItem = resourceId.includes('attachedStorageAccounts') ?
            await ext.rgApi.workspaceResourceTree.findTreeItem(uriPath, { ...context, loadAll: true }) :
            await ext.rgApi.appResourceTree.findTreeItem(uriPath, { ...context, loadAll: true });
        if (!treeItem) {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        } else if (treeItem instanceof FileShareTreeItem || treeItem instanceof FileTreeItem || treeItem instanceof DirectoryTreeItem) {
            return treeItem;
        } else {
            throw new RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
        }
    }

    private async lookupBlobContainer(uri: vscode.Uri, context: IActionContext, resourceId: string, filePath: string, endSearchEarly?: boolean): Promise<AzureStorageBlobTreeItem> {
        let treeItem: AzureStorageBlobTreeItem = <BlobContainerTreeItem>await this.lookupRoot(uri, context, resourceId);
        if (filePath === '') {
            return treeItem;
        }

        const pathToLook = filePath.split('/');
        let childCount: number = 0;
        for (const childName of pathToLook) {
            // Only allow blobs to be found on the last iteration of the loop.
            // Otherwise a blob with the same name as a directory will be found first leading to a file system error.
            childCount += 1;
            const allowBlobTreeItem: boolean = childCount === pathToLook.length;

            if (treeItem instanceof BlobTreeItem) {
                if (endSearchEarly) {
                    return treeItem;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            const children: AzExtTreeItem[] = await treeItem.getCachedChildren(context);
            const child = children.find((element) => {
                if (element instanceof BlobTreeItem && allowBlobTreeItem) {
                    return element.blobName === childName;
                } else if (element instanceof BlobDirectoryTreeItem) {
                    return element.dirName === childName;
                }
                return false;
            });
            if (!child) {
                if (endSearchEarly) {
                    return treeItem;
                }
                throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
            }

            treeItem = <BlobTreeItem | BlobDirectoryTreeItem>child;
        }

        return treeItem;
    }

    private async lookupRoot(uri: vscode.Uri, context: IActionContext, resourceId: string): Promise<FileShareTreeItem | BlobContainerTreeItem> {
        const rootName: string = path.basename(resourceId);
        const loadingMessage: string = this.isFileShareUri(uri) ? localize('loadingFileShare', 'Loading file share "{0}"...', rootName) : localize('loadingContainer', 'Loading blob container "{0}"...', rootName);

        try {
            // the storage account needs to be resolved for the file system to read the files
            const appResourceId = getAppResourceIdFromId(resourceId);
            if (appResourceId) {
                const appResource = await ext.rgApi.appResourceTree.findTreeItem(appResourceId, { ...context, loadAll: true }) as unknown as { resolve: () => Promise<void> }
                await appResource.resolve();
            }
        } catch {
            // swallow this error-- we don't want to abort this lookup
        }

        const treeItem = resourceId.includes('attachedStorageAccounts') ?
            await ext.rgApi.workspaceResourceTree.findTreeItem(resourceId, { ...context, loadAll: true, loadingMessage }) :
            await ext.rgApi.appResourceTree.findTreeItem(resourceId, { ...context, loadAll: true, loadingMessage });

        if (treeItem instanceof FileShareTreeItem || treeItem instanceof BlobContainerTreeItem) {
            return treeItem;
        } else {
            throw getFileSystemError(uri, context, vscode.FileSystemError.FileNotFound);
        }
    }

    private async lookupAsDirectory(uri: vscode.Uri, context: IActionContext, resourceId?: string, filePath?: string): Promise<AzureStorageDirectoryTreeItem> {
        const treeItem: AzureStorageTreeItem = await this.lookup(uri, context, resourceId, filePath);
        if (treeItem instanceof DirectoryTreeItem || treeItem instanceof FileShareTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem) {
            return treeItem;
        } else {
            throw RangeError(`Unexpected entry ${treeItem.constructor.name}.`);
        }
    }

    private getRootName(uri: vscode.Uri): string {
        const match: RegExpMatchArray | null = uri.path.match(/^\/[^\/]*\/?/);
        return match ? match[0] : '';
    }

    private verifyUri(uri: vscode.Uri, rootName?: string): vscode.Uri {
        // Remove slashes from rootName for consistency
        rootName = (rootName || this.getRootName(uri)).replace(/\//g, '');

        const cache = this._queryCache.get(rootName);
        if (cache) {
            if (uri.query) {
                this._queryCache.set(rootName, { query: cache.query, invalid: cache.invalid || cache.query !== uri.query });
            } else {
                if (cache.invalid) {
                    throw new Error('Cannot auto-detect resource path. For this functionality, re-load VS Code and only open one resource per workspace.');
                }

                // Fallback to the cached query because this uri's query doesn't exist
                return vscode.Uri.parse(`azurestorage://${uri.path}?${cache.query}`);
            }
        } else {
            if (uri.query) {
                // No cache for this rootName yet so cache the query
                this._queryCache.set(rootName, { query: uri.query });
            } else {
                throw new Error('No URI query cache available.');
            }
        }

        return uri;
    }

    private parseUri(uri: vscode.Uri): IParsedUri {
        const rootName = this.getRootName(uri);
        uri = this.verifyUri(uri, rootName);

        const parsedQuery: querystring.ParsedUrlQuery = querystring.parse(uri.query);
        const resourceId = <string>parsedQuery.resourceId;

        const filePath: string = uri.path.replace(rootName, '');
        let parentDirPath = path.dirname(filePath);
        parentDirPath = parentDirPath === '.' ? '' : parentDirPath;
        const baseName = path.basename(filePath);

        if (!resourceId || !uri.path) {
            throw new Error(`Invalid uri. Cannot view or modify ${uri}.`);
        } else {
            return {
                resourceId,
                filePath,
                parentDirPath,
                baseName
            };
        }
    }

    private isFileShareUri(uri: vscode.Uri): boolean {
        return this.verifyUri(uri).query.indexOf('File Shares') > 0;
    }
}

/**
 * Example uri: azurestorage:///container1/parentdir/subdir/blob?resourceId=/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1
 */
interface IParsedUri {
    /**
     * ID of container or file share
     * e.g. /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1
     */
    resourceId: string;

    /**
     * Full path within container or file share
     * e.g. parentdir/subdir/blob
     */
    filePath: string;

    /**
     * Path of parent directory within container or file share
     * e.g. parentdir/subdir
     */
    parentDirPath: string;

    /**
     * Name of file or directory
     * e.g. blob
     */
    baseName: string;
}

function getFileSystemError(uri: vscode.Uri | string, context: IActionContext, fsError: (messageOrUri?: string | vscode.Uri) => vscode.FileSystemError): vscode.FileSystemError {
    context.telemetry.suppressAll = true;
    context.errorHandling.rethrow = true;
    context.errorHandling.suppressDisplay = true;
    return fsError(uri);
}
