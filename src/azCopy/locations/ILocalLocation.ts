/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ILocalLocation {
    // tslint:disable-next-line:no-reserved-keywords
    type: "Local";
    /**
     * An absolute path to a location on disk. The
     * path should end with a slash if it points to a directory.
     */
    path: string;
    /**
     * If true, a wildcard will be placed at the end of the path. Should only
     * be used when the path points to a directory and when the location is being
     * used as a source.
     */
    useWildCard: boolean;
}
