/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient } from '@azure/arm-storage';
import { StorageManagementClient as StorageManagementClient1 } from '@azure/arm-storage1';
import { AzureWizardExecuteStep, createAzureClient, IStorageAccountWizardContext } from "vscode-azureextensionui";
import { ifStack } from '../../utils/environmentUtils';
import { nonNullProp } from '../../utils/nonNull';
import { StorageAccountWrapper } from "../../utils/storageWrappers";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { SubscriptionTreeItem } from "../SubscriptionTreeItem";

export interface IStorageAccountTreeItemCreateContext extends IStorageAccountWizardContext {
    accountTreeItem: StorageAccountTreeItem;
}

export class StorageAccountTreeItemCreateStep extends AzureWizardExecuteStep<IStorageAccountTreeItemCreateContext> {
    public priority: number = 170;
    public parent: SubscriptionTreeItem;

    public constructor(parent: SubscriptionTreeItem) {
        super();
        this.parent = parent;
    }

    public async execute(wizardContext: IStorageAccountTreeItemCreateContext): Promise<void> {
        let storageManagementClient: StorageManagementClient;
        let isAzureStack: boolean = ifStack();
        if (isAzureStack) {
            storageManagementClient = createAzureClient(this.parent.root, StorageManagementClient1);
        } else {
            storageManagementClient = createAzureClient(this.parent.root, StorageManagementClient);
        }
        wizardContext.accountTreeItem = await StorageAccountTreeItem.createStorageAccountTreeItem(this.parent, new StorageAccountWrapper(nonNullProp(wizardContext, 'storageAccount')), storageManagementClient);
    }

    public shouldExecute(): boolean {
        return true;
    }
}
