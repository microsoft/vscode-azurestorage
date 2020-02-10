/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';

export function throwIfCanceled(cancellationToken: vscode.CancellationToken | undefined, properties: TelemetryProperties | undefined, cancelStep: string): void {
    if (cancellationToken && cancellationToken.isCancellationRequested) {
        if (properties && cancelStep) {
            properties.cancelStep = cancelStep;
        }
        throw new UserCancelledError();
    }
}
