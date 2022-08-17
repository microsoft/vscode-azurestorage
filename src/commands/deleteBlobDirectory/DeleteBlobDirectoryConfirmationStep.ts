import { AzureWizardPromptStep, DialogResponses, nonNullProp } from "@microsoft/vscode-azext-utils";
import { localize } from "../../utils/localize";
import { IDeleteBlobDirectoryWizardContext } from "./IDeleteBlobDirectoryWizardContext";

export class DeleteBlobDirectoryConfirmationStep extends AzureWizardPromptStep<IDeleteBlobDirectoryWizardContext> {
    public async prompt(wizardContext: IDeleteBlobDirectoryWizardContext): Promise<void> {
        const directoryName = nonNullProp(wizardContext, 'dirName');
        if (!wizardContext.suppress) {
            const message: string = localize('deleteBlobDir', "Are you sure you want to delete the blob directory '{0}' and all its contents?", directoryName);
            await wizardContext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        }
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
