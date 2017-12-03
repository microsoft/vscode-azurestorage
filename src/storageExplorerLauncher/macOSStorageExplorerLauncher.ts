/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import {Launcher} from "../components/launcher/launcher";
import * as vscode from 'vscode';
import * as fs from "fs";

export class UserCancelledError extends Error { }

export class MacOSStorageExplorerLauncher implements IStorageExplorerLauncher {
    private static defaultAppLocation = "/Applications/Microsoft\ Azure\ Storage\ Explorer.app";
    private static selectedAppLocation = MacOSStorageExplorerLauncher.defaultAppLocation;
    private static subExecutableLocation = "/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";
    public static downloadPageUrl = "https://go.microsoft.com/fwlink/?LinkId=723579";

    private static async getStorageExplorerExecutable(
        warningString: string = "Could not find Storage Explorer. How would you like to resolve?",
        selectedLocation: string  = MacOSStorageExplorerLauncher.selectedAppLocation): Promise<string> {
        if(!(await MacOSStorageExplorerLauncher.fileExists(selectedLocation + MacOSStorageExplorerLauncher.subExecutableLocation))) {
            var selected: "Browse" | "Download" = <"Browse" | "Download"> await vscode.window.showWarningMessage(warningString, "Browse", "Download");
            
            if(selected === "Browse") {
                MacOSStorageExplorerLauncher.selectedAppLocation = await MacOSStorageExplorerLauncher.showOpenDialog();
                return await MacOSStorageExplorerLauncher.getStorageExplorerExecutable("Selected Location is not a valid Storage Explorer. How would you like to resolve?");
            } else if(selected === "Download") {
                await MacOSStorageExplorerLauncher.downloadStorageExplorer();
                throw new UserCancelledError();
            } else {
                throw new UserCancelledError();
            }
        }

        return selectedLocation + MacOSStorageExplorerLauncher.subExecutableLocation;
    }

    public async openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string) {
        var url = "storageexplorer://v=1"
        + "&accountid="
        + encodeURIComponent(resourceId)
        + "&subscriptionid="
        + encodeURIComponent(subscriptionid);

        if(!!resourceType) {
            url = url + "&resourcetype="
            + resourceType
        }

        if(!!resourceName) {
            url = url + "&resourcename="
            + resourceName;
        }  
        
        await this.launchStorageExplorer([
            url
        ]);
    }

    private static async downloadStorageExplorer() {
        await Launcher.launch("open", MacOSStorageExplorerLauncher.downloadPageUrl);
    }

    private async launchStorageExplorer(extraArgs: string[] = []) {
        var storageExplorerExecutable = await MacOSStorageExplorerLauncher.getStorageExplorerExecutable();
        
        return Launcher.launch("open", ...["-a", storageExplorerExecutable, "--args"].concat(extraArgs));
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
            openLabel: 'Select Storage Explorer Application',
            filters:{
                "Applications":["app"]
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
