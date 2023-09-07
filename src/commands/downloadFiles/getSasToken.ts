/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AccountSASPermissions, AccountSASSignatureValues } from '@azure/storage-blob';
import { IStorageRoot } from '../../tree/IStorageRoot';

const threeDaysInMS: number = 1000 * 60 * 60 * 24 * 3;

export function getSasToken(root: IStorageRoot): string {
    const accountSASSignatureValues: AccountSASSignatureValues = {
        expiresOn: new Date(Date.now() + threeDaysInMS),
        permissions: AccountSASPermissions.parse('rwl'), // read, write, list
        services: 'bf', // blob, file
        resourceTypes: 'co' // container, object
    };
    return root.generateSasToken(accountSASSignatureValues);
}
