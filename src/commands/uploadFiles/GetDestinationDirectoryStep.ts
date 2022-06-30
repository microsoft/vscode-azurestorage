/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { getDestinationDirectory } from '../../utils/uploadUtils';
import { IUploadFilesWizardContext } from './IUploadFilesWizardContext';

export class GetDestinationDirectoryStep extends AzureWizardPromptStep<IUploadFilesWizardContext> {
    public async prompt(context: IUploadFilesWizardContext): Promise<void> {
        context.destinationDirectory = await getDestinationDirectory(context, context.destinationDirectory);
    }

    public shouldPrompt(_context: IUploadFilesWizardContext): boolean {
        return true;
    }
}
