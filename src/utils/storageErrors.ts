/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseError } from "@microsoft/vscode-azext-utils";
import { localize } from "./localize";

/**
 * Azure Storage error code returned when a request uses shared key (account key) credentials
 * but the storage account has `allowSharedKeyAccess` set to false.
 */
export const sharedKeyDisabledErrorCode = 'SharedKeyDisabled';

/**
 * Azure Storage error code returned when an Entra ID (Azure AD) token is used but the
 * identity does not have the required RBAC role on the storage account.
 */
export const authorizationPermissionMismatchErrorCode = 'AuthorizationPermissionMismatch';

/**
 * Returns true if the error indicates that shared key (account key) authorization is disabled
 * on the storage account (`allowSharedKeyAccess: false`).
 */
export function isSharedKeyDisabledError(error: unknown): boolean {
    const pe = parseError(error);
    return pe.errorType === sharedKeyDisabledErrorCode || pe.message.includes(sharedKeyDisabledErrorCode);
}

/**
 * Returns true if the error indicates an Entra ID (Azure AD) token was used but the identity
 * lacks the required Azure RBAC role on the storage account.
 */
export function isAuthorizationPermissionMismatchError(error: unknown): boolean {
    const pe = parseError(error);
    return pe.errorType === authorizationPermissionMismatchErrorCode || pe.message.includes(authorizationPermissionMismatchErrorCode);
}

/**
 * Returns a user-friendly message for blob service RBAC access denial.
 */
export function getBlobRBACErrorMessage(storageAccountName: string): string {
    return localize(
        'storageErrors.blobRbacPermissionMismatch',
        'Access denied to storage account "{0}". Ensure you have the "Storage Blob Data Reader" or "Storage Blob Data Contributor" Azure RBAC role assigned. See https://aka.ms/vs-azure-storage-rbac for details.',
        storageAccountName
    );
}

/**
 * Returns a user-friendly message for file share service RBAC access denial.
 */
export function getFileShareRBACErrorMessage(storageAccountName: string): string {
    return localize(
        'storageErrors.fileShareRbacPermissionMismatch',
        'Access denied to storage account "{0}". Ensure you have the "Storage File Data SMB Share Reader" or "Storage File Data SMB Share Contributor" Azure RBAC role assigned. See https://aka.ms/vs-azure-storage-rbac for details.',
        storageAccountName
    );
}

/**
 * Returns a user-friendly message for queue service RBAC access denial.
 */
export function getQueueRBACErrorMessage(storageAccountName: string): string {
    return localize(
        'storageErrors.queueRbacPermissionMismatch',
        'Access denied to storage account "{0}". Ensure you have the "Storage Queue Data Reader" or "Storage Queue Data Contributor" Azure RBAC role assigned. See https://aka.ms/vs-azure-storage-rbac for details.',
        storageAccountName
    );
}

/**
 * Returns a user-friendly message for table service RBAC access denial.
 */
export function getTableRBACErrorMessage(storageAccountName: string): string {
    return localize(
        'storageErrors.tableRbacPermissionMismatch',
        'Access denied to storage account "{0}". Ensure you have the "Storage Table Data Reader" or "Storage Table Data Contributor" Azure RBAC role assigned. See https://aka.ms/vs-azure-storage-rbac for details.',
        storageAccountName
    );
}
