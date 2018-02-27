/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress, window, OutputChannel, ProgressOptions, ProgressLocation } from "vscode";

type StatusBarProgress = Progress<{ message: string }>;

/**
 * Shows progress in both the output window and the status bar
 */
export async function awaitWithProgress(title: string, channel: OutputChannel, promise: Promise<any>, getProgress: () => string): Promise<any> {
    const uiIntervalMs = 1 * 500;
    const uiUpdatesPerChannelUpdate = 5000 / uiIntervalMs;
    let nextChannelUpdate = uiUpdatesPerChannelUpdate;

    let thisProgress: StatusBarProgress;

    window.withProgress(
        <ProgressOptions>{
            location: ProgressLocation.Window,
            title: title
        },
        (progress: StatusBarProgress): Promise<any> => {
            thisProgress = progress;
            return promise;
        });

    pollDuringPromise(uiIntervalMs, promise, () => {
        const msg = getProgress();

        nextChannelUpdate -= 1;
        if (nextChannelUpdate <= 0) {
            nextChannelUpdate = uiUpdatesPerChannelUpdate;
            channel.appendLine(`${title}: ${msg}`);
        }

        if (thisProgress) {
            thisProgress.report({ message: msg });
        }
    });

    return await promise;
}

/**
 * Runs the given poll function repeatedly until the given promise is resolved or rejected
 */
function pollDuringPromise(intervalMs: number, promise: Promise<any>, poll: () => void): void {
    let inProgress = true;
    promise.then(
        () => {
            inProgress = false;
        },
        () => {
            inProgress = false;
        }
    );

    const pollFunction = () => {
        if (inProgress) {
            poll();
            setTimeout(() => pollFunction(), intervalMs);
        }
    };

    pollFunction();
}
