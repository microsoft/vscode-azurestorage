/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from "@microsoft/vscode-azext-utils";
import { localize } from "../../utils/localize";
import { DocumentType, validateDocumentPath } from "../../utils/validateNames";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";

export class StaticWebsiteIndexDocumentStep extends AzureWizardPromptStep<IStaticWebsiteConfigWizardContext> {
    static readonly defaultIndexDocument: string = 'index.html';
    private oldIndexDocument: string | undefined;

    public constructor(oldIndexDocument?: string) {
        super();
        this.oldIndexDocument = oldIndexDocument;
    }

    public async prompt(context: IStaticWebsiteConfigWizardContext): Promise<void> {
        context.indexDocument = await context.ui.showInputBox({
            prompt: localize('enterTheIndexDocumentName', 'Enter the index document name'),
            value: this.oldIndexDocument || StaticWebsiteIndexDocumentStep.defaultIndexDocument,
            validateInput: (value) => { return validateDocumentPath(value, DocumentType.index); }
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
