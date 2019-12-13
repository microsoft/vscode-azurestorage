/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const invalidChars = ['"', '/', '\\', ':', '|', '<', '>', '?', '*'];
const invalidCharsString = invalidChars.join(', ');

export function validateDirectoryName(name: string): string | undefined | null {
    const validLength = { min: 1, max: 255 };

    if (!name) {
        return "Directory name cannot be empty";
    }

    if (name.length < validLength.min || name.length > validLength.max) {
        return `Directory name must contain between ${validLength.min} and ${validLength.max} characters`;
    }

    if (invalidChars.some(ch => name.indexOf(ch) >= 0)) {
        return `Directory name cannot contain the following characters: '${invalidCharsString}`;
    }

    return undefined;
}

export function validateFileName(name: string): string | undefined | null {
    const validLength = { min: 1, max: 255 };

    if (!name) {
        return "Filename cannot be empty";
    }

    if (name.length < validLength.min || name.length > validLength.max) {
        return `Filename must contain between ${validLength.min} and ${validLength.max} characters`;
    }

    if (invalidChars.some(ch => name.indexOf(ch) >= 0)) {
        return `Filename cannot contain the following characters: ${invalidCharsString}'`;
    }

    return undefined;
}
