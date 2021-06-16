/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { getRandomHexString } from "./stringUtils";
import { workspaceFsUtils } from './workspaceFsUtils';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TemporaryFile {
    static async create(fileName: string): Promise<string> {
        const folderName = getRandomHexString(12);
        const filePath = path.join(os.tmpdir(), folderName, fileName);
        await workspaceFsUtils.ensureFile(filePath);
        return filePath;
    }
}
