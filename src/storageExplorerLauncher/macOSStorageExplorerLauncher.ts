/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { Launcher } from "../utils/launcher";
import { localize } from "../utils/localize";
import { getSingleRootWorkspace } from "../utils/workspaceUtils";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { ResourceType } from "./ResourceType";

const warningStringDefault: string = localize('cantFindSE', 'Cannot find Storage Explorer. Browse to existing installation location or download and install Storage Explorer.');

export class MacOSStorageExplorerLauncher implements IStorageExplorerLauncher {
    private static subExecutableLocation: string = "/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";
    public static downloadPageUrl: string = "https://go.microsoft.com/fwlink/?LinkId=723579";

    private static async getStorageExplorerExecutable(context: IActionContext, warningString: string = warningStringDefault): Promise<string> {
        let selectedLocation = vscode.workspace.getConfiguration('azureStorage').get<string>('storageExplorerLocation');
        // tslint:disable-next-line:no-non-null-assertion // storageExplorerLocation has default value, can't be undefined
        let exePath = path.join(selectedLocation!, MacOSStorageExplorerLauncher.subExecutableLocation);
        if (!(await MacOSStorageExplorerLauncher.fileExists(exePath))) {
            context.telemetry.properties.storageExplorerNotFound = 'true';
            let selected: "Browse" | "Download" = <"Browse" | "Download">await vscode.window.showWarningMessage(warningString, "Browse", "Download");

            if (selected === "Browse") {
                let userSelectedAppLocation = await MacOSStorageExplorerLauncher.showOpenDialog();
                await vscode.workspace.getConfiguration('azureStorage').update('storageExplorerLocation', userSelectedAppLocation, vscode.ConfigurationTarget.Global);
                warningString = localize('selectedAppNotValid', 'Selected app is not a valid Storage Explorer installation. Browse to existing installation location or download and install Storage Explorer.');
                return await MacOSStorageExplorerLauncher.getStorageExplorerExecutable(context, warningString);
            } else if (selected === "Download") {
                context.telemetry.properties.downloadStorageExplorer = 'true';
                await MacOSStorageExplorerLauncher.downloadStorageExplorer();
                throw new UserCancelledError();
            } else {
                throw new UserCancelledError();
            }
        }

        return exePath;
    }

    public async openResource(context: IActionContext, accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void> {
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

        await this.launchStorageExplorer(context, [url]);
    }

    private static async downloadStorageExplorer(): Promise<void> {
        await Launcher.launch("open", MacOSStorageExplorerLauncher.downloadPageUrl);
    }

    private async launchStorageExplorer(context: IActionContext, extraArgs: string[] = []): Promise<void> {
        let storageExplorerExecutable = await MacOSStorageExplorerLauncher.getStorageExplorerExecutable(context);

        return Launcher.launch("open", ...["-a", storageExplorerExecutable].concat(extraArgs));
    }

    private static async fileExists(filePath: string): Promise<boolean> {
        return await new Promise<boolean>((resolve, _reject) => {
            fs.exists(filePath, (exists: boolean) => {
                resolve(exists);
            });
        });
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
