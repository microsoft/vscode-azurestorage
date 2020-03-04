/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import { Progress, window } from "vscode";
import { AzureWizardExecuteStep } from "vscode-azureextensionui";
import { ext } from '../../extensionVariables';
import { localize } from '../../utils/localize';
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";
import { IStorageAccountTreeItemCreateContext } from "./storageAccountTreeItemCreateStep";

export class StaticWebsiteConfigureStep extends AzureWizardExecuteStep<IStorageAccountTreeItemCreateContext & IStaticWebsiteConfigWizardContext> {
    public priority: number = 200;

    public constructor(public accountTreeItem?: StorageAccountTreeItem, private previouslyEnabled?: boolean) {
        super();
    }

    public async execute(wizardContext: IStorageAccountTreeItemCreateContext & IStaticWebsiteConfigWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        // tslint:disable-next-line: strict-boolean-expressions
        this.accountTreeItem = this.accountTreeItem || wizardContext.accountTreeItem;

        progress.report({ message: localize('configuringStaticWebsiteHosting', `Configuring static website hosing for storage account "${this.accountTreeItem.label}"...`) });

        const newStatus: azureStorageBlob.BlobServiceProperties = {
            staticWebsite: {
                enabled: true,
                indexDocument: wizardContext.indexDocument,
                errorDocument404Path: wizardContext.errorDocument404Path
            }
        };

        await this.accountTreeItem.setWebsiteHostingProperties(newStatus);

        let msg = this.previouslyEnabled ?
            localize('staticWebsiteHostingConfigurationUpdated', 'Static website hosting configuration updated.') :
            localize('storageAccountHasBeenEnabledForStaticWebsiteHosting', `The storage account "${this.accountTreeItem.label}" has been enabled for static website hosting.`);
        // tslint:disable-next-line: strict-boolean-expressions
        msg += localize('indexDocumentAndErrorDocument', ` Index document: "${wizardContext.indexDocument}", 404 error document: "${wizardContext.errorDocument404Path}"`);
        window.showInformationMessage(msg);

        if (newStatus.staticWebsite && this.previouslyEnabled !== newStatus.staticWebsite.enabled) {
            await ext.tree.refresh(this.accountTreeItem);
        }
    }

    public shouldExecute(wizardContext: IStaticWebsiteConfigWizardContext): boolean {
        return wizardContext.enableStaticWebsite;
    }
}
