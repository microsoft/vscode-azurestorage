/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IActionContext } from "@microsoft/vscode-azext-utils";
import { IBlobContainerCreateChildContext } from "../../../utils/blobUtils";
import { localize } from "../../../utils/localize";

export class BlobContainerNameStep extends AzureWizardPromptStep<IBlobContainerCreateChildContext> {
    public async prompt(context: IActionContext & { name?: string }): Promise<void> {
        context.name = await context.ui.showInputBox({
            placeHolder: localize('enterBlobContainerName', 'Enter a name for the new blob container'),
            validateInput: this.validateBlobContainerName
        });
    }

    public shouldPrompt(context: IBlobContainerCreateChildContext): boolean {
        return !context.childName;
    }

    private validateBlobContainerName(name: string): string | undefined | null {
        const validLength = { min: 3, max: 63 };

        if (!name) {
            return "Container name cannot be empty";
        } else if (/\s/.test(name)) {
            return "Container name cannot contain spaces";
        } else if (name.length < validLength.min || name.length > validLength.max) {
            return `Container name must contain between ${validLength.min} and ${validLength.max} characters`;
        } else if (!/^[a-z0-9-]+$/.test(name)) {
            return 'Container name can only contain lowercase letters, numbers and hyphens';
        } else if (/--/.test(name)) {
            return 'Container name cannot contain two hyphens in a row';
        } else if (/(^-)|(-$)/.test(name)) {
            return 'Container name cannot begin or end with a hyphen';
        }

        return undefined;
    }
}
