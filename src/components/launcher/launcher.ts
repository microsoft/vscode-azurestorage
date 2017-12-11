import { spawn } from "child_process";
export class Launcher {
    public static async launch(command: string, ...args: string[]) {
         return await new Promise((resolve, _reject) => {
        var spawn_env = JSON.parse(JSON.stringify(process.env));
        // remove those env vars
        delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
            delete spawn_env.ELECTRON_RUN_AS_NODE;

            var childProcess = spawn(
                command,
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
}
