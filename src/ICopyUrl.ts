/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IAzureNode } from "vscode-azureextensionui";

export interface ICopyUrl {
    copyUrl(_node: IAzureNode): void;
}
