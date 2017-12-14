/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { UserCancelledError } from '../errors/UserCancelledError';
import DialogOptions from '../messageItems/dialogOptions';

export abstract class BaseEditor<ContextT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, ContextT] } = {};
    private ignoreSave: boolean = false;

    abstract onSave(context: ContextT, document: vscode.TextDocument): Promise<void>;
    abstract getSaveConfirmationText(context: ContextT): Promise<string>;

    constructor(readonly showSavePromptKey: string) {
    }

    public async showEditor(context: ContextT, localFilePath: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(localFilePath);
        this.fileMap[localFilePath] = [document, context];
        await vscode.window.showTextDocument(document);
    }

    public async updateMatchingcontext(doc): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.fsPath, filePath) === '');
        var [ textDocument, context] = this.fileMap[filePath];
        await this.onSave(context, textDocument);
    }

    public async dispose(): Promise<void> {
        Object.keys(this.fileMap).forEach(async (key) => await fse.remove(path.dirname(key)));
    }

    public async onDidSaveTextDocument(globalState: vscode.Memento, doc: vscode.TextDocument): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.uri.fsPath, filePath) === '');
        if (!this.ignoreSave && filePath) {
            const context: ContextT = this.fileMap[filePath][1];
            const showSaveWarning: boolean | undefined = vscode.workspace.getConfiguration().get(this.showSavePromptKey);


            if (showSaveWarning) {             
                const message: string = await this.getSaveConfirmationText(context);
                const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(message, DialogOptions.OK, DialogOptions.DontShowAgain, DialogOptions.Cancel);

                if (!result || result === DialogOptions.Cancel) {
                    throw new UserCancelledError();
                } else if (result === DialogOptions.DontShowAgain) {
                    await vscode.workspace.getConfiguration().update(this.showSavePromptKey, false, vscode.ConfigurationTarget.Global);
                    await globalState.update(this.showSavePromptKey, true);
                }
            }

            await this.onSave(context, doc);
        }
    }
}