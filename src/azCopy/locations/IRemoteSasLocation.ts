/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Location that is used when a SAS is used for authentication. Only
 * supported for Blobs, ADLS Gen2, and File Shares.
 */
export interface IRemoteSasLocation {
    // tslint:disable-next-line:no-reserved-keywords
    type: "RemoteSas";

    /**
     *  The SAS token used to access the storage resource (blob container or file share).
     */
    sasToken: string;

    /**
     * A URI to the storage resource (blob container or file share). The URI should not
     * have any trailing slashes.
     *
     * @example
     * For a Blob container "foo" in storage account "acct", the `resourceUri` should be "https://acct.blob.core.windows.net/foo"
     */
    resourceUri: string;

    /**
     * The path to the thing/s to be transferred/the destination.
     * This path should be the full path to the resource location except the container name,
     * including the first delimiter connecting the container name and this path.
     *
     * @example
     * "container/folder/blob" // path should be "/folder/blob"
     */
    path: string;

    /**
     * If true, a wildcard will be placed at the end of the path. Should only
     * be used when the path points to a directory, and when the location is being
     * used as a source.
     */
    useWildCard: boolean;

    /**
     * The id of either a blob or file share snapshot.
     */
    snapshotId?: string;
}
