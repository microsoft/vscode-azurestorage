/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Subscription } from '@azure/arm-resources-subscriptions';
import { TokenCredential } from '@azure/core-auth';
import { Environment } from '@azure/ms-rest-azure-env';
import type { TokenCredentialsBase } from '@azure/ms-rest-nodeauth';
import { apiUtils } from '@microsoft/vscode-azext-utils';
import { ReadStream } from 'fs';
import * as vscode from 'vscode';
import { CancellationToken, Event, Progress, Terminal } from 'vscode';


export type AzureLoginStatus = 'Initializing' | 'LoggingIn' | 'LoggedIn' | 'LoggedOut';

export interface AzureAccountExtensionApi {
    readonly apiVersion: string;
    readonly status: AzureLoginStatus;
    readonly filters: AzureResourceFilter[];
    readonly sessions: AzureSession[];
    readonly subscriptions: AzureAccountSubscription[];
    readonly onStatusChanged: Event<AzureLoginStatus>;
    readonly onFiltersChanged: Event<void>;
    readonly onSessionsChanged: Event<void>;
    readonly onSubscriptionsChanged: Event<void>;
    readonly waitForFilters: () => Promise<boolean>;
    readonly waitForLogin: () => Promise<boolean>;
    readonly waitForSubscriptions: () => Promise<boolean>;
    createCloudShell(os: 'Linux' | 'Windows'): CloudShell;
}

export interface AzureSession {
    readonly environment: Environment;
    readonly userId: string;
    readonly tenantId: string;

    /**
     * The credentials object for azure-sdk-for-js modules https://github.com/azure/azure-sdk-for-js
     */
    readonly credentials2: TokenCredentialsBase & TokenCredential;
}

export interface AzureAccountSubscription {
    readonly session: AzureSession;
    readonly subscription: Subscription;
}

export type AzureResourceFilter = AzureAccountSubscription;

export type CloudShellStatus = 'Connecting' | 'Connected' | 'Disconnected';

export interface UploadOptions {
    contentLength?: number;
    progress?: Progress<{ message?: string; increment?: number }>;
    token?: CancellationToken;
}

export interface CloudShell {
    readonly status: CloudShellStatus;
    readonly onStatusChanged: Event<CloudShellStatus>;
    readonly waitForConnection: () => Promise<boolean>;
    readonly terminal: Promise<Terminal>;
    readonly session: Promise<AzureSession>;
    readonly uploadFile: (filename: string, stream: ReadStream, options?: UploadOptions) => Promise<void>;
}

export async function getAzureAccountExtensionApi(): Promise<AzureAccountExtensionApi> {
    const extension = vscode.extensions.getExtension<apiUtils.AzureExtensionApiProvider>('ms-vscode.azure-account');

    if (extension) {
        if (!extension.isActive) {
            await extension.activate();
        }

        let azureAccountApi: AzureAccountExtensionApi | undefined;
        if ('getApi' in extension.exports) {
            azureAccountApi = extension.exports.getApi<AzureAccountExtensionApi>('1');
        } else {
            // support versions of the Azure Account extension <0.10.0
            azureAccountApi = extension.exports as unknown as AzureAccountExtensionApi;
        }

        if (azureAccountApi) {
            await azureAccountApi.waitForSubscriptions();
        }

        return azureAccountApi;
    }

    throw new Error("Unable to get Azure Account extension API.");
}
