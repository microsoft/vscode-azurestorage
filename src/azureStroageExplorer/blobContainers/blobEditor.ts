/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { TemporaryFile } from '../../components/temporaryFile';
import { BlobNode } from './blobNode';
import * as azureStorage from "azure-storage";

class SaveDialogResponses {
    static readonly OK: string = "OK";
    static readonly DontShowAgain: string = "Don't Show Again";
}

export class UserCancelledError extends Error { }

export class BlobEditor implements vscode.Disposable {
    private fileMap: { [key: string]: [vscode.TextDocument, BlobNode] } = {};
    private ignoreSave: boolean = false;

    private readonly dontShowKey: string = 'azureStorage.dontShow.SaveEqualsUpdateToAzure';

    private async getBlobData(node: BlobNode): Promise<string> {
        var blobService = azureStorage.createBlobService(node.storageAccount.name, node.key.value);

        return await new Promise<string>((resolve, _reject) => {
            blobService.getBlobToText(node.container.name, node.blob.name, (_error: Error, text: string, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                resolve(text);
            });
        });
    }
    private async updateBlobData(node: BlobNode, data: string): Promise<string> {
        var blobService = azureStorage.createBlobService(node.storageAccount.name, node.key.value);  
        return new Promise<string>((resolve, _reject) => {
            blobService.createBlockBlobFromText(node.container.name, node.blob.name, data, async () => {
                resolve(await this.getBlobData(node));
            });
        });
    }

    public async showEditor(blobNode: BlobNode): Promise<void> {
        const localFilePath = await TemporaryFile.create(blobNode.blob.name)
        const document = await vscode.workspace.openTextDocument(localFilePath);
        this.fileMap[localFilePath] = [document, blobNode];
        const textEditor = await vscode.window.showTextDocument(document);
        var data = await this.getBlobData(blobNode);
        await this.updateEditor(data, textEditor);
    }

    public async updateMatchingNode(doc): Promise<void> {
        const filePath = Object.keys(this.fileMap).find((filePath) => path.relative(doc.fsPath, filePath) === '');
        var [ textDocument, blobNode] = this.fileMap[filePath];
        await this.updateBlob(blobNode, textDocument);
    }

    public async dispose(): Promise<void> {
        Object.keys(this.fileMap).forEach(async (key) => await fse.remove(path.dirname(key)));
    }

    private async updateBlob(blobNode: BlobNode, doc: vscode.TextDocument): Promise<void> {
        const updatedBlob: string = await this.updateBlobData(blobNode, doc.getText());
        await this.updateEditor(updatedBlob, vscode.window.activeTextEditor);
    }

    private async updateEditor(data: string, textEditor: vscode.TextEditor): Promise<void> {
        await BlobEditor.writeToEditor(textEditor, data);
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
            const node: BlobNode = this.fileMap[filePath][1];
            const dontShow: boolean | undefined = globalState.get(this.dontShowKey);
            if (dontShow !== true) {
                const message: string = `Saving '${node.blob.name}' will update the blob "${node.blob.name}" in Blob Container "${node.container.name}"`;
                const result: string | undefined = await vscode.window.showWarningMessage(message, SaveDialogResponses.OK, SaveDialogResponses.DontShowAgain);

                if (!result) {
                    throw new UserCancelledError();
                } else if (result === SaveDialogResponses.DontShowAgain) {
                    await globalState.update(this.dontShowKey, true);
                }
            }

            await this.updateBlob(node, doc);
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