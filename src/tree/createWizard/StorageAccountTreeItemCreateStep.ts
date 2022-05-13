/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageAccountWizardContext } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardExecuteStep, ExecuteActivityContext, ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { AppResource } from "@microsoft/vscode-azext-utils/hostapi";
import { createStorageClient } from "../../utils/azureClients";
import { nonNullProp } from '../../utils/nonNull';
import { StorageAccountWrapper } from "../../utils/storageWrappers";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";

export interface IStorageAccountTreeItemCreateContext extends IStorageAccountWizardContext, ExecuteActivityContext {
    accountTreeItem: StorageAccountTreeItem;
}

export class StorageAccountTreeItemCreateStep extends AzureWizardExecuteStep<IStorageAccountTreeItemCreateContext> {
    public priority: number = 170;
    public subscription: ISubscriptionContext;

    public constructor(subscription: ISubscriptionContext) {
        super();
        this.subscription = subscription;
    }

    public async execute(wizardContext: IStorageAccountTreeItemCreateContext): Promise<void> {
        const storageManagementClient = await createStorageClient(wizardContext);
        wizardContext.accountTreeItem = await StorageAccountTreeItem.createStorageAccountTreeItem(this.subscription, new StorageAccountWrapper(nonNullProp(wizardContext, 'storageAccount')), storageManagementClient);

        const appResource: AppResource = {
            id: wizardContext.accountTreeItem.storageAccount.id,
            name: wizardContext.accountTreeItem.storageAccount.name,
            type: wizardContext.accountTreeItem.storageAccount.type,
        };
        wizardContext.activityResult = appResource;
    }

    public shouldExecute(): boolean {
        return true;
    }
}
