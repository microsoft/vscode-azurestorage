/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from "os";
import { ext } from "../extensionVariables";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { MacOSStorageExplorerLauncher } from "./macOSStorageExplorerLauncher";
import { WebStorageExplorerLauncher } from "./webStorageExplorerLauncher";
import { WindowsStorageExplorerLauncher } from "./windowsStorageExplorerLauncher";

let storageExplorerLauncher: IStorageExplorerLauncher;

if (ext.isWeb) {
    storageExplorerLauncher = new WebStorageExplorerLauncher();
} else if (os.platform() === "win32") {
    storageExplorerLauncher = new WindowsStorageExplorerLauncher();
} else {
    // assume Mac Os for now.
    storageExplorerLauncher = new MacOSStorageExplorerLauncher();
}

export { storageExplorerLauncher };
