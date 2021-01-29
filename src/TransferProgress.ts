/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotificationProgress } from './constants';
import { ext } from './extensionVariables';

export class TransferProgress {
    private message: string = '';
    private percentage: number = 0;
    private lastPercentage: number = 0;
    private lastUpdated: number = Date.now();

    constructor(
        private readonly units: 'bytes' | 'files' | 'blobs',
        private readonly messagePrefix?: string,
        private readonly updateTimerMs: number = 200
    ) { }

    public reportToNotification(finishedWork: number, totalWork: number, notificationProgress: NotificationProgress): void {
        // This function may be called very frequently. Calls made to notificationProgress.report too rapidly result in incremental
        // progress not displaying in the notification window. So debounce calls to notificationProgress.report
        if (this.lastUpdated + this.updateTimerMs < Date.now()) {
            this.preReport(finishedWork, totalWork);
            if (this.percentage !== this.lastPercentage) {
                notificationProgress.report({ message: this.message, increment: this.percentage - this.lastPercentage });
            }
            this.postReport();
        }
    }

    public reportToOutputWindow(finishedWork: number, totalWork: number): void {
        this.preReport(finishedWork, totalWork);
        if (this.percentage !== this.lastPercentage) {
            ext.outputChannel.appendLog(this.message);
        }
        this.postReport();
    }

    private preReport(finishedWork: number, totalWork: number): void {
        this.percentage = Math.trunc((finishedWork / totalWork) * 100);
        const prefix: string = this.messagePrefix ? `${this.messagePrefix}: ` : '';
        this.message = `${prefix}${finishedWork}/${totalWork} ${this.units} (${this.percentage}%)`;
    }

    private postReport(): void {
        this.lastPercentage = this.percentage;
        this.lastUpdated = Date.now();
    }
}
