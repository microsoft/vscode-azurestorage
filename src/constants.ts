/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

export const staticWebsiteContainerName = '$web';

export enum configurationSettingsKeys {
    deployPath = 'deployPath',
    preDeployTask = 'preDeployTask'
}

export const extensionPrefix: string = 'azureStorage';

export const resourcesPath = path.join(__dirname, '..', 'resources');
