/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from "crypto";
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

// tslint:disable:no-stateless-class // Grandfathered in
export class TemporaryFile {
    private static randomFolderNameLength: number = 12;

    static async create(fileName: string): Promise<string> {
        const buffer: Buffer = crypto.randomBytes(Math.ceil(TemporaryFile.randomFolderNameLength / 2));
        let folderName = buffer.toString('hex').slice(0, TemporaryFile.randomFolderNameLength);
        let filePath = path.join(os.tmpdir(), folderName, fileName);
        await fse.ensureFile(filePath);
        return filePath;
    }
}
