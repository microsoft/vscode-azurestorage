/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Command line args that are passed to AzCopy during a delete command.
 */
export interface IDeleteOptions {
    listOfFiles?: string;
    recursive?: boolean;
    /**
     * Whether or not to delete snapshots of a blob when
     * removing it. Include means to delete snapshots, undefined
     * means to skip blobs with snapshots. There is another possible
     * value, "only", which would remove all snapshots and leave
     * the base, but we're not going to expose that at the moment.
     */
    deleteSnapshots?: "include";
}
