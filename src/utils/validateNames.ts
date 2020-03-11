/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from "./localize";

const invalidBlobDirectoryChar = '\\'; // Keeps behavior consistent on Mac & Windows when creating blob directories via the file explorer
const invalidFileChars = ['"', '/', '\\', ':', '|', '<', '>', '?', '*'];
const invalidFileCharsString = invalidFileChars.join(', ');

export enum DocumentType {
    index = 'index',
    error = 'error'
}

export function validateBlobDirectoryName(name: string): string | undefined {
    if (!name || name.includes(invalidBlobDirectoryChar)) {
        return `Directory name cannot be empty or contain '${invalidBlobDirectoryChar}'`;
    }

    return undefined;
}

export function validateFileDirectoryName(name: string): string | undefined {
    const validLength = { min: 1, max: 255 };

    if (!name) {
        return "Directory name cannot be empty";
    }

    if (name.length < validLength.min || name.length > validLength.max) {
        return `Directory name must contain between ${validLength.min} and ${validLength.max} characters`;
    }

    if (invalidFileChars.some(ch => name.indexOf(ch) >= 0)) {
        return `Directory name cannot contain the following characters: '${invalidFileCharsString}`;
    }

    return undefined;
}

export function validateFileName(name: string): string | undefined {
    const validLength = { min: 1, max: 255 };

    if (!name) {
        return "Filename cannot be empty";
    }

    if (name.length < validLength.min || name.length > validLength.max) {
        return `Filename must contain between ${validLength.min} and ${validLength.max} characters`;
    }

    if (invalidFileChars.some(ch => name.indexOf(ch) >= 0)) {
        return `Filename cannot contain the following characters: ${invalidFileCharsString}'`;
    }

    return undefined;
}

export function validateDocumentPath(documentPath: string, documentType: DocumentType): undefined | string {
    const minLengthDocumentPath = 3;
    const maxLengthDocumentPath = 255;

    if (documentType === DocumentType.index && documentPath.includes('/')) {
        return localize('indexDocumentPathCannotContainForwardSlash', 'The index document path cannot contain a "/" character.');
    } else if (documentType === DocumentType.error && (documentPath.startsWith('/') || documentPath.endsWith('/'))) {
        return localize('errorDocumentCannotStartOrEndWithForwardSlash', 'The error document path start or end with a "/" character.');
    } else if (documentPath.length < minLengthDocumentPath || documentPath.length > maxLengthDocumentPath) {
        return localize('documentPathLengthIsInvalid', 'The {0} document path must be between {1} and {2} characters in length.', documentType, minLengthDocumentPath, maxLengthDocumentPath);
    }

    return undefined;
}
