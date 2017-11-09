/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';
import { spawn, ChildProcess } from "child_process";

export class BlobContainerActionHandler extends BaseActionHandler {
    private static _childProcess: ChildProcess;
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openExplorer", (node) => { this.openBlobContainerInStorageExplorer(node) });
    
        /*
        BlobContainerActionHandler._childProcess = spawn(
            "open",
            [
                "storageexplorer://v=1&accountid=%2Fsubscriptions%2F83635e26-687a-4333-a2a0-33e3cd1f573a%2FresourceGroups%2FJakeRadTestRG%2Fproviders%2FMicrosoft.Storage%2FstorageAccounts%2Fjakeradsnaptest&subscriptionid=83635e26-687a-4333-a2a0-33e3cd1f573a&resourcetype=Azure.BlobContainer&resourcename=snaptest"
            ]
        );
        */   
    }

    openBlobContainerInStorageExplorer(_node) {
        var spawn_env = JSON.parse(JSON.stringify(process.env));
        
        // remove those env vars
        delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
        delete spawn_env.ELECTRON_RUN_AS_NODE;

        BlobContainerActionHandler._childProcess = spawn(
            "open",
            [
                "storageexplorer://v=1&accountid=%2Fsubscriptions%2F83635e26-687a-4333-a2a0-33e3cd1f573a%2FresourceGroups%2FJakeRadTestRG%2Fproviders%2FMicrosoft.Storage%2FstorageAccounts%2Fjakeradsnaptest&subscriptionid=83635e26-687a-4333-a2a0-33e3cd1f573a&resourcetype=Azure.BlobContainer&resourcename=snaptest"
            ]
        );
        /*
        BlobContainerActionHandler._childProcess = spawn(
            "/Applications/Microsoft\ Azure\ Storage\ Explorer.app/Contents/MacOS/Microsoft\ Azure\ Storage\ Explorer",
            [],
            {
                env: spawn_env
            }
        );*/

        BlobContainerActionHandler._childProcess.stdout.on("data", (chunk) => {
            console.log(`child process message:  ${chunk}`);
        });

        BlobContainerActionHandler._childProcess.stderr.on("data", (chunk) => {
            console.log(`child process message:  ${chunk}`);
        });

        BlobContainerActionHandler._childProcess.on("exit", (code, signal) => {
            console.log('child process exited with ' +
            `code ${code} and signal ${signal}`);
        });
    }

}
