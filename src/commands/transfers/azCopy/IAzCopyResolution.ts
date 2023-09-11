/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IParsedError } from "@microsoft/vscode-azext-utils";

export interface IAzCopyResolution {
    errors: IParsedError[];
}
