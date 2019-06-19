
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { callWithTelemetryAndErrorHandling } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { BlobContainerGroupTreeItem } from './blobContainerGroupNode';
import { BlobContainerTreeItem } from './blobContainerNode';
import { BlobTreeItem } from './blobNode';

export type EntryTreeItem = BlobContainerGroupTreeItem | BlobContainerTreeItem | BlobTreeItem;

export class BlobContainerFS implements vscode.FileSystemProvider {

    private rootMap: Map<string, BlobContainerTreeItem> = new Map<string, BlobContainerTreeItem>();

    // tslint:disable-next-line: typedef
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        await this.findRoot(uri);
        throw new Error("Method not implemented.");
    }

    readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        throw new Error("Method not implemented.");
    }

    createDirectory(_uri: vscode.Uri): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    readFile(_uri: vscode.Uri): Thenable<Uint8Array> {
        throw new Error("Method not implemented.");
    }

    writeFile(_uri: vscode.Uri, _content: Uint8Array, _options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    // tslint:disable-next-line: no-reserved-keywords
    delete(_uri: vscode.Uri, _options: { recursive: boolean; }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    private async findRoot(uri: vscode.Uri): Promise<void> {
        return <void>await callWithTelemetryAndErrorHandling('fs.lookup', async (context) => {
            context.errorHandling.rethrow = true;
            context.errorHandling.suppressDisplay = true;

            const blobContainerString = 'Blob Containers';
            let endOfBlobContainerIndx = uri.path.indexOf(blobContainerString) + blobContainerString.length + 1;
            let endOfBlobContainerName = uri.path.indexOf('/', endOfBlobContainerIndx) === -1 ? uri.path.length : uri.path.indexOf('/', endOfBlobContainerIndx);

            let rootPath: string = uri.path.substring(0, endOfBlobContainerName);

            let rootFound: BlobContainerTreeItem = <BlobContainerTreeItem>await ext.tree.findTreeItem(rootPath, context);

            let fileBlobContainerName = uri.path.substring(endOfBlobContainerIndx, endOfBlobContainerName);

            // tslint:disable-next-line: strict-boolean-expressions
            if (!!rootFound) {
                this.rootMap.set(fileBlobContainerName, rootFound);
            } else {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
        });
    }

}
