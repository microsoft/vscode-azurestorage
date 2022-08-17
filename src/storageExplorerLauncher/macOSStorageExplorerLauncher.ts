/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, callWithTelemetryAndErrorHandling, UserCancelledError } from "@microsoft/vscode-azext-utils";
import * as path from 'path';
import * as vscode from 'vscode';
import { storageExplorerDownloadUrl } from "../constants";
import { Launcher } from "../utils/launcher";
import { openUrl } from "../utils/openUrl";
import { getSingleRootWorkspace } from "../utils/workspaceUtils";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { ResourceType } from "./ResourceType";

export class MacOSStorageExplorerLauncher implements IStorageExplorerLauncher {
    private static subExecutableLocation: string = "/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";

    private static async getStorageExplorerExecutable(
        warningString: string = "Cannot find Storage Explorer. Browse to existing installation location or download and install Storage Explorer."): Promise<string> {

        return await callWithTelemetryAndErrorHandling('getStorageExplorerExecutableMac', async context => {
            const selectedLocation = vscode.workspace.getConfiguration('azureStorage').get<string>('storageExplorerLocation');
            // storageExplorerLocation has default value, can't be undefined
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const exePath = path.join(selectedLocation!, MacOSStorageExplorerLauncher.subExecutableLocation);
            if (!(await AzExtFsExtra.pathExists(exePath))) {
                context.telemetry.properties.storageExplorerNotFound = 'true';
                const selected: "Browse" | "Download" = <"Browse" | "Download">await vscode.window.showWarningMessage(warningString, "Browse", "Download");

                if (selected === "Browse") {
                    const userSelectedAppLocation = await MacOSStorageExplorerLauncher.showOpenDialog();
                    await vscode.workspace.getConfiguration('azureStorage').update('storageExplorerLocation', userSelectedAppLocation, vscode.ConfigurationTarget.Global);
                    return await MacOSStorageExplorerLauncher.getStorageExplorerExecutable("Selected app is not a valid Storage Explorer installation. Browse to existing installation location or download and install Storage Explorer.");
                } else {
                    if (selected === "Download") {
                        context.telemetry.properties.downloadStorageExplorer = 'true';
                        await openUrl(storageExplorerDownloadUrl);
                    }

                    throw new UserCancelledError();
                }
            }

            return exePath;
        }) || '';
    }

    public async openResource(accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void> {
        let url = "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(accountId)
            + "&subscriptionid="
            + encodeURIComponent(subscriptionid)
            + "&source="
            + encodeURIComponent("VSCODE-AzureStorage");

        if (resourceType) {
            url = `${url}&resourcetype=${resourceType}`;
        }

        if (resourceName) {
            url = `${url}&resourcename=${resourceName}`;
        }

        await this.launchStorageExplorer([
            url
        ]);
    }

    private async launchStorageExplorer(extraArgs: string[] = []): Promise<void> {
        const storageExplorerExecutable: string = await MacOSStorageExplorerLauncher.getStorageExplorerExecutable();
        if (!storageExplorerExecutable) {
            throw new UserCancelledError();
        }
        return Launcher.launch("open", ...["-a", storageExplorerExecutable].concat(extraArgs));
    }

    private static async showOpenDialog(): Promise<string> {
        const defaultWorkspace: vscode.WorkspaceFolder | undefined = getSingleRootWorkspace();
        const defaultUri: vscode.Uri | undefined = defaultWorkspace ? defaultWorkspace.uri : undefined;
        const options: vscode.OpenDialogOptions = {
            defaultUri: defaultUri,
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select',
            filters: {
                Applications: ["app"]
            }
        };
        const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);

        if (!result || result.length === 0) {
            throw new UserCancelledError();
        } else {
            return result[0].fsPath;
        }
    }
}
