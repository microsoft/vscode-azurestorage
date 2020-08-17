/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation } from "./ILocalLocation";
import { IRemoteSasLocation } from "./IRemoteSasLocation";

export type AzCopyLocation = ILocalLocation | IRemoteSasLocation;
