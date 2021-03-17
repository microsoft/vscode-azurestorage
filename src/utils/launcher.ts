/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.md in the project root for license information.
  **/

import { spawn } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Launcher {
    public static async launch(command: string, ...args: string[]): Promise<void> {
        await new Promise<void>((resolve, _reject) => {
            const spawnEnv = <{ [key: string]: string }>JSON.parse(JSON.stringify(process.env));
            // remove those env vars
            delete spawnEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawnEnv.ELECTRON_RUN_AS_NODE;

            const childProcess = spawn(
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
