/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export interface ICopyUrl {
    getUrl?(): string;
    copyUrl(): void;
}
