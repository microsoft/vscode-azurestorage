/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

function endsWithSlash(path: string) {
    return path.endsWith("/");
}

export class BlobPathUtils {
    /**
     * Gets the parent directory of the given `path`.
     * This function is unsafe to use on a path to an empty name blob.
     *
     * @example dirname("abc/efg/") -> "abc/"
     */
    public static dirname(path: string): string {
        if (endsWithSlash(path)) {
            const secondLastIndex = path.slice(0, path.length - 1).lastIndexOf("/");
            return secondLastIndex < 0 ? "" : `${path.slice(0, secondLastIndex)}/`;
        } else {
            const lastIndex = path.lastIndexOf("/");
            return lastIndex < 0 ? "" : `${path.slice(0, lastIndex)}/`;
        }
    }

    /**
     * Gets the last segment of the given `path`.
     * This function is unsafe to use on a path to an empty name blob.
     *
     * @example basename("abc/efg/") -> "efg/"
     */
    public static basename(path: string): string {
        const lastIndex = path.lastIndexOf("/");
        if (lastIndex === path.length - 1) {
            // path is a directory path
            const secondLastIndex = path.slice(0, path.length - 1).lastIndexOf("/");
            return path.slice(secondLastIndex + 1);
        } else {
            // path is a blob path
            return path.slice(lastIndex + 1);
        }
    }

    /**
     * Joins an array of path segments to a base path to form a new path.
     */
    public static join(basePath: string, ...segments: [...string[], string]): string {
        return basePath + segments.join("");
    }

    /**
     * Removes the trailing slash if the `path` ends with a slash.
     */
    public static trimSlash(path: string): string {
        if (endsWithSlash(path)) {
            return path.slice(0, path.length - 1);
        }
        return path;
    }

    /**
     * Removes the trailing slash if the `path` ends with a slash.
     */
    public static appendSlash(path: string): string {
        if (!endsWithSlash(path)) {
            return path + "/";
        }
        return path;
    }
}
