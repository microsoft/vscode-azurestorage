/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureActionHandler } from 'vscode-azureextensionui';
import { AzureStorageOutputChannel } from '../../azureStroageExplorer/azureStorageOutputChannel';
import { reporter } from '../../components/telemetry/reporter';

export abstract class BaseActionHandler {
    private _azureActionHandler: AzureActionHandler;

    abstract registerActions(context: vscode.ExtensionContext);

    private ensureHandler(context: vscode.ExtensionContext): void {
        if (!this._azureActionHandler) {
            this._azureActionHandler = new AzureActionHandler(context, AzureStorageOutputChannel, reporter);
        }
    }

    public initEvent<T>(context: vscode.ExtensionContext, eventId: string, event: vscode.Event<T>, callback: (...args: any[]) => any) {
        this.ensureHandler(context);
        this._azureActionHandler.registerEvent(eventId, event, callback);
    }

    public initCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => any) {
        this.initAsyncCommand(context, commandId, (...args: any[]) => Promise.resolve(callback(...args)));
    }

    public initAsyncCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => Promise<any>) {
        this.ensureHandler(context);
        this._azureActionHandler.registerCommand(commandId, callback);
    }
}
