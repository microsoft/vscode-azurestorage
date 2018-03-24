/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { Launcher } from "../components/launcher/launcher";
import * as vscode from 'vscode';
import * as fs from "fs";
import { UserCancelledError } from "vscode-azureextensionui";
import { ResourceType } from "./ResourceType";

export class MacOSStorageExplorerLauncher implements IStorageExplorerLauncher {
    private static subExecutableLocation: string = "/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";
    public static downloadPageUrl: string = "https://go.microsoft.com/fwlink/?LinkId=723579";

    private static async getStorageExplorerExecutable(
        warningString: string = "Cannot find Storage Explorer. Browse to existing installation location or download and install Storage Explorer."): Promise<string> {

        let selectedLocation = vscode.workspace.getConfiguration('azureStorage').get<string>('storageExplorerLocation');

        if (!(await MacOSStorageExplorerLauncher.fileExists(selectedLocation + MacOSStorageExplorerLauncher.subExecutableLocation))) {
            let selected: "Browse" | "Download" = <"Browse" | "Download">await vscode.window.showWarningMessage(warningString, "Browse", "Download");

            if (selected === "Browse") {
                let userSelectedAppLocation = await MacOSStorageExplorerLauncher.showOpenDialog();
                await vscode.workspace.getConfiguration('azureStorage').update('storageExplorerLocation', userSelectedAppLocation, vscode.ConfigurationTarget.Global);
                return await MacOSStorageExplorerLauncher.getStorageExplorerExecutable("Selected app is not a valid Storage Explorer installation. Browse to existing installation location or download and install Storage Explorer.");
            } else if (selected === "Download") {
                await MacOSStorageExplorerLauncher.downloadStorageExplorer();
                throw new UserCancelledError();
            } else {
                throw new UserCancelledError();
            }
        }

        return selectedLocation + MacOSStorageExplorerLauncher.subExecutableLocation;
    }

    public async openResource(accountId: string, subscriptionid: string, resourceType: ResourceType, resourceName: string): Promise<void> {
        // tslint:disable-next-line:prefer-template
        let url = "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(accountId)
            + "&subscriptionid="
            + encodeURIComponent(subscriptionid)
            + "&source="
            + encodeURIComponent("VSCODE-AzureStorage");

        if (!!resourceType) {
            url = `${url}&resourcetype=${resourceType}`;
        }

        if (!!resourceName) {
            url = `${url}&resourcename=${resourceName}`;
        }

        await this.launchStorageExplorer([
            url
        ]);
    }

    private static async downloadStorageExplorer(): Promise<void> {
        await Launcher.launch("open", MacOSStorageExplorerLauncher.downloadPageUrl);
    }

    private async launchStorageExplorer(extraArgs: string[] = []): Promise<void> {
        let storageExplorerExecutable = await MacOSStorageExplorerLauncher.getStorageExplorerExecutable();

        return Launcher.launch("open", ...["-a", storageExplorerExecutable].concat(extraArgs));
    }

    private static async fileExists(path: string): Promise<boolean> {
        return await new Promise<boolean>((resolve, _reject) => {
            fs.exists(path, (exists: boolean) => {
                resolve(exists);
            });
        });
    }

    private static async showOpenDialog(): Promise<string> {
        const defaultUri: vscode.Uri | undefined = vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined;
        const options: vscode.OpenDialogOptions = {
            defaultUri: defaultUri,
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select',
            filters: {
                "Applications": ["app"]
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
