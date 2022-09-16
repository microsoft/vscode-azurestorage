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
    constructor(private readonly _account: StorageAccount) { }
    readonly id: string = nonNullProp(this._account, 'id');
    readonly name: string = nonNullProp(this._account, 'name');
    readonly type: string = nonNullProp(this._account, 'type');
    readonly primaryEndpoints: Endpoints = nonNullProp(this._account, 'primaryEndpoints');
}

/**
 * Wrappers around StorageAccountKeyWrapper that guarantees certain properties are not undefined/null
 */
export class StorageAccountKeyWrapper {
    constructor(private readonly _key: StorageAccountKey) { }
    readonly value = nonNullProp(this._key, 'value');
    readonly keyName = nonNullProp(this._key, 'keyName');
}
