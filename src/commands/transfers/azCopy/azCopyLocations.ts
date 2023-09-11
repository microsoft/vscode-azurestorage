/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { posix, sep } from "path";

export function createAzCopyLocalLocation(path: string, isFolder?: boolean): ILocalLocation {
    if (isFolder && !path.endsWith(sep)) {
        path += sep;
    }
    return { type: 'Local', path, useWildCard: !!isFolder };
}

export function createAzCopyRemoteLocation(resourceUri: string, sasToken: string, path: string, isFolder?: boolean): IRemoteSasLocation {
    if (isFolder && !path.endsWith(posix.sep)) {
        path += posix.sep;
    }

    // Ensure path begins with '/' to transfer properly
    path = path[0] === posix.sep ? path : `${posix.sep}${path}`;
    return { type: 'RemoteSas', sasToken, resourceUri, path, useWildCard: !!isFolder };
}
