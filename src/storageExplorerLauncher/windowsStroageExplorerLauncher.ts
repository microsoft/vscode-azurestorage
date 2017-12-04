/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import {Launcher} from "../components/launcher/launcher";
import * as fs from "fs";
import * as os from "os";
import { UserCancelledError } from "../azureServiceExplorer/actions/baseActionHandler";
import * as vscode from 'vscode';

// regedit doesn't exist for Mac. I have to import like this so it builds.
var regedit: any;
if(os.platform() === "win32") {
    regedit = require("regedit");
}

export class WindowsStorageExplorerLauncher implements IStorageExplorerLauncher {
    public static downloadPageUrl = "https://go.microsoft.com/fwlink/?LinkId=723579";
    private static _regKey = "HKCR\\storageexplorer\\shell\\open\\command";
    public async openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string) {
        var url = "storageexplorer://v=1"
        + "&accountid="
        + encodeURIComponent(resourceId)
        + "&subscriptionid="
        + encodeURIComponent(subscriptionid)
        + "&source="
        + encodeURIComponent("VSCODE-AzureStorage");

        if(!!resourceType) {
            url = url + "&resourcetype="
            + resourceType
        }

        if(!!resourceName) {
            url = url + "&resourcename="
            + resourceName;
        }
        
        await WindowsStorageExplorerLauncher.launchStorageExplorer([url]);
    }

    private static async getStorageExplorerExecutable(): Promise<string> {
        var regVal: string;
        try
        {
            regVal = await WindowsStorageExplorerLauncher.getWindowsRegistryValue(WindowsStorageExplorerLauncher._regKey);
        } catch(_err) {
            // ignore and prompt to download.
        } finally {
            if(regVal && await WindowsStorageExplorerLauncher.fileExists(regVal)) {
                return regVal;
            } else {
                var selected: "Download" = <"Download"> await vscode.window.showWarningMessage("Could not find a compatible Storage Explorer. Would you like to download the latest Storage Explorer?", "Download");
                if(selected === "Download") {
                    await WindowsStorageExplorerLauncher.downloadStorageExplorer();
                }
                
                throw new UserCancelledError();        
            }
        }
    }

    private static async fileExists(path: string): Promise<boolean> {
        return await new Promise<boolean>((resolve, _reject) => {
            fs.exists(path, (exists: boolean) => {
                resolve(exists);
            });
        });
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

    private static async downloadStorageExplorer() {
        //I'm not sure why running start directly doesn't work. Opening seperate cmd to run the command works well
        await Launcher.launch("cmd", "/c","start", WindowsStorageExplorerLauncher.downloadPageUrl);
    }

    private static async launchStorageExplorer(args: string[] = []) {
        var storageExplorerExecutable = await WindowsStorageExplorerLauncher.getStorageExplorerExecutable();
        await Launcher.launch(storageExplorerExecutable, ...args);
    }
}
