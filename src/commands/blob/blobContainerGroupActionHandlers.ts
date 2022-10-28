/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import { IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { BlobContainerGroupItem } from '../../tree/blob/BlobContainerGroupItem';
import { listContainers } from '../../tree/blob/blobUtils';
import { isAzuriteInstalled, warnAzuriteNotInstalled } from '../../utils/azuriteUtils';
import { createBlobContainerClient } from '../../utils/blobUtils';
import { registerBranchCommand } from '../../utils/v2/commandUtils';

export function registerBlobContainerGroupActionHandlers(): void {
    registerBranchCommand("azureStorage.createBlobContainer", createBlobContainer);
}

function validateContainerName(name: string): string | undefined | null {
    const validLength = { min: 3, max: 63 };

    if (!name) {
        return "Container name cannot be empty";
    }
    if (name.indexOf(" ") >= 0) {
        return "Container name cannot contain spaces";
    }
    if (name.length < validLength.min || name.length > validLength.max) {
        return `Container name must contain between ${validLength.min} and ${validLength.max} characters`;
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
        return 'Container name can only contain lowercase letters, numbers and hyphens';
    }
    if (/--/.test(name)) {
        return 'Container name cannot contain two hyphens in a row';
    }
    if (/(^-)|(-$)/.test(name)) {
        return 'Container name cannot begin or end with a hyphen';
    }

    return undefined;
}

export async function createBlobContainer(context: IActionContext, treeItem?: BlobContainerGroupItem): Promise<void> {
    if (!treeItem) {
        throw new Error("This command must be called from a storage account.");
    }

    if (treeItem?.storageRoot.isEmulated && !(await isAzuriteInstalled())) {
        warnAzuriteNotInstalled(context);
    }

    const containerName = await context.ui.showInputBox({
        placeHolder: 'Enter a name for the new blob container',
        validateInput: validateContainerName
    });

    if (containerName) {
        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            progress.report({ message: `Azure Storage: Creating blob container '${containerName}'` });

            const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(treeItem?.storageRoot, containerName);
            await containerClient.create();

            const containersResponse: azureStorageBlob.ListContainersSegmentResponse = await listContainers(treeItem.storageRoot.createBlobServiceClient());
            let createdContainer: azureStorageBlob.ContainerItem | undefined;
            for (const container of containersResponse.containerItems) {
                if (container.name === containerName) {
                    createdContainer = container;
                    break;
                }
            }

            treeItem.notifyChanged();

            if (!createdContainer) {
                throw new Error(`Could not create container ${containerName}`);
            }
        });
    }

    throw new UserCancelledError();
}
