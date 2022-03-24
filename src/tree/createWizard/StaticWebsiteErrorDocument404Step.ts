/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from "@microsoft/vscode-azext-utils";
import { localize } from "../../utils/localize";
import { DocumentType, validateDocumentPath } from "../../utils/validateNames";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";

export class StaticWebsiteErrorDocument404Step extends AzureWizardPromptStep<IStaticWebsiteConfigWizardContext> {
    static readonly defaultErrorDocument404Path: string = 'index.html';
    private oldErrorDocument404Path: string | undefined;

    public constructor(oldErrorDocument404Path?: string) {
        super();
        this.oldErrorDocument404Path = oldErrorDocument404Path;
    }

    public async prompt(context: IStaticWebsiteConfigWizardContext): Promise<void> {
        context.errorDocument404Path = await context.ui.showInputBox({
            prompt: localize('enterThe404ErrorDocumentPath', 'Enter the 404 error document path'),
            value: this.oldErrorDocument404Path || StaticWebsiteErrorDocument404Step.defaultErrorDocument404Path,
            validateInput: (value) => { return validateDocumentPath(value, DocumentType.error); }
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
