/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { workspace } from 'vscode';

export function isStackCheck(): boolean {
    const config = workspace.getConfiguration("azure");
    const apiProfile = config.get<boolean>("target_azurestack_api_profile");
    return !apiProfile ? false : true;
}
