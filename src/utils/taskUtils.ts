/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Source: https://italonascimento.github.io/applying-a-timeout-to-your-promises/
// tslint:disable-next-line:no-any
export async function taskResolvesBeforeTimeout(promise: any): Promise<boolean> {
    let timeout = new Promise((_resolve, reject) => {
        let id = setTimeout(() => {
            clearTimeout(id);
            reject();
            // tslint:disable-next-line:align
        }, 1000);
    });

    try {
        await Promise.race([
            promise,
            timeout
        ]);
        return true;
    } catch {
        return false;
    }
}
