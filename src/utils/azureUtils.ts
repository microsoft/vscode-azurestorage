/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export function getAppResourceIdFromId(id: string): string | undefined {
    const matches: RegExpMatchArray | null = id.match(/\/subscriptions\/.*\/resourceGroups\/.*\/providers\/Microsoft.Storage\/storageAccounts\/[^\/]*/);

    return matches?.[0];
}
