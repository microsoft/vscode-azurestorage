/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Endpoints, StorageAccount, StorageAccountKey } from '@azure/arm-storage';
import { nonNullProp } from '@microsoft/vscode-azext-utils';

/**
 * Wrappers around StorageAccountWrapper that guarantees certain properties are not undefined/null
 */
export class StorageAccountWrapper {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly primaryEndpoints: Endpoints;
    readonly location: string;
    constructor(private readonly _account: StorageAccount) {
        this.id = nonNullProp(this._account, 'id');
        this.name = nonNullProp(this._account, 'name');
        this.type = nonNullProp(this._account, 'type');
        this.primaryEndpoints = nonNullProp(this._account, 'primaryEndpoints');
        this.location = nonNullProp(this._account, 'location');
    }
}

/**
 * Wrappers around StorageAccountKeyWrapper that guarantees certain properties are not undefined/null
 */
export class StorageAccountKeyWrapper {
    readonly value: string;
    readonly keyName: string;
    constructor(private readonly _key: StorageAccountKey) {
        this.value = nonNullProp(this._key, 'value');
        this.keyName = nonNullProp(this._key, 'keyName');
    }
}
