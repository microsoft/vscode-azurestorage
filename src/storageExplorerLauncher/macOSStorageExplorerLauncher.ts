/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, ChildProcess } from "child_process";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import * as vscode from 'vscode';
import * as fs from "fs";

export class UserCancelledError extends Error { }

export class MacOSStorageExplorerLauncher implements IStorageExplorerLauncher {
    private _childProcess: ChildProcess;
    private static defaultAppLocation = "/Applications/Microsoft\ Azure\ Storage\ Explorer.app";
    private static subExecutableLocation = "/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";
    public static downloadPageUrl = "https://go.microsoft.com/fwlink/?LinkId=723579";

    public static async getStorageExplorerExecutable(): Promise<string> {
        var appLocation = MacOSStorageExplorerLauncher.defaultAppLocation;
        
        if(!(await MacOSStorageExplorerLauncher.fileExists(appLocation))) {
            var selected: "Browse" | "Download" = <"Browse" | "Download"> await vscode.window.showWarningMessage("Could not find Storage Explorer. How would you like to resolve?", "Browse", "Download");
            if(selected === "Browse") {
                var selectedLocation = await MacOSStorageExplorerLauncher.showOpenDialog();
                if(await MacOSStorageExplorerLauncher.fileExists(selectedLocation + MacOSStorageExplorerLauncher.subExecutableLocation)) {
                    appLocation = selectedLocation;
                    // TODO set user config value with selected location.
                } else {
                    // TODO prompt user that they didn't choose a storage exporer.
                }
            } else if(selected === "Download") {
                appLocation = appLocation;
            } else {
                throw new UserCancelledError();
            }
        }

        return appLocation +  MacOSStorageExplorerLauncher.subExecutableLocation;
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
        
        
        if(this._childProcess) {
            spawn("open", [url]);
        } else {
            await this.launchStorageExplorer([
                url
            ]);

            spawn("open", [url]);
        }
    }

    private async launchStorageExplorer(args: string[] = []) {
        var storageExplorerExecutable = await MacOSStorageExplorerLauncher.getStorageExplorerExecutable();

        return await new Promise((resolve, _reject) => {
            var spawn_env = JSON.parse(JSON.stringify(process.env));
            // remove those env vars
            delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawn_env.ELECTRON_RUN_AS_NODE;

            this._childProcess = spawn(
                storageExplorerExecutable,
                args,
                {
                    env: spawn_env
                }
            );

            this._childProcess.stdout.on("data", (chunk) => {
                resolve("");
                console.log(`child process message:  ${chunk}`);
            });
    
            this._childProcess.stderr.on("data", (chunk) => {
                console.log(`child process message:  ${chunk}`);
            });
    
            this._childProcess.on("exit", (_code, _signal) => {
                this._childProcess = null;
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
            openLabel: 'select'
        };
        const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);

        if (!result || result.length === 0) {
            throw new UserCancelledError();
        } else {
            return result[0].fsPath;
        }
    }
}
