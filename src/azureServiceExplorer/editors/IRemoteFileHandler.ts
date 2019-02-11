/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IRemoteFileHandler<ContextT> {
    uploadFile(context: ContextT, filePath: string): Promise<void>;
    downloadFile(context: ContextT, filePath: string): Promise<void>;
    getFilename(context: ContextT): Promise<string>;
    getSaveConfirmationText(context: ContextT): Promise<string>;
}
