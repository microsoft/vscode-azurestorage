/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress, ProgressLocation, ProgressOptions, window } from "vscode";
import { ext } from "../extensionVariables";

type StatusBarProgress = Progress<{ message: string }>;

/**
 * Shows progress in both the output window and the status bar
 */
export async function awaitWithProgress<T>(title: string, promise: Promise<T>, getProgress: () => string): Promise<T> {
    const uiIntervalMs = 1 * 500;
    const uiUpdatesPerChannelUpdate = 5000 / uiIntervalMs;
    let nextChannelUpdate = uiUpdatesPerChannelUpdate;

    let thisProgress: StatusBarProgress;

    void window.withProgress(
        <ProgressOptions>{
            location: ProgressLocation.Window,
            title: title
        },
        async (progress: StatusBarProgress): Promise<T> => {
            thisProgress = progress;
            return promise;
        });

    pollDuringPromise<T>(uiIntervalMs, promise, () => {
        const msg = getProgress();

        nextChannelUpdate -= 1;
        if (nextChannelUpdate <= 0) {
            nextChannelUpdate = uiUpdatesPerChannelUpdate;
            ext.outputChannel.appendLog(`${title}: ${msg}`);
        }

        thisProgress.report({ message: msg });
    });

    return await promise;
}

/**
 * Runs the given poll function repeatedly until the given promise is resolved or rejected
 */
function pollDuringPromise<T>(intervalMs: number, promise: Promise<T>, poll: () => void): void {
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
            setTimeout(pollFunction, intervalMs);
        }
    };

    pollFunction();
}
