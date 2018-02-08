/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocument, window } from 'vscode';
import { TemporaryFile } from '../../components/temporaryFile';
import * as path from "path";
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';
import * as vscode from "vscode";
import { IRemoteFileHandler } from './IRemoteFileHandler';
import { UserCancelledError } from 'vscode-azureextensionui';
import * as fse from 'fs-extra';

export class RemoteFileEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};

    constructor(private readonly remoteFileHandler: IRemoteFileHandler<ContextT>, private readonly showSavePromptKey: string, private readonly outputChanel?: vscode.OutputChannel) {
    }

    public async dispose(): Promise<void> {
        Object.keys(this.fileMap).forEach(async (key) => await fse.remove(path.dirname(key)));
    }

    public async onDidSaveTextDocument(trackTelemetry: () => void, doc: vscode.TextDocument): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.uri.fsPath, filePath) === '');
        if (filePath) {
            trackTelemetry();
            const context: ContextT = this.fileMap[filePath][1];
            await this.confirmSaveDocument(context);
            await this.saveDocument(context, doc);
        }
    }

    async showEditor(context: ContextT): Promise<void> {
        var fileName = await this.remoteFileHandler.getFilename(context);

        this.appendLineToOutput(`Opening '${fileName}' ...`);
        try {
            let parsedPath: path.ParsedPath = path.posix.parse(fileName);
            let temporaryFilePath = await TemporaryFile.create(parsedPath.base);
            await this.remoteFileHandler.downloadFile(context, temporaryFilePath);
            await this.showEditorFromFile(context, temporaryFilePath);
            this.appendLineToOutput(`Successfully opened '${fileName}'`);
        } catch (error) {
            var details: string;

            if (!!error.message) {
                details = error.message;
            } else {
                details = JSON.stringify(error);
            }

            this.appendLineToOutput(`Unable to open '${fileName}'`);
            this.appendLineToOutput(`Error Details: ${details}`);

            await window.showWarningMessage(`Unable to open "${fileName}". Please check Output for more information.`, DialogOptions.ok);
        }
    }

    private async confirmSaveDocument(context: ContextT): Promise<void> {
        const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);

        if (showSaveWarning) {
            const message: string = await this.remoteFileHandler.getSaveConfirmationText(context);
            const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogOptions.ok, DialogOptions.uploadDontShowAgain, DialogOptions.cancel);

            if (!result || result === DialogOptions.cancel) {
                throw new UserCancelledError();
            } else if (result === DialogOptions.uploadDontShowAgain) {
                await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
            }
        }
    }

    private async saveDocument(context: ContextT, document: TextDocument): Promise<void> {
        var fileName = await this.remoteFileHandler.getFilename(context);
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
        const document = await vscode.workspace.openTextDocument(localFilePath);
        this.fileMap[localFilePath] = [document, context];
        await vscode.window.showTextDocument(document);
    }

    protected appendLineToOutput(value: string) {
        if (!!this.outputChanel) {
            this.outputChanel.appendLine(value);
            this.outputChanel.show(true);
        }
    }
}
