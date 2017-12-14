/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from "os";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { WindowsStorageExplorerLauncher } from "./windowsStroageExplorerLauncher";
import { MacOSStorageExplorerLauncher } from "./macOsStorageExplorerLauncher";

var StorageExplorerLauncher: IStorageExplorerLauncher;

if (os.platform() === "win32") {
    StorageExplorerLauncher = new WindowsStorageExplorerLauncher();
} else {
    // assume Mac Os for now.
    StorageExplorerLauncher = new MacOSStorageExplorerLauncher();
}

export { StorageExplorerLauncher };
