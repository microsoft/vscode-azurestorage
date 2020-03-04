/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageAccountWizardContext } from "vscode-azureextensionui";

export interface IStaticWebsiteConfigWizardContext extends IStorageAccountWizardContext {
    enableStaticWebsite: boolean;
    indexDocument: string;
    errorDocument404Path: string;
}
