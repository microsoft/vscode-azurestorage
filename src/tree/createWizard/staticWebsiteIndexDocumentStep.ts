/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { localize } from "../../utils/localize";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";

export class StaticWebsiteIndexDocumentStep extends AzureWizardPromptStep<IStaticWebsiteConfigWizardContext> {
    static readonly defaultIndexDocument: string = 'index.html';

    public constructor(private oldIndexDocument?: string) {
        super();
    }

    public async prompt(wizardContext: IStaticWebsiteConfigWizardContext): Promise<void> {
        wizardContext.indexDocument = await ext.ui.showInputBox({
            prompt: localize('enterTheIndexDocumentName', 'Enter the index document name'),
            value: this.oldIndexDocument || StaticWebsiteIndexDocumentStep.defaultIndexDocument,
            validateInput: this.validateIndexDocumentName
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }

    private validateIndexDocumentName(documentPath: string): undefined | string {
        const minLengthDocumentPath = 3;
        const maxLengthDocumentPath = 255;
        if (documentPath.includes('/')) {
            return localize('indexDocumentPathCannotContainForwardSlash', 'The index document path cannot contain a "/" character.');
        } else if (documentPath.length < minLengthDocumentPath || documentPath.length > maxLengthDocumentPath) {
            return localize('indexDocumentPathLengthIsInvalid', `The index document path must be between ${minLengthDocumentPath} and ${maxLengthDocumentPath} characters in length.`);
        }

        return undefined;
    }
}
