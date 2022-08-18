/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AzExtFsExtra, callWithTelemetryAndErrorHandling, UserCancelledError } from "@microsoft/vscode-azext-utils";
import { MessageItem } from "vscode";
import * as winreg from "winreg";
import { storageExplorerDownloadUrl } from "../constants";
import { Launcher } from "../utils/launcher";
import { localize } from "../utils/localize";
import { openUrl } from "../utils/openUrl";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { ResourceType } from "./ResourceType";

const regKey: { hive: string, key: string } = { hive: "HKCR", key: "\\storageexplorer\\shell\\open\\command" };

export class WindowsStorageExplorerLauncher implements IStorageExplorerLauncher {

    public async openResource(accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void> {
        let url = "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(accountId)
            + "&subscriptionid="
            + encodeURIComponent(subscriptionid)
            + "&source="
            + encodeURIComponent("VSCODE-AzureStorage");

        if (resourceType) {
            url = `${url}&resourcetype=${resourceType}`;
        }

        if (resourceName) {
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
            if (exePath && await AzExtFsExtra.pathExists(exePath)) {
                return exePath;
            } else {
                context.telemetry.properties.storageExplorerNotFound = 'true';
                const download: MessageItem = { title: localize('download', 'Download') };
                const message: string = localize('cantFindSE', 'Cannot find a compatible Storage Explorer. Would you like to download the latest Storage Explorer?');
                await context.ui.showWarningMessage(message, download);
                context.telemetry.properties.downloadStorageExplorer = 'true';
                await openUrl(storageExplorerDownloadUrl);
                throw new UserCancelledError();
            }
        }) || '';
    }

    private static async getWindowsRegistryValue(hive: string, key: string): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            const rgKey = new winreg({ hive, key });
            rgKey.values((err?: {}, items?: Winreg.RegistryItem[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(items && items.length > 0 ? items[0].value : undefined);
                }
            });
        });
    }

    private static async launchStorageExplorer(args: string[] = []): Promise<void> {
        const storageExplorerExecutable: string = await WindowsStorageExplorerLauncher.getStorageExplorerExecutable();
        if (!storageExplorerExecutable) {
            throw new UserCancelledError();
        }
        await Launcher.launch(storageExplorerExecutable, ...args);
    }
}
