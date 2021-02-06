/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function getPropertyFromConnectionString(connectionString: string, property: string): string | undefined {
    const regexp: RegExp = new RegExp(`(?:^|;)\\s*${property}=([^;]+)(?:;|$)`, 'i');
    const match: RegExpMatchArray | undefined = connectionString.match(regexp) || undefined;
    return match && match[1];
}
