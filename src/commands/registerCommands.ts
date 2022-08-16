/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, IActionContext, registerCommand } from "@microsoft/vscode-azext-utils";
import { commands } from "vscode";
import { azuriteExtensionId, emulatorTimeoutMS, storageFilter } from "../constants";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { ICopyUrl } from "../tree/ICopyUrl";
import { IStorageTreeItem } from "../tree/IStorageTreeItem";
import { refreshTreeItem } from "../tree/refreshTreeItem";
import { registerBlobActionHandlers } from "./blob/blobActionHandlers";
import { registerBlobContainerActionHandlers } from "./blob/blobContainerActionHandlers";
import { registerBlobContainerGroupActionHandlers } from "./blob/blobContainerGroupActionHandlers";
import { createStorageAccount, createStorageAccountAdvanced } from "./createStorageAccount";
import { detachStorageAccount } from "./detachStorageAccount";
import { download } from "./downloadFile";
import { registerDirectoryActionHandlers } from "./fileShare/directoryActionHandlers";
import { registerFileActionHandlers } from "./fileShare/fileActionHandlers";
import { registerFileShareActionHandlers } from "./fileShare/fileShareActionHandlers";
import { registerFileShareGroupActionHandlers } from "./fileShare/fileShareGroupActionHandlers";
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

    registerBlobActionHandlers();
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

    registerCommand('azureStorage.refresh', async (actionContext: IActionContext, treeItem?: AzExtTreeItem & IStorageTreeItem) => { await refreshTreeItem(actionContext, treeItem) })
    registerCommand('azureStorage.showOutputChannel', () => { ext.outputChannel.show(); });
    registerCommand('azureStorage.openInFileExplorer', async (actionContext: IActionContext, treeItem?: BlobContainerTreeItem | FileShareTreeItem) => {
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
    registerCommand('azureStorage.copyUrl', (_actionContext: IActionContext, treeItem: AzExtTreeItem & ICopyUrl) => treeItem.copyUrl());
    registerCommand("azureStorage.configureStaticWebsite", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
        const accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            actionContext,
            {
                mustBeWebsiteCapable: true,
                configureWebsite: false
            });
        await accountTreeItem.configureStaticWebsite(actionContext);
    });
    registerCommand("azureStorage.disableStaticWebsite", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
        const accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            actionContext,
            {
                mustBeWebsiteCapable: false,
                configureWebsite: false
            });
        await accountTreeItem.disableStaticWebsite(actionContext);
    });
    registerCommand("azureStorage.createGpv2Account", createStorageAccount);
    registerCommand("azureStorage.createGpv2AccountAdvanced", createStorageAccountAdvanced);
    registerCommand('azureStorage.browseStaticWebsite', async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
        const accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            actionContext,
            {
                mustBeWebsiteCapable: true,
                configureWebsite: false
            });
        await accountTreeItem.browseStaticWebsite(actionContext);
    });

    registerCommand("azureStorage.uploadFiles", uploadFiles);
    registerCommand("azureStorage.uploadFolder", uploadFolder);
    registerCommand("azureStorage.uploadToAzureStorage", uploadToAzureStorage);
    registerCommand('azureStorage.download', download);
    registerCommand("azureStorage.attachStorageAccount", async (actionContext: IActionContext) => {
        await ext.attachedStorageAccountsTreeItem.attachWithConnectionString(actionContext);
    });
    registerCommand('azureStorage.detachStorageAccount', detachStorageAccount);
    registerCommand('azureStorage.startBlobEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.blob); }, emulatorTimeoutMS);
    registerCommand('azureStorage.startQueueEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.queue); }, emulatorTimeoutMS);
    registerCommand('azureStorage.startTableEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.table); }, emulatorTimeoutMS);
    registerCommand('azureStorage.showAzuriteExtension', async () => { await commands.executeCommand('extension.open', azuriteExtensionId); });
}
