/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ext } from './extensionVariables';

export class TransferProgress {
    private message: string = '';
    private percentage: number = 0;
    private lastPercentage: number = 0;
    private lastUpdated: number = Date.now();

    constructor(
        private readonly totalWork: number,
        private readonly messagePrefix?: string,
        private readonly updateTimerMs: number = 200
    ) { }

    public reportToNotification(
        finishedWork: number,
        notificationProgress: vscode.Progress<{
            message?: string | undefined;
            increment?: number | undefined;
        }>
    ): void {
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

    public reportToOutputWindow(finishedWork: number): void {
        this.preReport(finishedWork);
        if (this.percentage !== this.lastPercentage) {
            ext.outputChannel.appendLog(this.message);
        }
        this.postReport();
    }

    private preReport(finishedWork: number): void {
        this.percentage = Math.trunc((finishedWork / this.totalWork) * 100);
        const prefix: string = this.messagePrefix ? `${this.messagePrefix}: ` : '';
        this.message = `${prefix}${finishedWork}/${this.totalWork} (${this.percentage}%)`;
    }

    private postReport(): void {
        this.lastPercentage = this.percentage;
        this.lastUpdated = Date.now();
    }
}
