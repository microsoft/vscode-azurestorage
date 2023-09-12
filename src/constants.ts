/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress } from 'vscode';
import { ext } from './extensionVariables';

export const staticWebsiteContainerName = '$web';

export const maxPageSize = 50;

export enum configurationSettingsKeys {
    deployPath = 'deployPath',
    preDeployTask = 'preDeployTask',
    deleteBeforeDeploy = 'deleteBeforeDeploy'
}

export const extensionPrefix: string = 'azureStorage';

export const azuriteExtensionId: string = 'Azurite.azurite';
export const emulatorTimeoutMS: number = 3 * 1000;
export const emulatorAccountName: string = 'devstoreaccount1';
export const emulatorConnectionString: string = 'UseDevelopmentStorage=true;';
export const emulatorKey: string = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

export const maxRemoteFileEditSizeMB: number = 50;
export const maxRemoteFileEditSizeBytes: number = maxRemoteFileEditSizeMB * 1024 * 1024;

export const storageExplorerDownloadUrl: string = 'https://go.microsoft.com/fwlink/?LinkId=723579';

export function getResourcesPath(): string {
    return ext.context.asAbsolutePath('resources');
}

export type NotificationProgress = Progress<{
    message?: string | undefined;
    increment?: number | undefined;
}>;

export const storageProvider: string = 'Microsoft.Storage';

export const storageFilter = {
    type: 'Microsoft.Storage/storageAccounts',
}

export const threeDaysInMS: number = 1000 * 60 * 60 * 24 * 3;
