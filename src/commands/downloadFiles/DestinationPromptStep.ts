/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IActionContext } from "@microsoft/vscode-azext-utils";
import { configurationSettingsKeys } from "../../constants";
import { localize } from "../../utils/localize";
import { showWorkspaceFoldersQuickPick } from "../../utils/quickPickUtils";
import { IDownloadWizardContext } from "./IDownloadWizardContext";

export class DestinationPromptStep extends AzureWizardPromptStep<IActionContext> {
    public async prompt(context: IDownloadWizardContext): Promise<void> {
        const placeHolderString: string = localize('selectFolderForDownload', 'Select destination folder for download');
        context.destinationFolder = await showWorkspaceFoldersQuickPick(placeHolderString, context, configurationSettingsKeys.deployPath);
    }

    public shouldPrompt(context: IDownloadWizardContext): boolean {
        return !context.destinationFolder;
    }
}
