/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEditor } from '../../azureServiceExplorer/editors/baseEditor';
import { TextDocument, window } from 'vscode';
import { TemporaryFile } from '../../components/temporaryFile';
import * as path from "path";
import DialogOptions from '../../azureServiceExplorer/messageItems/dialogOptions';
import * as vscode from "vscode";
import { IRemoteFileHandler } from './IRemoteFileHandler';

export class RemoteFileEditor<ContextT> extends BaseEditor<ContextT> {
    constructor(readonly remoteFileHandler:IRemoteFileHandler<ContextT>, readonly showSavePromptKey: string, readonly outputChanel?: vscode.OutputChannel) {
        super(showSavePromptKey)
    }

    async getSaveConfirmationText(context: ContextT): Promise<string> {
        return await this.remoteFileHandler.getSaveConfirmationText(context);
    }

    async showEditor(context: ContextT): Promise<void> {
        var fileName = await this.remoteFileHandler.getFilename(context);

        this.appendLineToOutput(`Opening '${fileName}' ...`);
        try
        {
            let parsedPath: path.ParsedPath  =  path.posix.parse(fileName);       
            let temporaryFilePath = await TemporaryFile.create(parsedPath.base);    
            await this.remoteFileHandler.downloadFile(context, temporaryFilePath);
            await super.showEditor(context, temporaryFilePath);
            this.appendLineToOutput(`Successfully opened '${fileName}'`);
        } catch (error) {
            var details: string;
            
            if(!!error.message) {
                details = error.message;
            } else {
                details = JSON.stringify(error);
            }

            this.appendLineToOutput(`Unable to open '${fileName}'`);
            this.appendLineToOutput(`Error Details: ${details}`);

            await window.showWarningMessage(`Unable to open "${fileName}". Please check Output for more information.`, DialogOptions.OK);
        }
    }

    async onSave(context: ContextT, document: TextDocument) {
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

    protected appendLineToOutput(value: string) {
        if(!!this.outputChanel) {
            this.outputChanel.appendLine(value);
            this.outputChanel.show(true);
        }
    }
}