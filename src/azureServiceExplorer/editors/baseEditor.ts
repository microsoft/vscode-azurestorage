/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { TemporaryFile } from '../../components/temporaryFile';

class SaveDialogResponses {
    static readonly OK: string = "OK";
    static readonly DontShowAgain: string = "Don't Show Again";
}

export class UserCancelledError extends Error { }

export abstract class BaseEditor<NodeT> implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, NodeT] } = {};
    private ignoreSave: boolean = false;

    private readonly dontShowKey: string = 'azureStorage.dontShow.SaveEqualsUpdateToAzure';


    abstract getData(node: NodeT): Promise<string>;
    abstract updateData(node: NodeT, data: string): Promise<string>;
    abstract getFilename(node: NodeT): Promise<string>;
    abstract getSaveConfirmationText(node: NodeT): Promise<string>;

    public async showEditor(node: NodeT): Promise<void> {
        var fileName = await this.getFilename(node);     
        const localFilePath = await TemporaryFile.create(fileName)
        const document = await vscode.workspace.openTextDocument(localFilePath);
        this.fileMap[localFilePath] = [document, node];
        const textEditor = await vscode.window.showTextDocument(document);
        var data = await this.getData(node);
        await this.updateEditor(data, textEditor);
    }

    public async updateMatchingNode(doc): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.fsPath, filePath) === '');
        var [ textDocument, node] = this.fileMap[filePath];
        await this.updateRemote(node, textDocument);
    }

    public async dispose(): Promise<void> {
        Object.keys(this.fileMap).forEach(async (key) => await fse.remove(path.dirname(key)));
    }

    private async updateRemote(node: NodeT, doc: vscode.TextDocument): Promise<void> {
        const updatedData: string = await this.updateData(node, doc.getText());
        await this.updateEditor(updatedData, vscode.window.activeTextEditor);
    }

    private async updateEditor(data: string, textEditor: vscode.TextEditor): Promise<void> {
        await BaseEditor.writeToEditor(textEditor, data);
        this.ignoreSave = true;
        try {
            await textEditor.document.save();
        } finally {
            this.ignoreSave = false;
        }
    }

    public async onDidSaveTextDocument(globalState: vscode.Memento, doc: vscode.TextDocument): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.uri.fsPath, filePath) === '');
        if (!this.ignoreSave && filePath) {
            const node: NodeT = this.fileMap[filePath][1];
            const dontShow: boolean | undefined = globalState.get(this.dontShowKey);
            if (dontShow !== true) {
                
                const message: string = await this.getSaveConfirmationText(node);
                const result: string | undefined = await vscode.window.showWarningMessage(message, SaveDialogResponses.OK, SaveDialogResponses.DontShowAgain);

                if (!result) {
                    throw new UserCancelledError();
                } else if (result === SaveDialogResponses.DontShowAgain) {
                    await globalState.update(this.dontShowKey, true);
                }
            }

            await this.updateRemote(node, doc);
        }
    }

    private static async writeToEditor(editor: vscode.TextEditor, data: string): Promise<void> {
        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            if (editor.document.lineCount > 0) {
                const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
                editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine.range.start.line, lastLine.range.end.character)));
            }
    
            editBuilder.insert(new vscode.Position(0, 0), data);
        });
    }
}