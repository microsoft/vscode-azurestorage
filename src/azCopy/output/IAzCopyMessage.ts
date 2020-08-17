/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEndOfJobMessage } from "./IEndOfJobMessage";
import { IErrorMessage } from "./IErrorMessage";
import { IInfoMessage } from "./IInfoMessage";
import { IInitMessage } from "./IInitMessage";
import { IProgressMessage } from "./IProgressMessage";
import { IConflictPromptMessage } from "./IPromptMessage";

export type AzCopyMessage = IInfoMessage | IInitMessage | IProgressMessage | IEndOfJobMessage | IErrorMessage | IConflictPromptMessage;
