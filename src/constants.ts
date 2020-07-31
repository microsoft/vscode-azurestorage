/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from './extensionVariables';

export const staticWebsiteContainerName = '$web';

export const maxPageSize = 50;

export enum configurationSettingsKeys {
    deployPath = 'deployPath',
    preDeployTask = 'preDeployTask',
}

export const extensionPrefix: string = 'azureStorage';

export const emulatorAccountName: string = 'devstoreaccount1';
export const emulatorConnectionString: string = 'UseDevelopmentStorage=true;';

export function getResourcesPath(): string {
    return ext.context.asAbsolutePath('resources');
}

export const azcopy: string = 'azcopy';
