/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { IAzCopyResolution } from "../azCopy/IAzCopyResolution";

export interface IUploadFilesWizardContext extends IActionContext, ExecuteActivityContext {
    destinationDirectory?: string;
    resolution?: IAzCopyResolution;
}
