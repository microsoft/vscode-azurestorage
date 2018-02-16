/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { Launcher } from "../components/launcher/launcher";
import * as fs from "fs";
import * as vscode from 'vscode';
import { UserCancelledError } from "vscode-azureextensionui";
import * as winreg from "winreg";

const downloadPageUrl: string = "https://go.microsoft.com/fwlink/?LinkId=723579";
const regKey: { hive: string, key: string } = { hive: "HKCR", key: "\\storageexplorer\\shell\\open\\command" };

export class WindowsStorageExplorerLauncher implements IStorageExplorerLauncher {

    public async openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string): Promise<void> {
        // tslint:disable-next-line:prefer-template
        let url = "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(resourceId)
            + "&subscriptionid="
            + encodeURIComponent(subscriptionid)
            + "&source="
            + encodeURIComponent("VSCODE-AzureStorage");

        if (!!resourceType) {
            url = `${url}&resourcetype=${resourceType}`;
        }

        if (!!resourceName) {
            url = `${url}&resourcename=${resourceName}`;
        }

        await WindowsStorageExplorerLauncher.launchStorageExplorer([url]);
    }

    private static async getStorageExplorerExecutable(): Promise<string> {
        let regVal: string;
        try {
            regVal = await WindowsStorageExplorerLauncher.getWindowsRegistryValue(regKey.hive, regKey.key);
        } catch (_err) {
            // ignore and prompt to download.
        } finally {
            let exePath: string;
            if (regVal) {
                // Parse from e.g.: "C:\Program Files (x86)\Microsoft Azure Storage Explorer\StorageExplorer.exe" -- "%1"
                exePath = regVal.split("\"")[1];
            }
            if (exePath && await WindowsStorageExplorerLauncher.fileExists(exePath)) {
                return exePath;
            } else {
                let selected: "Download" = <"Download">await vscode.window.showWarningMessage("Cannot find a compatible Storage Explorer. Would you like to download the latest Storage Explorer?", "Download");
                if (selected === "Download") {
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

    private static getWindowsRegistryValue(hive: string, key: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let regKey = new winreg({ hive, key });
            regKey.values((err: any, items: Winreg.RegistryItem[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(items && items.length > 0 && items[0].value);
                }
            });
        });
    }

    private static async downloadStorageExplorer(): Promise<void> {
        //I'm not sure why running start directly doesn't work. Opening seperate cmd to run the command works well
        await Launcher.Launch("cmd", "/c", "start", downloadPageUrl);
    }

    private static async launchStorageExplorer(args: string[] = []): Promise<void> {
        let storageExplorerExecutable = await WindowsStorageExplorerLauncher.getStorageExplorerExecutable();
        await Launcher.Launch(storageExplorerExecutable, ...args);
    }
}
