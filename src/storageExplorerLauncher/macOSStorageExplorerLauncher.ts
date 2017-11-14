/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, ChildProcess } from "child_process";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";

export class MacOSStorageExplorerLauncher implements IStorageExplorerLauncher {
    private _childProcess: ChildProcess;

    private static async getStorageExplorerExecutable(): Promise<string> {
        return "/Applications/Microsoft\ Azure\ Storage\ Explorer.app/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";
    }

    public async openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string) {
        var url = "storageexplorer://v=1"
        + "&accountid="
        + encodeURIComponent(resourceId)
        + "&subscriptionid="
        + encodeURIComponent(subscriptionid)
        + "&resourcetype="
        + resourceType
        + "&resourcename="
        + resourceName;
        
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

}
