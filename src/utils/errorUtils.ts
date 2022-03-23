/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IParsedError, TelemetryProperties, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from './localize';

export const multipleAzCopyErrorsMessage: string = localize('multipleAzCopyErrors', 'Multiple AzCopy errors occurred while uploading. Check the [output window](command:{0}) for more details.', `${ext.prefix}.showOutputChannel`);

export function throwIfCanceled(cancellationToken: vscode.CancellationToken | undefined, properties: TelemetryProperties | undefined, cancelStep: string): void {
    if (cancellationToken && cancellationToken.isCancellationRequested) {
        if (properties && cancelStep) {
            properties.cancelStep = cancelStep;
        }
        throw new UserCancelledError();
    }
}

export function isAzCopyError(parsedError: IParsedError): boolean {
    return /azcopy/i.test(parsedError.message);
}
