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
        public totalWork?: number,
        private readonly messagePrefix?: string,
        private readonly units?: 'bytes' | 'files',
        private readonly updateTimerMs: number = 200
    ) { }

    public reportToNotification(finishedWork: number, notificationProgress: NotificationProgress, totalWork?: number): void {
        this.totalWork = this.totalWork || totalWork;

        // This function may be called very frequently. Calls made to notificationProgress.report too rapidly result in incremental
        // progress not displaying in the notification window. So debounce calls to notificationProgress.report
        if (this.lastUpdated + this.updateTimerMs < Date.now()) {
            this.preReport(finishedWork);
            if (this.percentage !== this.lastPercentage) {
                notificationProgress.report({ message: this.message, increment: this.percentage - this.lastPercentage });
            }
            this.postReport();
        }
    }

    public reportToOutputWindow(finishedWork: number, totalWork?: number): void {
        this.totalWork = this.totalWork || totalWork;
        this.preReport(finishedWork);
        if (this.percentage !== this.lastPercentage) {
            ext.outputChannel.appendLog(this.message);
        }
        this.postReport();
    }

    private preReport(finishedWork: number): void {
        if (this.totalWork) {
            // Only update message if `totalWork` is valid
            this.percentage = Math.trunc((finishedWork / this.totalWork) * 100);
            const prefix: string = this.messagePrefix ? `${this.messagePrefix}: ` : '';
            // tslint:disable-next-line: strict-boolean-expressions
            const units: string = this.units || '';
            this.message = `${prefix}${finishedWork}/${this.totalWork} ${units} (${this.percentage}%)`;
        }
    }

    private postReport(): void {
        this.lastPercentage = this.percentage;
        this.lastUpdated = Date.now();
    }
}
