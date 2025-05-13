/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { AzExtTreeItem, AzureWizardExecuteStepWithActivityOutput } from "@microsoft/vscode-azext-utils";
import { NotificationProgress } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../utils/localize';
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";
import { IStorageAccountTreeItemCreateContext } from "./StorageAccountTreeItemCreateStep";

export class StaticWebsiteConfigureStep<T extends IStorageAccountTreeItemCreateContext & IStaticWebsiteConfigWizardContext> extends AzureWizardExecuteStepWithActivityOutput<T> {
    public priority: number = 200;
    public stepName: string = 'staticWebsiteConfigureStep';
    public accountTreeItem: StorageAccountTreeItem | undefined;

    private outputLogMessage: string;
    private previouslyEnabled: boolean | undefined;

    protected getOutputLogSuccess = (): string => this.outputLogMessage;
    protected getOutputLogFail = (): string => this.outputLogMessage;
    protected getTreeItemLabel(context: T): string {
        this.accountTreeItem ??= context.accountTreeItem;

        return this.previouslyEnabled ?
            localize('updateStaticHostingConfig', 'Update static website hosting config for storage account "{0}"', this.accountTreeItem.label) :
            localize('enableStaticHostingConfig', 'Enable static website hosting for storage account "{0}"', this.accountTreeItem.label);
    }

    public constructor(accountTreeItem?: StorageAccountTreeItem, previouslyEnabled?: boolean) {
        super();
        this.accountTreeItem = accountTreeItem;
        this.previouslyEnabled = previouslyEnabled;
    }

    public async execute(wizardContext: T, progress: NotificationProgress): Promise<void> {
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

        this.outputLogMessage = this.previouslyEnabled ?
            localize('staticWebsiteHostingConfigurationUpdated', 'Static website hosting configuration updated for storage account "{0}".', this.accountTreeItem.label) :
            localize('storageAccountHasBeenEnabledForStaticWebsiteHosting', 'The storage account "{0}" has been enabled for static website hosting.', this.accountTreeItem.label);
        this.outputLogMessage += localize('indexDocumentAndErrorDocument', ' Index document: "{0}", 404 error document: "{1}"', wizardContext.indexDocument, wizardContext.errorDocument404Path);

        if (newStatus.staticWebsite && this.previouslyEnabled !== newStatus.staticWebsite.enabled) {
            await ext.rgApi.appResourceTree.refresh(wizardContext, this.accountTreeItem as unknown as AzExtTreeItem);
        }
    }

    public shouldExecute(wizardContext: T): boolean {
        return wizardContext.enableStaticWebsite;
    }
}
