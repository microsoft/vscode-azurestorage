/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import { MessageItem } from "vscode";
import { callWithTelemetryAndErrorHandling, UserCancelledError } from "vscode-azureextensionui";
import * as winreg from "winreg";
import { storageExplorerDownloadUrl } from "../constants";
import { ext } from "../extensionVariables";
import { Launcher } from "../utils/launcher";
import { localize } from "../utils/localize";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { ResourceType } from "./ResourceType";

const regKey: { hive: string, key: string } = { hive: "HKCR", key: "\\storageexplorer\\shell\\open\\command" };

export class WindowsStorageExplorerLauncher implements IStorageExplorerLauncher {

    public async openResource(accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void> {
        // tslint:disable-next-line:prefer-template
        let url = "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(accountId)
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
        return await callWithTelemetryAndErrorHandling('getStorageExplorerExecutableWindows', async context => {
            let regVal: string | undefined;
            try {
                regVal = await WindowsStorageExplorerLauncher.getWindowsRegistryValue(regKey.hive, regKey.key);
            } catch (err) {
                context.telemetry.properties.storageExplorerNotFound = 'true';
            }

            let exePath: string | undefined;
            if (regVal) {
                // Parse from e.g.: "C:\Program Files (x86)\Microsoft Azure Storage Explorer\StorageExplorer.exe" -- "%1"
                exePath = regVal.split("\"")[1];
            }
            if (exePath && await WindowsStorageExplorerLauncher.fileExists(exePath)) {
                // tslint:disable-next-line:no-unsafe-finally // Grandfathered in
                return exePath;
            } else {
                context.telemetry.properties.storageExplorerNotFound = 'true';
                const download: MessageItem = { title: localize('download', 'Download') };
                const message: string = localize('cantFindSE', 'Cannot find a compatible Storage Explorer. Would you like to download the latest Storage Explorer?');
                await ext.ui.showWarningMessage(message, download);
                context.telemetry.properties.downloadStorageExplorer = 'true';
                await WindowsStorageExplorerLauncher.downloadStorageExplorer();
                throw new UserCancelledError();
            }
            // tslint:disable-next-line: strict-boolean-expressions
        }) || '';
    }

    private static async fileExists(path: string): Promise<boolean> {
        return await new Promise<boolean>((resolve, _reject) => {
            fs.exists(path, (exists: boolean) => {
                resolve(exists);
            });
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private static getWindowsRegistryValue(hive: string, key: string): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            let rgKey = new winreg({ hive, key });
            rgKey.values((err?: {}, items?: Winreg.RegistryItem[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(items && items.length > 0 ? items[0].value : undefined);
                }
            });
        });
    }

    private static async downloadStorageExplorer(): Promise<void> {
        //I'm not sure why running start directly doesn't work. Opening separate cmd to run the command works well
        await Launcher.launch("cmd", "/c", "start", storageExplorerDownloadUrl);
    }

    private static async launchStorageExplorer(args: string[] = []): Promise<void> {
        let storageExplorerExecutable: string = await WindowsStorageExplorerLauncher.getStorageExplorerExecutable();
        if (!storageExplorerExecutable) {
            throw new UserCancelledError();
        }
        await Launcher.launch(storageExplorerExecutable, ...args);
    }
}
