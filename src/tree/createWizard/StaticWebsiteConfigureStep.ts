/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { AzExtTreeItem, AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { window } from "vscode";
import { NotificationProgress } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../utils/localize';
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";
import { IStorageAccountTreeItemCreateContext } from "./StorageAccountTreeItemCreateStep";

export class StaticWebsiteConfigureStep extends AzureWizardExecuteStep<IStorageAccountTreeItemCreateContext & IStaticWebsiteConfigWizardContext> {
    public priority: number = 200;
    public accountTreeItem: StorageAccountTreeItem | undefined;
    private previouslyEnabled: boolean | undefined;

    public constructor(accountTreeItem?: StorageAccountTreeItem, previouslyEnabled?: boolean) {
        super();
        this.accountTreeItem = accountTreeItem;
        this.previouslyEnabled = previouslyEnabled;
    }

    public async execute(wizardContext: IStorageAccountTreeItemCreateContext & IStaticWebsiteConfigWizardContext, progress: NotificationProgress): Promise<void> {
        this.accountTreeItem = this.accountTreeItem || wizardContext.accountTreeItem;

        progress.report({ message: localize('configuringStaticWebsiteHosting', `Configuring static website hosing for storage account "${this.accountTreeItem.label}"...`) });

        const newStatus: BlobServiceProperties = {
            staticWebsite: {
                enabled: true,
                indexDocument: wizardContext.indexDocument,
                errorDocument404Path: wizardContext.errorDocument404Path
            }
        };

        await this.accountTreeItem.setWebsiteHostingProperties(newStatus);

        let msg = this.previouslyEnabled ?
            localize('staticWebsiteHostingConfigurationUpdated', 'Static website hosting configuration updated for storage account "{0}".', this.accountTreeItem.label) :
            localize('storageAccountHasBeenEnabledForStaticWebsiteHosting', 'The storage account "{0}" has been enabled for static website hosting.', this.accountTreeItem.label);
        msg += localize('indexDocumentAndErrorDocument', ' Index document: "{0}", 404 error document: "{1}"', wizardContext.indexDocument, wizardContext.errorDocument404Path);
        void window.showInformationMessage(msg);

        if (newStatus.staticWebsite && this.previouslyEnabled !== newStatus.staticWebsite.enabled) {
            await ext.rgApi.appResourceTree.refresh(wizardContext, this.accountTreeItem as unknown as AzExtTreeItem);
        }
    }

    public shouldExecute(wizardContext: IStaticWebsiteConfigWizardContext): boolean {
        return wizardContext.enableStaticWebsite;
    }
}
