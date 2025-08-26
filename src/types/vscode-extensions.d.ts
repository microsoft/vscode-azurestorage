/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Temporary type declaration to support newer Azure utility packages
// that expect VS Code APIs not yet available in stable releases

declare module 'vscode' {
    // Placeholder for AuthenticationSessionRequest which is expected by newer Azure utilities
    // This is a forward-compatibility type to allow building with the latest Azure packages
    export interface AuthenticationSessionRequest {
        scopes: string[];
        providerId?: string;
    }
}