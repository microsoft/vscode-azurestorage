/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { StorageSharedKeyCredential as StorageSharedKeyCredentialBlob } from '@azure/storage-blob';
import type { StorageSharedKeyCredential as StorageSharedKeyCredentialFileShare } from '@azure/storage-file-share';
import type { StorageSharedKeyCredential as StorageSharedKeyCredentialQueue } from '@azure/storage-queue';

import { TokenCredential } from '@azure/core-auth';

import { ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import { authentication } from 'vscode';
import { ext } from "../extensionVariables";

type NonTableStorageSharedKeyCredential = StorageSharedKeyCredentialBlob | StorageSharedKeyCredentialFileShare | StorageSharedKeyCredentialQueue;

export function getNonTableStorageCredential<SharedKeyCredentialT extends NonTableStorageSharedKeyCredential>(sharedKeyCredentialGetter: () => SharedKeyCredentialT, _subscriptionContext: ISubscriptionContext): SharedKeyCredentialT | TokenCredential {
    let credential: SharedKeyCredentialT | TokenCredential;
    if (ext.isWeb) {
        credential = {
            getToken: async (scopes) => {
                // Switch to using _subscriptionContext once its .credentials properly respects passed in scopes
                // Requires:
                // 1. Merging of this auth package PR: https://github.com/microsoft/vscode-azuretools/pull/1597
                // 2. Publishing of a new auth package
                // 3. Updating of the version of the auth package in resource groups extension
                // 4. Publishing of new resource groups extension
                const session = await authentication.getSession("microsoft", Array.isArray(scopes) ? scopes : [scopes], { createIfNone: false, silent: true });
                return {
                    token: session!.accessToken,
                    expiresOnTimestamp: 0
                };
            }
        }
    } else {
        credential = sharedKeyCredentialGetter();
    }
    return credential;
}
