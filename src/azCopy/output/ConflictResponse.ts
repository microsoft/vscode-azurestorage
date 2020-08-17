/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

/**
 * AzCopy process listen to 4 possible commands for resolving conflicts
 * - `y`: overwrite for this conflict
 * - `n`: skip for this conflict
 * - `a`: overwrite for this conflict and all future conflicts
 * - `l`: skip for this conflict and all future conflicts
 */
export type ConflictResponse = "y" | "n" | "a" | "l";
