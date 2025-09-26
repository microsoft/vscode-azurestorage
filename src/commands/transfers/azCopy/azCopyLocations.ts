/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteAuthLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { posix, sep } from "path";
import { DownloadItem, UploadItem } from "../transfers";

export function createAzCopyLocalLocation(path: string, isFolder?: boolean): ILocalLocation {
    if (isFolder && !path.endsWith(sep)) {
        path += sep;
    }
    return { type: 'Local', path, useWildCard: !!isFolder };
}

export async function createAzCopyRemoteLocation(item: DownloadItem | UploadItem): Promise<IRemoteSasLocation | IRemoteAuthLocation> {
    let path = item.remoteFilePath;
    if (item.isDirectory && !path.endsWith(posix.sep)) {
        path += posix.sep;
    }

    // Ensure path begins with '/' to transfer properly
    path = path[0] === posix.sep ? path : `${posix.sep}${path}`;
    let remoteLocation: IRemoteSasLocation | IRemoteAuthLocation;
    const { sasToken, resourceUri, treeItem } = item;

    if (treeItem && !treeItem.root.allowSharedKeyAccess) {
        const accessToken = await treeItem.root.getAccessToken();
        const refreshToken = treeItem.root.getAccessToken;
        remoteLocation = createRemoteAuthLocation(item, path, resourceUri, accessToken, refreshToken);
    } else if (sasToken) {
        remoteLocation = {
            type: 'RemoteSas',
            sasToken,
            resourceUri,
            path,
            useWildCard: !!item.isDirectory
        };
    } else {
        throw new Error(`No sasToken or accessToken found for resourceUri "${resourceUri}".`);
    }

    return remoteLocation;
}

function createRemoteAuthLocation(item: DownloadItem | UploadItem, path: string, resourceUri: string, accessToken: string, refreshToken: () => Promise<string>): IRemoteAuthLocation {
    const tenantId = item.treeItem?.root.tenantId ?? '';
    return {
        type: 'RemoteAuth',
        authToken: accessToken,
        refreshToken,
        tenantId,
        resourceUri,
        path,
        aadEndpoint: 'https://storage.azure.com',
        useWildCard: !!item.isDirectory
    };
}
