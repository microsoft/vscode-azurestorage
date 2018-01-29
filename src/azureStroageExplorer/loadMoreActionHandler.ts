/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { AzureTreeDataProvider, IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';
import TelemetryReporter from 'vscode-extension-telemetry';
import { OutputChannel, ExtensionContext } from 'vscode';

export class LoadMoreActionHandler extends AzureActionHandler {
    constructor(extensionContext: ExtensionContext, outputChannel: OutputChannel, telemetryReporter: TelemetryReporter, private treeDataProvider: AzureTreeDataProvider) {
        super(extensionContext, outputChannel, telemetryReporter);
    }

    registerActions() {
        this.registerCommand("azureStorage.loadMoreNode", (node: IAzureNode) => { this.treeDataProvider.loadMore(node) });
    }
}
