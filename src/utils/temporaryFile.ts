/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { getRandomHexString } from "./stringUtils";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TemporaryFile {
    static async create(fileName: string): Promise<string> {
        let folderName = getRandomHexString(12);
        let filePath = path.join(os.tmpdir(), folderName, fileName);
        await fse.ensureFile(filePath);
        return filePath;
    }
}
