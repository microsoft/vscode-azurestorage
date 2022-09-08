/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from "@microsoft/vscode-azext-utils";
import { localize } from "../../../utils/localize";
import { IFileShareWizardContext } from "./IFileShareWizardContext";

export class FileShareNameStep extends AzureWizardPromptStep<IFileShareWizardContext> {
    public async prompt(context: IFileShareWizardContext): Promise<void> {
        context.name = await context.ui.showInputBox({
            placeHolder: localize('enterFileShareName', 'Enter a name for the new file share'),
            validateInput: this.validateFileShareName
        });
    }

    public shouldPrompt(context: IFileShareWizardContext): boolean {
        return !context.name;
    }

    private validateFileShareName(name: string): string | undefined | null {
        const validLength = { min: 3, max: 63 };

        if (!name) {
            return localize('shareNameEmpty', "Share name cannot be empty");
        }
        if (name.indexOf(" ") >= 0) {
            return localize('shareNameSpaces', "Share name cannot contain spaces");
        }
        if (name.length < validLength.min || name.length > validLength.max) {
            return localize('shareNameBetween', 'Share name must contain between {0} and {1} characters', validLength.min, validLength.max);
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
            return localize('shareNameInvalidChar', 'Share name can only contain lowercase letters, numbers and hyphens');
        }
        if (/--/.test(name)) {
            return localize('shareNameDoubleHyphen', 'Share name cannot contain two hyphens in a row');
        }
        if (/(^-)|(-$)/.test(name)) {
            return localize('shareNameHyphen', 'Share name cannot begin or end with a hyphen');
        }

        return undefined;
    }
}
