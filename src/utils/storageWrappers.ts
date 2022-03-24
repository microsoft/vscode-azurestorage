/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Endpoints, StorageAccount, StorageAccountKey } from '@azure/arm-storage';

export function nonNull<T>(value: T | undefined, name?: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            "Internal error: Expected value to be not null and not undefined"
            + (name ? `: ${name}` : ''));
    }

    return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function copyNonNullProperty<TSource, TDest>(source: TSource, dest: { [key: string]: any }, name: keyof TSource & keyof TDest): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value: any = nonNull(source[name], <string>name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    dest[<string>name] = value;
}

/**
 * Wrappers around StorageAccountWrapper that guarantees certain properties are not undefined/null
 */
export class StorageAccountWrapper {
    constructor(_account: StorageAccount) {
        copyNonNullProperty(_account, this, 'id');
        copyNonNullProperty(_account, this, 'name');
        copyNonNullProperty(_account, this, 'type');
        copyNonNullProperty(_account, this, 'primaryEndpoints');
    }

    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly primaryEndpoints: Endpoints;
}

/**
 * Wrappers around StorageAccountKeyWrapper that guarantees certain properties are not undefined/null
 */
export class StorageAccountKeyWrapper {
    constructor(_key: StorageAccountKey) {
        copyNonNullProperty(_key, this, 'value');
        copyNonNullProperty(_key, this, 'keyName');
    }

    readonly value: string;
    readonly keyName: string;
}
