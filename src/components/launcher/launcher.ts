import { spawn } from "child_process";
export class Launcher {
    public static async launch(command: string, ...args: string[]): Promise<void> {
        return await new Promise<void>((resolve, _reject) => {
            let spawnEnv = JSON.parse(JSON.stringify(process.env));
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
