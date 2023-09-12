/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, IActionContext, registerCommandWithTreeNodeUnwrapping } from "@microsoft/vscode-azext-utils";
import { commands } from "vscode";
import { azuriteExtensionId, emulatorTimeoutMS, storageFilter } from "../constants";
import { ext } from "../extensionVariables";
import { ICopyUrl } from "../tree/ICopyUrl";
import { IStorageTreeItem } from "../tree/IStorageTreeItem";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { refreshTreeItem } from "../tree/refreshTreeItem";
import { registerBlobContainerActionHandlers } from "./blob/blobContainerActionHandlers";
import { registerBlobContainerGroupActionHandlers } from "./blob/blobContainerGroupActionHandlers";
import { createStorageAccount, createStorageAccountAdvanced } from "./createStorageAccount";
import { detachStorageAccount } from "./detachStorageAccount";
import { downloadSasUrl, downloadTreeItems } from "./downloadFile";
import { registerDirectoryActionHandlers } from "./fileShare/directoryActionHandlers";
import { registerFileActionHandlers } from "./fileShare/fileActionHandlers";
import { registerFileShareActionHandlers } from "./fileShare/fileShareActionHandlers";
import { registerFileShareGroupActionHandlers } from "./fileShare/fileShareGroupActionHandlers";
import { generateSasUrl } from "./generateSasUrl";
import { IOpenInFileExplorerWizardContext } from "./openInFileExplorer/IOpenInFileExplorerWizardContext";
import { OpenBehaviorStep } from "./openInFileExplorer/OpenBehaviorStep";
import { OpenTreeItemStep } from "./openInFileExplorer/OpenTreeItemStep";
import { registerQueueActionHandlers } from "./queue/queueActionHandlers";
import { registerQueueGroupActionHandlers } from "./queue/queueGroupActionHandlers";
import { selectStorageAccountTreeItemForCommand } from "./selectStorageAccountNodeForCommand";
import { EmulatorType, startEmulator } from "./startEmulator";
import { registerStorageAccountActionHandlers } from "./storageAccountActionHandlers";
import { registerTableActionHandlers } from "./table/tableActionHandlers";
import { registerTableGroupActionHandlers } from "./table/tableGroupActionHandlers";
import { uploadFiles } from "./uploadFiles/uploadFiles";
import { uploadFolder } from "./uploadFolder/uploadFolder";
import { uploadToAzureStorage } from "./uploadToAzureStorage";

export function registerCommands(): void {
    registerBlobContainerActionHandlers();
    registerBlobContainerGroupActionHandlers();
    registerFileActionHandlers();
    registerDirectoryActionHandlers();
    registerFileShareActionHandlers();
    registerFileShareGroupActionHandlers();
    registerQueueActionHandlers();
    registerQueueGroupActionHandlers();
    registerStorageAccountActionHandlers();
    registerTableActionHandlers();
    registerTableGroupActionHandlers();

    registerCommandWithTreeNodeUnwrapping('azureStorage.refresh', async (actionContext: IActionContext, treeItem?: AzExtTreeItem & IStorageTreeItem) => { await refreshTreeItem(actionContext, treeItem) })
    registerCommandWithTreeNodeUnwrapping('azureStorage.showOutputChannel', () => { ext.outputChannel.show(); });
    registerCommandWithTreeNodeUnwrapping('azureStorage.openInFileExplorer', async (actionContext: IActionContext, treeItem?: BlobContainerTreeItem | FileShareTreeItem) => {
        if (!treeItem) {
            treeItem = await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(actionContext, {
                filter: storageFilter,
                expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
            });
        }

        const wizardContext: IOpenInFileExplorerWizardContext = Object.assign(actionContext, { treeItem });
        if (treeItem.root.isEmulated) {
            wizardContext.openBehavior = 'OpenInNewWindow';
        }
        const wizard: AzureWizard<IOpenInFileExplorerWizardContext> = new AzureWizard(wizardContext, {
            promptSteps: [new OpenBehaviorStep()],
            executeSteps: [new OpenTreeItemStep()]
        });
        await wizard.prompt();
        await wizard.execute();
    });
    registerCommandWithTreeNodeUnwrapping('azureStorage.copyUrl', (_actionContext: IActionContext, treeItem: AzExtTreeItem & ICopyUrl) => treeItem.copyUrl());
    registerCommandWithTreeNodeUnwrapping("azureStorage.configureStaticWebsite", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
        const accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            actionContext,
            {
                mustBeWebsiteCapable: true,
                configureWebsite: false
            });
        await accountTreeItem.configureStaticWebsite(actionContext);
    });
    registerCommandWithTreeNodeUnwrapping("azureStorage.disableStaticWebsite", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
        const accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            actionContext,
            {
                mustBeWebsiteCapable: false,
                configureWebsite: false
            });
        await accountTreeItem.disableStaticWebsite(actionContext);
    });
    registerCommandWithTreeNodeUnwrapping("azureStorage.createGpv2Account", createStorageAccount);
    registerCommandWithTreeNodeUnwrapping("azureStorage.createGpv2AccountAdvanced", createStorageAccountAdvanced);
    registerCommandWithTreeNodeUnwrapping('azureStorage.browseStaticWebsite', async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
        const accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            actionContext,
            {
                mustBeWebsiteCapable: true,
                configureWebsite: false
            });
        await accountTreeItem.browseStaticWebsite(actionContext);
    });

    registerCommandWithTreeNodeUnwrapping("azureStorage.uploadFiles", uploadFiles);
    registerCommandWithTreeNodeUnwrapping("azureStorage.uploadFolder", uploadFolder);
    registerCommandWithTreeNodeUnwrapping("azureStorage.uploadToAzureStorage", uploadToAzureStorage);
    registerCommandWithTreeNodeUnwrapping('azureStorage.downloadTreeItems', downloadTreeItems);
    registerCommandWithTreeNodeUnwrapping('azureStorage.downloadSasUrl', downloadSasUrl);
    registerCommandWithTreeNodeUnwrapping('azureStorage.generateSasUrl', generateSasUrl);
    registerCommandWithTreeNodeUnwrapping("azureStorage.attachStorageAccount", async (actionContext: IActionContext) => {
        await ext.attachedStorageAccountsTreeItem.attachWithConnectionString(actionContext);
    });
    registerCommandWithTreeNodeUnwrapping('azureStorage.detachStorageAccount', detachStorageAccount);
    registerCommandWithTreeNodeUnwrapping('azureStorage.startBlobEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.blob); }, emulatorTimeoutMS);
    registerCommandWithTreeNodeUnwrapping('azureStorage.startQueueEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.queue); }, emulatorTimeoutMS);
    registerCommandWithTreeNodeUnwrapping('azureStorage.startTableEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.table); }, emulatorTimeoutMS);
    registerCommandWithTreeNodeUnwrapping('azureStorage.showAzuriteExtension', async () => { await commands.executeCommand('extension.open', azuriteExtensionId); });
}
