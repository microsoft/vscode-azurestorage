/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from './extensionVariables';

export const staticWebsiteContainerName = '$web';

export enum configurationSettingsKeys {
    deployPath = 'deployPath',
    preDeployTask = 'preDeployTask',
    enableViewInFileExplorer = 'enableViewInFileExplorer'
}

export const extensionPrefix: string = 'azureStorage';

export function getResourcesPath(): string {
    return ext.context.asAbsolutePath('resources');
}
