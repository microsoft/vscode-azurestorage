/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { configurationSettingsKeys, extensionPrefix } from '../constants';
import { ext } from '../extensionVariables';
import { storageExplorerLauncher } from '../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { StorageAccountTreeItem } from '../tree/StorageAccountTreeItem';
import { isPathEqual, isSubpath } from '../utils/fs';
import { localize } from "../utils/localize";
import { showWorkspaceFoldersQuickPick } from "../utils/quickPickUtils";
import { deleteNode } from './commonTreeCommands';
import { selectStorageAccountTreeItemForCommand } from './selectStorageAccountNodeForCommand';

export function registerStorageAccountActionHandlers(): void {
    registerCommand("azureStorage.openStorageAccount", openStorageAccountInStorageExplorer);
    registerCommand("azureStorage.copyPrimaryKey", copyPrimaryKey);
    registerCommand("azureStorage.copyConnectionString", copyConnectionString);
    registerCommand("azureStorage.deployStaticWebsite", deployStaticWebsite);
    registerCommand("azureStorage.deleteStorageAccount", deleteStorageAccount);
}

async function openStorageAccountInStorageExplorer(context: IActionContext, treeItem?: StorageAccountTreeItem): Promise<void> {
    if (!treeItem) {
        treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue, context);
    }

    const accountId = treeItem.storageAccount.id;

    await storageExplorerLauncher.openResource(accountId, treeItem.subscription.subscriptionId);
}

export async function copyPrimaryKey(context: IActionContext, treeItem?: StorageAccountTreeItem): Promise<void> {
    if (!treeItem) {
        treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue, context);
    }

    await vscode.env.clipboard.writeText(treeItem.key.value);
}

export async function copyConnectionString(context: IActionContext, treeItem?: StorageAccountTreeItem): Promise<void> {
    if (!treeItem) {
        treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue, context);
    }

    const connectionString = treeItem.getConnectionString();
    await vscode.env.clipboard.writeText(connectionString);
}

export async function deployStaticWebsite(context: IActionContext, target?: vscode.Uri | StorageAccountTreeItem | BlobContainerTreeItem): Promise<void> {
    let sourcePath: string | undefined;
    let destTreeItem: StorageAccountTreeItem | BlobContainerTreeItem | undefined;

    // Disambiguate context this was executed from
    if (target instanceof vscode.Uri) {
        // Command called from file view
        if (target.scheme === 'azurestorage') {
            context.telemetry.properties.contextValue = 'BlobContainer/FileShare';
            throw new Error('Deploying an Azure resource from the Explorer is not supported.');
        }

        sourcePath = target.fsPath;
        context.telemetry.properties.contextValue = 'Folder';
    } else {
        // Command called from command palette or from storage account/container treeItem
        destTreeItem = <StorageAccountTreeItem | BlobContainerTreeItem>target;
        context.telemetry.properties.contextValue = (destTreeItem && destTreeItem.contextValue) || 'CommandPalette';
    }

    //  Ask for source folder if needed
    if (!sourcePath) {
        sourcePath = await showWorkspaceFoldersQuickPick(localize('selectFolderToDeploy', 'Select the folder to deploy'), context, configurationSettingsKeys.deployPath);
    }

    // Ask for destination account
    const destAccountTreeItem: StorageAccountTreeItem = await selectStorageAccountTreeItemForCommand(
        destTreeItem,
        context,
        {
            mustBeWebsiteCapable: true,
            configureWebsite: true
        });

    // Get the $web container
    const destContainerTreeItem = await destAccountTreeItem.getWebsiteCapableContainer(context);
    if (!destContainerTreeItem) {
        throw new Error(`Could not find $web blob container for storage account "${destAccountTreeItem.label}"`);
    }

    await runPreDeployTask(sourcePath, context);

    return destContainerTreeItem.deployStaticWebsite(context, sourcePath);
}

async function runPreDeployTask(deployFsPath: string, context: IActionContext): Promise<void> {
    const taskName: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, vscode.Uri.file(deployFsPath)).get(configurationSettingsKeys.preDeployTask);
    context.telemetry.properties.hasPreDeployTask = String(!!taskName);
    if (taskName) {
        const tasks: vscode.Task[] = await vscode.tasks.fetchTasks();
        const preDeployTask: vscode.Task | undefined = tasks.find((task: vscode.Task) => isTaskEqual(taskName, deployFsPath, task));
        if (preDeployTask) {
            await vscode.tasks.executeTask(preDeployTask);
            await new Promise((resolve: (value?: unknown) => void, reject: (error: Error) => void): void => {
                const listener: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((e: vscode.TaskProcessEndEvent) => {
                    if (e.execution.task === preDeployTask) {
                        listener.dispose();
                        if (e.exitCode === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Pre-deploy task "${e.execution.task.name}" failed with exit code "${e.exitCode}".`));
                        }
                    }
                });
            });
        } else {
            throw new Error(`Failed to find pre-deploy task "${taskName}". Modify your tasks or the setting "${extensionPrefix}.${configurationSettingsKeys.preDeployTask}".`);
        }
    }
}

function isTaskEqual(expectedName: string, expectedPath: string, actualTask: vscode.Task): boolean {
    if (actualTask.name && actualTask.name.toLowerCase() === expectedName.toLowerCase() && actualTask.scope !== undefined) {
        const workspaceFolder = <Partial<vscode.WorkspaceFolder>>actualTask.scope;
        return !!workspaceFolder.uri && (isPathEqual(workspaceFolder.uri.fsPath, expectedPath) || isSubpath(workspaceFolder.uri.fsPath, expectedPath));
    } else {
        return false;
    }
}

export async function deleteStorageAccount(context: IActionContext, treeItem?: StorageAccountTreeItem): Promise<void> {
    await deleteNode(context, StorageAccountTreeItem.contextValue, treeItem);
}
