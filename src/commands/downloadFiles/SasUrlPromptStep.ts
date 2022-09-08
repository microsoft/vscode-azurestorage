/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IActionContext } from "@microsoft/vscode-azext-utils";
import { env } from "vscode";
import { localize } from "../../utils/localize";
import { ISasDownloadContext } from "./ISasDownloadContext";

export class SasUrlPromptStep extends AzureWizardPromptStep<IActionContext> {
    public async prompt(context: ISasDownloadContext): Promise<void> {
        let value: string | undefined = await env.clipboard.readText();
        if (await this.validateInput(context, value)) {
            // if there is a string value here, then the clipboard does not contain a valid SAS url
            value = undefined;
        }

        context.sasUrl = await context.ui.showInputBox({
            prompt: localize('enterSasUrl', 'Enter a Azure Storage SAS URL'),
            validateInput: async (s): Promise<string | undefined> => await this.validateInput(context, s),
            value
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }

    public async validateInput(_wizardContext: ISasDownloadContext, value: string | undefined): Promise<string | undefined> {
        if (!value) {
            return localize('emptySasUrl', 'A SAS token and URL cannot be empty.')
        }

        try {
            const url = new URL(value);
            // not a comprehensive list of required params
            if (
                !url.searchParams.get('sp') ||
                !url.searchParams.get('se') ||
                !url.searchParams.get('sig')
            ) {
                return localize('enterValidToken', 'The SAS token is missing a parameter. Enter a valid SAS token.',)
            }
        } catch (err) {
            return localize('enterValidSasUrl', 'The URL "{0}" is not valid. Enter a valid URL', value);
        }

        return undefined;
    }
}
