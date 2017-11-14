/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, ChildProcess } from "child_process";
import * as os from "os";
import * as regedit from "regedit";

export class StorageExplorerLauncher {
    private static _regKey = "HKCR\\storageexplorer\\shell\\open\\command";
    private static _childProcess: ChildProcess;
    public static async openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string) {
        await StorageExplorerLauncher.launchStorageExplorer([
            "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(resourceId)
            + "&subscriptionid="
            + encodeURIComponent(subscriptionid)
            + "&resourcetype="
            + resourceType
            + "&resourcename="
            + resourceName
        ]);
    }

    private static async getStorageExplorerExecutable(): Promise<string> {
        if (os.platform() === "win32") {
            return StorageExplorerLauncher.getWindowsRegistryValue(StorageExplorerLauncher._regKey).then((value) => {
                console.log(value);
                return value;
            });

        } else if (os.platform() === "darwin") {
            return "/Applications/Microsoft\ Azure\ Storage\ Explorer.app/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer";
        } else {
            return "";
        }
    }

    private static getWindowsRegistryValue(key: string): Promise<string> {
        return new Promise((resolve, reject) => {
            regedit.list([key])
            .on('data', (entry) => {
                var value = <string>entry.data.values[""].value.split("\"")[1];                
                resolve(value);
            })
            .on('error', (err) => {
                reject(err);
            });
        });
    }

    private static async launchStorageExplorer(args: string[] = []) {
            var storageExplorerExecutable = await StorageExplorerLauncher.getStorageExplorerExecutable();

            var spawn_env = JSON.parse(JSON.stringify(process.env));
            // remove those env vars
            delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawn_env.ELECTRON_RUN_AS_NODE;

            StorageExplorerLauncher._childProcess = spawn(
                storageExplorerExecutable,
                args,
                {
                    env: spawn_env
                }
            );

            StorageExplorerLauncher._childProcess.stdout.on("data", (chunk) => {
                console.log(`child process message:  ${chunk}`);
            });
    
            StorageExplorerLauncher._childProcess.stderr.on("data", (chunk) => {
                console.log(`child process message:  ${chunk}`);
            });
    
            StorageExplorerLauncher._childProcess.on("exit", (code, signal) => {
                console.log('child process exited with ' +
                `code ${code} and signal ${signal}`);
            });
    }

}
