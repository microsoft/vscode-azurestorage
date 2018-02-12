/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from "os";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { WindowsStorageExplorerLauncher } from "./windowsStorageExplorerLauncher";
import { MacOSStorageExplorerLauncher } from "./macOSStorageExplorerLauncher";

let storageExplorerLauncher: IStorageExplorerLauncher;

if (os.platform() === "win32") {
    storageExplorerLauncher = new WindowsStorageExplorerLauncher();
} else {
    // assume Mac Os for now.
    storageExplorerLauncher = new MacOSStorageExplorerLauncher();
}

export { storageExplorerLauncher };
