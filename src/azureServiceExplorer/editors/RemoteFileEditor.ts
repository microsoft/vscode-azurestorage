/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from "path";
import { TextDocument, window } from 'vscode';
import * as vscode from "vscode";
import { DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { BlobContainerTreeItem } from '../../azureStorageExplorer/blobContainers/blobContainerNode';
import { BlobTreeItem } from '../../azureStorageExplorer/blobContainers/blobNode';
import { FileTreeItem } from '../../azureStorageExplorer/fileShares/fileNode';
import { getFile, getFileMetadata } from '../../azureStorageExplorer/fileShares/fileUtils';
import { TemporaryFile } from '../../components/temporaryFile';
import { ext } from '../../extensionVariables';
import { IRemoteFileHandler } from './IRemoteFileHandler';

export class RemoteFileEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};

    constructor(private readonly remoteFileHandler: IRemoteFileHandler<ContextT>, private readonly showSavePromptKey: string) {
    }

    public async dispose(): Promise<void> {
        Object.keys(this.fileMap).forEach(async (key) => await fse.remove(path.dirname(key)));
    }

    public async onDidSaveTextDocument(actionContext: IActionContext, doc: vscode.TextDocument): Promise<void> {
        actionContext.telemetry.suppressIfSuccessful = true;
        const filePath = Object.keys(this.fileMap).find(fp => path.relative(doc.uri.fsPath, fp) === '');
        if (filePath) {
            actionContext.telemetry.suppressIfSuccessful = false;
            const context: ContextT = this.fileMap[filePath][1];

            if (context instanceof BlobTreeItem) {
                const container: BlobContainerTreeItem | undefined = <BlobContainerTreeItem | undefined>context.parent;
                if (container) {
                    context.blob.contentSettings = (await container.getBlob(context.blob.name)).contentSettings;
                    context.blob.metadata = (await container.getBlobMetadata(context.blob.name)).metadata;
                }
            } else if (context instanceof FileTreeItem) {
                context.file.contentSettings = (await getFile(context.directoryPath, context.file.name, context.share, context.root)).contentSettings;
                context.file.metadata = (await getFileMetadata(context.directoryPath, context.file.name, context.share, context.root)).metadata;
            }

            await this.confirmSaveDocument(context);
            await this.saveDocument(context, doc);
        }
    }

    async showEditor(context: ContextT): Promise<void> {
        let fileName = await this.remoteFileHandler.getFilename(context);

        try {
            let parsedPath: path.ParsedPath = path.posix.parse(fileName);
            let temporaryFilePath = await TemporaryFile.create(parsedPath.base);
            await this.remoteFileHandler.downloadFile(context, temporaryFilePath);
            await this.showEditorFromFile(context, temporaryFilePath);
        } catch (error) {
            if (!(error instanceof UserCancelledError)) {
                let details: string;

                // tslint:disable-next-line:no-unsafe-any // Grandfathered in
                if (!!error.message) {
                    // tslint:disable-next-line:no-unsafe-any // Grandfathered in
                    details = error.message;
                } else {
                    details = JSON.stringify(error);
                }

                this.appendLineToOutput(`Unable to open '${fileName}'`);
                this.appendLineToOutput(`Error Details: ${details}`);

                await window.showWarningMessage(`Unable to open "${fileName}". Please check Output for more information.`);
            }
        }
    }

    private async confirmSaveDocument(context: ContextT): Promise<void> {
        const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);

        if (showSaveWarning) {
            const message: string = await this.remoteFileHandler.getSaveConfirmationText(context);
            const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogResponses.upload, DialogResponses.alwaysUpload, DialogResponses.cancel);

            if (!result || result === DialogResponses.cancel) {
                throw new UserCancelledError();
            } else if (result === DialogResponses.alwaysUpload) {
                await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
            }
        }
    }

    private async saveDocument(context: ContextT, document: TextDocument): Promise<void> {
        let fileName = await this.remoteFileHandler.getFilename(context);
        this.appendLineToOutput(`Updating '${fileName}' ...`);
        try {
            await this.remoteFileHandler.uploadFile(context, document.fileName);
            this.appendLineToOutput(`Successfully updated '${fileName}'`);
        } catch (error) {
            this.appendLineToOutput(`Unable to save '${fileName}'`);
            this.appendLineToOutput(`Error Details: ${error}`);
        }
    }

    private async showEditorFromFile(context: ContextT, localFilePath: string): Promise<void> {
        this.appendLineToOutput("Opening...");
        const document: TextDocument | undefined = <TextDocument | undefined>await vscode.workspace.openTextDocument(localFilePath);
        if (document) {
            this.fileMap[localFilePath] = [document, context];
            await vscode.window.showTextDocument(document);
            this.appendLineToOutput(`Successfully opened '${localFilePath}'`);
        } else {
            // This tends to fail if the file is too large: https://github.com/Microsoft/vscode/issues/43861
            throw new Error(`Unable to open ${localFilePath}.`);
        }
    }

    protected appendLineToOutput(value: string): void {
        ext.outputChannel.appendLine(value);
        ext.outputChannel.show(true);
    }
}
