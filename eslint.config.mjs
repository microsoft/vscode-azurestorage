/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azExtEslintRecommended } from '@microsoft/vscode-azext-eng/eslint';

export default [
    { ignores: ['scripts/**'] },
    ...azExtEslintRecommended,
];

