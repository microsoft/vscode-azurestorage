/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocument } from "vscode";

export interface IRemoteFileHandler<ContextT> {
    uploadFile(context: ContextT, document: TextDocument): Promise<void>;
    downloadFile(context: ContextT, filePath: string): Promise<void>;
    getFilename(context: ContextT): Promise<string>;
    getSaveConfirmationText(context: ContextT): Promise<string>;
}