/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn, ChildProcess } from "child_process";

export class StorageExplorerLauncher {
    private static _childProcess: ChildProcess;
    public static openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string) {
        StorageExplorerLauncher.ensureStorageExplorerIsOpen();

        spawn(
            "open",
            [
                "storageexplorer://v=1"
                + "&accountid="
                + encodeURIComponent(resourceId)
                + "&subscriptionid="
                + encodeURIComponent(subscriptionid)
                + "&resourcetype="
                + resourceType
                + "&resourcename="
                + resourceName
            ]
        );
    }

    private static ensureStorageExplorerIsOpen() {
        if(!StorageExplorerLauncher._childProcess) {
            var spawn_env = JSON.parse(JSON.stringify(process.env));
            // remove those env vars
            delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawn_env.ELECTRON_RUN_AS_NODE;

            StorageExplorerLauncher._childProcess = spawn(
                "/Applications/Microsoft\ Azure\ Storage\ Explorer.app/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer",
                [],
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

}
