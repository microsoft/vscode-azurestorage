/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type CheckMd5Option = "NoCheck" | "LogOnly" | "FailIfDifferent" | "FailIfDifferentOrMissing";
export type FromToOption = "LocalBlob" | "BlobLocal" | "LocalBlobFS" | "BlobFSLocal" | "LocalFile" | "FileLocal" | "BlobBlob";
export type BlobType = "BlockBlob" | "PageBlob" | "AppendBlob" | "Detect";

/**
 * Command line args that are passed to AzCopy during a copy command.
 */
export interface ICopyOptions {
    overwriteExisting?: "true" | "false" | "prompt";
    listOfFiles?: string;
    followSymLinks?: boolean;
    recursive?: boolean;
    putMd5?: boolean;
    checkMd5?: CheckMd5Option;
    fromTo?: FromToOption;
    blobType?: BlobType;
    capMbps?: number;
    preserveAccessTier?: boolean;
    checkLength?: boolean;
    decompress?: boolean;
    preserveSmbInfo?: boolean;
    preserveSmbPermissions?: boolean;
    accessTier?: "Hot" | "Cool";
    excludePath?: string;
}
