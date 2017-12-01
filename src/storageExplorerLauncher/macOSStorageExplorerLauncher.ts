/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from "child_process";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
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
        MacOSStorageExplorerLauncher.runOpenCommand(MacOSStorageExplorerLauncher.downloadPageUrl);
    }

    private async launchStorageExplorer(extraArgs: string[] = []) {
        var storageExplorerExecutable = await MacOSStorageExplorerLauncher.getStorageExplorerExecutable();
        return MacOSStorageExplorerLauncher.runOpenCommand(...["-a", storageExplorerExecutable].concat(extraArgs));
    }

    private static async runOpenCommand(...args: string[]): Promise<any> {
        return await new Promise((resolve, _reject) => {
            var spawn_env = JSON.parse(JSON.stringify(process.env));
            // remove those env vars
            delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawn_env.ELECTRON_RUN_AS_NODE;

            var childProcess = spawn(
                "open",
                args,
                {
                    env: spawn_env
                }
            );

            childProcess.stdout.on("data", (chunk) => {
                resolve("");
                console.log(`child process message:  ${chunk}`);
            });
    
            childProcess.stderr.on("data", (chunk) => {
                console.log(`child process message:  ${chunk}`);
            });
        });
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
