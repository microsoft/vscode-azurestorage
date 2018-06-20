/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { spawn } from "child_process";
export class Launcher {
    // tslint:disable:no-stateless-class // Grandfathered in
    public static async launch(command: string, ...args: string[]): Promise<void> {
        await new Promise<void>((resolve, _reject) => {
            let spawnEnv = <{ [key: string]: string }>JSON.parse(JSON.stringify(process.env));
            // remove those env vars
            delete spawnEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawnEnv.ELECTRON_RUN_AS_NODE;

            let childProcess = spawn(
                command,
                args,
                {
                    env: spawnEnv
                }
            );

            childProcess.stdout.on("data", (chunk) => {
                resolve();
                console.log(`child process message:  ${chunk}`);
            });

            childProcess.stderr.on("data", (chunk) => {
                console.log(`child process message:  ${chunk}`);
            });
        });
    }
}
