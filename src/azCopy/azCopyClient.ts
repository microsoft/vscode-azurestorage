/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, spawn } from "child_process";
import { getAzCopyExe } from "./azCopyExe";
import { ICopyJob } from "./ICopyJob";
import { IJobInfo } from "./IJobInfo";
import { AzCopyLocation } from "./locations/AzCopyLocation";
import { ICopyOptions } from "./options/ICopyOptions";
import { IDeleteOptions } from "./options/IDeleteOptions";
import { AzCopyMessage } from "./output/IAzCopyMessage";

export class AzCopyClient {
    private _jobs: { [id: string]: ICopyJob } = {};
    private _exeToUse: string = getAzCopyExe();

    /**
     * Starts an AzCopy `copy` job.
     * @param src The source of the copy.
     * @param dst The destination of the copy.
     * @param options Options for `copy`.
     * @returns The job ID of the started job. See the doc comment on `AzCopyClient` for more information on job IDs.
     */
    public async copy(src: AzCopyLocation, dst: AzCopyLocation, options: ICopyOptions): Promise<string> {
        return await this._copy(this._locationToString(src, options.fromTo), this._locationToString(dst, options.fromTo), options);
    }

    /**
     * Starts an AzCopy `remove` job.
     * @param target The thing to be deleted.
     * @param options Options for `remove`.
     * @returns The job ID of the started job. See the doc comment on `AzCopyClient` for more information on job IDs.
     */
    // tslint:disable-next-line:no-reserved-keywords
    public async delete(target: AzCopyLocation, options: IDeleteOptions): Promise<string> {
        return this._delete(this._locationToString(target), options);
    }

    // tslint:disable-next-line:function-name
    private async _copy(src: string, dst: string, options: ICopyOptions): Promise<string> {
        let jobId = AzCopyClient._createJobId();
        let spawnArgs = this._generateSpawnArgs({ command: "copy", locations: [src, dst], options: options });
        let commandStr = this._generateHumanCmdString({ command: "copy", locations: [src, dst], options: options });

        let child = this._spawnAzCopy(spawnArgs);
        this._addChildListeners(jobId, child);

        this._jobs[jobId] = {
            azCopyProcess: child,
            command: commandStr,
            scanningStarted: false,
            canceled: false,
            killed: false
        };

        return jobId;
    }

    // tslint:disable-next-line:function-name
    private _delete(target: string, options: IDeleteOptions): string {
        let jobId = AzCopyClient._createJobId();
        let spawnArgs = this._generateSpawnArgs({ command: "remove", locations: [target], options: options });
        let commandStr = this._generateHumanCmdString({ command: "remove", locations: [target], options: options });

        let child = this._spawnAzCopy(spawnArgs);
        this._addChildListeners(jobId, child);

        this._jobs[jobId] = {
            azCopyProcess: child,
            azCopyJobId: jobId,
            command: commandStr,
            canceled: false,
            killed: false,
            scanningStarted: false
        };
        return jobId;
    }

    /**
     * Gets the latest info for the job with ID `jobId`.
     *
     * See the doc comment on `AzCopyClient` for more information on job IDs.
     */
    public async getJobInfo(jobId: string): Promise<IJobInfo> {
        // TODO: check
        if (this._jobs[jobId] === undefined) {
            throw new Error(`No job with job Id ${jobId} has been started.`);
        }
        let job = this._jobs[jobId];
        return {
            latestStatus: job.latestStatus,
            errorMessage: job.errorMessage,
            logFileLocation: job.logFileLocation,
            scanningStarted: job.scanningStarted,
            canceled: job.canceled,
            killed: job.killed,
            command: job.command,
            lastMessageTime: job.lastMessageTime
        };
    }

    /**
     * Cancels the job with ID `jobId` by sending a cancel message to the
     * AzCopy process.
     *
     * See the doc comment on `AzCopyClient` for more information on job IDs.
     */
    public async cancelJob(jobId: string): Promise<void> {
        // TODO: check
        if (this._jobs[jobId] === undefined) {
            throw new Error(`No job with job Id ${jobId} has been started.`);
        }
        this._jobs[jobId].canceled = true;
        this._jobs[jobId].azCopyProcess.stdin?.write("cancel \n");
    }

    /**
     * Kills the job with ID `jobId`. Unlike cancel, which actually sends a cancel message to the
     * AzCopy process, this function forcefully kills the process.
     *
     * See the doc comment on `AzCopyClient` for more information on job IDs.
     */
    public async killJob(jobId: string): Promise<void> {
        if (this._jobs[jobId] === undefined) {
            throw new Error(`No job with job Id ${jobId} has been started.`);
        }
        this._jobs[jobId].killed = true;
        this._jobs[jobId].azCopyProcess.kill();
    }

    // tslint:disable-next-line:function-name
    private async _handleMessage(jobId: string, message: AzCopyMessage): Promise<void> {
        let job = this._jobs[jobId];
        switch (message.MessageType) {
            case "Info":
                break;
            case "Init":
                job.scanningStarted = true;
                job.logFileLocation = message.MessageContent.LogFileLocation;
                job.azCopyJobId = message.MessageContent.JobID;
                break;
            case "Progress":
                job.latestStatus = this._transformStatusNumbers({ ...message.MessageContent, TimeStamp: message.TimeStamp, StatusType: message.MessageType });
                break;
            case "Prompt":
                if (message.PromptDetails.PromptType === "Cancel") {
                    this._confirmCancelMessage(jobId);
                } else {
                    job.promptMessage = message;
                }
                break;
            case "EndOfJob":
                job.latestStatus = this._transformStatusNumbers({ ...message.MessageContent, TimeStamp: message.TimeStamp, StatusType: message.MessageType });
                break;
            case "Error":
            default:
                job.errorMessage = message.MessageContent;
                break;
        }
        job.lastMessageTime = Date.now();
    }

    private static _createJobId(): string {
        return uuidV4();
    }

    private _generateHumanCmdString(args: { command: "copy", locations: string[], options: ICopyOptions }): string;
    private _generateHumanCmdString(args: { command: "remove", locations: string[], options: IDeleteOptions }): string;
    private _generateHumanCmdString(
        args: { command: "copy", locations: string[], options: ICopyOptions } |
        { command: "remove", locations: string[], options: IDeleteOptions }
    ): string {
        let locations = args.locations;
        let envVars = args.envVars;

        let preCommandStr: string = "";
        let postCommandStr: string = "";
        let commandArgs: string[] = [];

        for (let envVar in envVars) {
            if (envVar !== "AZCOPY_OAUTH_TOKEN_INFO" && envVar !== "AZCOPY_USER_AGENT_PREFIX") {
                if (os.platform() === "win32") {
                    preCommandStr += `$env:${envVar} = "${envVars[envVar]}";\n`;
                } else {
                    preCommandStr += `export ${envVar}=${envVars[envVar]};\n`;
                }
            }
        }
        if (!!envVars.AZCOPY_OAUTH_TOKEN_INFO) {
            preCommandStr += "./azcopy login;\n";
        }

        commandArgs.push(`./azcopy${os.platform() === "win32" ? ".exe" : ""}`);

        commandArgs.push(args.command);

        locations.forEach((location) => {
            commandArgs.push(`"${location}"`);
        });

        if (args.command === "copy") {
            let copyOptions: ICopyOptions = args.options;
            if (!!copyOptions.overwriteExisting) {
                commandArgs.push(`--overwrite=${copyOptions.overwriteExisting}`);
            }
            if (!!copyOptions.checkMd5) {
                commandArgs.push("--check-md5", copyOptions.checkMd5);
            }
            if (!!copyOptions.fromTo) {
                commandArgs.push(`--from-to=${copyOptions.fromTo}`);
            }
            if (!!copyOptions.blobType) {
                commandArgs.push("--blob-type", copyOptions.blobType);
            }
            if (!!copyOptions.followSymLinks) {
                commandArgs.push("--follow-symlinks");
            }
            if (!!copyOptions.capMbps) {
                commandArgs.push(`--cap-mbps ${copyOptions.capMbps}`);
            }
            if (copyOptions.preserveAccessTier !== undefined) {
                commandArgs.push(`--s2s-preserve-access-tier=${copyOptions.preserveAccessTier}`);
            }
            if (copyOptions.checkLength !== undefined) {
                commandArgs.push(`--check-length=${copyOptions.checkLength}`);
            }
            if (!!copyOptions.putMd5) {
                commandArgs.push("--put-md5");
            }
            if (!!copyOptions.followSymLinks) {
                commandArgs.push("--follow-symlinks");
            }
            if (!!copyOptions.decompress) {
                commandArgs.push(`--decompress`);
            }
            if (copyOptions.preserveSmbInfo !== undefined) {
                commandArgs.push(`--preserve-smb-info=${copyOptions.preserveSmbInfo}`);
            }
            if (copyOptions.preserveSmbPermissions !== undefined) {
                commandArgs.push(`--preserve-smb-permissions=${copyOptions.preserveSmbPermissions}`);
            }
            if (copyOptions.accessTier !== undefined) {
                commandArgs.push(`--block-blob-tier=${copyOptions.accessTier}`);
            }
            if (!!copyOptions.excludePath) {
                commandArgs.push(`--exclude-path=${copyOptions.excludePath}`);
            }
        } else {
            let deleteOptions: IDeleteOptions = args.options;
            if (!!deleteOptions.deleteSnapshots) {
                commandArgs.push(`--delete-snapshots=${deleteOptions.deleteSnapshots}`);
            }
        }

        let commonOptions = args.options;
        if (!!commonOptions.listOfFiles) {
            commandArgs.push("--list-of-files", `"${commonOptions.listOfFiles}"`);
        }
        if (!!commonOptions.recursive) {
            commandArgs.push("--recursive");
        }

        if (!!envVars.AZCOPY_OAUTH_TOKEN_INFO) {
            postCommandStr += "./azcopy logout;\n";
        }

        for (let envVar in envVars) {
            if (envVar !== "AZCOPY_OAUTH_TOKEN_INFO" && envVar !== "AZCOPY_USER_AGENT_PREFIX") {
                if (os.platform() === "win32") {
                    postCommandStr += `$env:${envVar} = "";\n`;
                } else {
                    postCommandStr += `unset ${envVar};\n`;
                }
            }
        }
        return preCommandStr + commandArgs.join(" ") + ";\n" + postCommandStr;
    }

    private _generateSpawnArgs(args: { command: "copy", locations: string[], options: ICopyOptions }): string[];
    private _generateSpawnArgs(args: { command: "remove", locations: string[], options: IDeleteOptions }): string[];
    private _generateSpawnArgs(
        args: { command: "copy", locations: string[], options: ICopyOptions } |
        { command: "remove", locations: string[], options: IDeleteOptions }
    ): string[] {
        let spawnArgs: string[] = [args.command, ...args.locations, "--output-type=json", "--cancel-from-stdin"];

        if (args.command === "copy") {
            let copyOptions: ICopyOptions = args.options;
            if (!!copyOptions.overwriteExisting) {
                spawnArgs.push(`--overwrite=${copyOptions.overwriteExisting}`);
            }
            if (!!copyOptions.checkMd5) {
                spawnArgs.push("--check-md5", copyOptions.checkMd5);
            }
            if (!!copyOptions.fromTo) {
                spawnArgs.push(`--from-to=${copyOptions.fromTo}`);
            }
            if (!!copyOptions.blobType) {
                spawnArgs.push("--blob-type", copyOptions.blobType);
            }
            if (!!copyOptions.followSymLinks) {
                spawnArgs.push("--follow-symlinks");
            }
            if (copyOptions.capMbps !== undefined) {
                spawnArgs.push("--cap-mbps", copyOptions.capMbps.toString());
            }
            if (copyOptions.preserveAccessTier !== undefined) {
                spawnArgs.push(`--s2s-preserve-access-tier=${copyOptions.preserveAccessTier}`);
            }
            if (copyOptions.checkLength !== undefined) {
                spawnArgs.push(`--check-length=${copyOptions.checkLength}`);
            }
            if (!!copyOptions.putMd5) {
                spawnArgs.push("--put-md5");
            }
            if (!!copyOptions.followSymLinks) {
                spawnArgs.push("--follow-symlinks");
            }
            if (!!copyOptions.decompress) {
                spawnArgs.push(`--decompress`);
            }
            if (copyOptions.preserveSmbInfo !== undefined) {
                spawnArgs.push(`--preserve-smb-info=${copyOptions.preserveSmbInfo}`);
            }
            if (copyOptions.preserveSmbPermissions !== undefined) {
                spawnArgs.push(`--preserve-smb-permissions=${copyOptions.preserveSmbPermissions}`);
            }
            if (copyOptions.accessTier !== undefined) {
                spawnArgs.push(`--block-blob-tier=${copyOptions.accessTier}`);
            }
            if (!!copyOptions.excludePath) {
                spawnArgs.push(`--exclude-path=${copyOptions.excludePath}`);
            }
        } else {
            let deleteOptions: IDeleteOptions = args.options;
            if (!!deleteOptions.deleteSnapshots) {
                spawnArgs.push(`--delete-snapshots=${deleteOptions.deleteSnapshots}`);
            }
        }

        let commonOptions = args.options;
        if (!!commonOptions.recursive) {
            spawnArgs.push("--recursive");
        }
        if (!!commonOptions.listOfFiles) {
            spawnArgs.push("--list-of-files", commonOptions.listOfFiles);
        }

        return spawnArgs;
    }

    private _locationToString(src: AzCopyLocation, fromTo?: FromToOption): string {
        if (src.type === "Local") {
            return src.path + (src.useWildCard ? "*" : "");
        } else {
            let parsedResourceUrl = URL.parse(src.resourceUri);
            let protocol = parsedResourceUrl.protocol;
            let host = parsedResourceUrl.host;
            let containerName = parsedResourceUrl.pathname;

            let query = {};
            if (src.type === "RemoteSas") {
                query = URL.parse("?" + src.sasToken, true).query;
            }
            if (!!src.snapshotId) {
                let serviceType = getServiceType(src.resourceUri, fromTo);
                if (serviceType === "file") {
                    query.sharesnapshot = src.snapshotId;
                } else {
                    query.snapshot = src.snapshotId;
                }
            }

            let url = URL.format({
                protocol: protocol,
                host: host,
                // AzCopy requires encoding '*' in addition to the universal encodeURIComponent()
                // src.path contains on extra / in addition to the full name of the src
                pathname: containerName + (src.path.split("/").map((p) => encodeURIComponent(p).replace(/\*/g, "%2A")).join("/")) + (src.useWildCard ? "*" : ""),
                query: query
            }).toString();

            return url;
        }
    }

    private _onCopyError(jobId: string, err: any) {
        let job = this._jobs[jobId];
        job.errorMessage = "Unexpected error from AzCopy: " + JSON.stringify(err);
    }

    private _onCopyEnd(jobId: string) {
        let job = this._jobs[jobId];
        if (job.killed) {
            // job was killed so we don't care what the last thing it did was 🤷‍
        } else if (job.canceled && !!job.latestStatus) {
            switch (job.latestStatus.JobStatus) {
                case "InProgress":
                case "Cancelling":
                case "Failed":
                    // latest status does not indidcate a successful cancel ❌
                    job.errorMessage = job.errorMessage || CopyClientErrors.UnsuccessfulCancel;
                    job.latestStatus.StatusType = "EndOfJob" as any;
                    job.latestStatus.JobStatus = "Failed";
                    break;
                case "Cancelled":
                    // latest status indicates a successful cancel, nothing to do! 🙂
                    break;
                case "Completed":
                case "CompletedWithSkipped":
                case "CompletedWithErrors":
                case "CompletedWithErrorsAndSkipped":
                    // latest status indicates completion (odd, but not bad?), nothing to do! 🙂
                    break;
            }
        } else if (!job.canceled && !!job.latestStatus) {
            switch (job.latestStatus.JobStatus) {
                case "InProgress":
                case "Cancelling":
                    // latest status indicates job is still in progress or cancelling ❌
                    job.errorMessage = job.errorMessage || CopyClientErrors.UnexpectedQuit;
                    job.latestStatus.StatusType = "EndOfJob" as any;
                    job.latestStatus.JobStatus = "Failed" as any;
                    break;
                case "Failed":
                    // latest status does not indidcate a successful completion ❌
                    job.errorMessage = job.errorMessage || (!job.latestStatus.TransfersFailed && !job.latestStatus.TransfersSkipped) ? CopyClientErrors.UnexpectedQuit : undefined;
                    break;
                case "Cancelled":
                    // latest status indicates a successful cancel ❓
                    job.errorMessage = job.errorMessage || CopyClientErrors.UnexpectedCancel;
                    break;
                case "Completed":
                case "CompletedWithSkipped":
                case "CompletedWithErrors":
                case "CompletedWithErrorsAndSkipped":
                    // latest status indicates job completed fine, nothing to do! 🙂
                    break;
            }
        } else if (!job.latestStatus) {
            // latest status does not exist ❌
            let errorCode = job.canceled ? CopyClientErrors.UnsuccessfulCancel : CopyClientErrors.UnexpectedQuit;
            job.errorMessage = job.errorMessage || errorCode;
            job.latestStatus = AzCopyClient._createFakeExitTransferStatus();
        }

        if (!!job.tokenRefresher) {
            job.tokenRefresher.endRefreshCycle();
        }
    }

    // tslint:disable-next-line:function-name
    private _spawnAzCopy(spawnArgs: string[]): ChildProcess {
        return spawn(this._exeToUse, spawnArgs, {
            env: { ...process.env }
        });
    }

    // tslint:disable-next-line:function-name
    private _addChildListeners(jobId: string, child: ChildProcess): void {
        let jsonStream = jsonStream();
        child.stdout.pipe(jsonStream);
        jsonStream.on("data", (object: IRawMessage) => {
            let azCopyMsg: AzCopyMessage;
            try {
                azCopyMsg = {
                    MessageType: object.MessageType as any,
                    MessageContent: JSON.parse(object.MessageContent),
                    TimeStamp: object.TimeStamp,
                    PromptDetails: object.PromptDetails as any
                };
            } catch (err) {
                azCopyMsg = {
                    MessageType: object.MessageType as any,
                    MessageContent: object.MessageContent,
                    TimeStamp: object.TimeStamp,
                    PromptDetails: object.PromptDetails as any
                };
            }
            this._handleMessage(jobId, azCopyMsg);
        });
        child.stdout.on("error", (err) => {
            this._onCopyError(jobId, err);
        });
        child.stdout.on("end", () => {
            this._onCopyEnd(jobId);
        });
    }

    private static _createFakeExitTransferStatus(): TransferStatus {
        return {
            StatusType: "EndOfJob",
            ErrorMsg: "",
            ActiveConnections: 0,
            CompleteJobOrdered: false,
            JobStatus: "Failed",
            TotalTransfers: 0,
            TransfersCompleted: 0,
            TransfersFailed: 0,
            TransfersSkipped: 0,
            PercentComplete: 0,
            BytesOverWire: 0,
            TotalBytesTransferred: 0,
            TotalBytesEnumerated: 0,
            FailedTransfers: null,
            SkippedTransfers: null,
            IsDiskConstrained: false,
            TimeStamp: new Date().toDateString()
        };
    }

    /**
     * If AzCopy hasn't finished discovery and "cancel" is entered, it emits a prompt message to confirm canceling
     * This is because the job is not resumable in this situation
     * We internally confirm it and don't surface this message to the user
     */
    private _confirmCancelMessage(jobId: string | undefined) {
        if (!jobId || !this._jobs[jobId]) {
            throw new Error(`No job with job Id ${jobId} has been started.`);
        }
        this._jobs[jobId].azCopyProcess.stdin.write("y\n");
    }

    /**
     * Numbers in AzCopy transfer status messages are sent as strings
     */
    private _transformStatusNumbers(transferStatus: TransferStatus): TransferStatus {
        if (!!transferStatus.ActiveConnections) {
            transferStatus.ActiveConnections = parseInt(transferStatus.ActiveConnections.toString(), 10);
        }
        if (!!transferStatus.TotalTransfers) {
            transferStatus.TotalTransfers = parseInt(transferStatus.TotalTransfers.toString(), 10);
        }
        if (!!transferStatus.TransfersCompleted) {
            transferStatus.TransfersCompleted = parseInt(transferStatus.TransfersCompleted.toString(), 10);
        }
        if (!!transferStatus.TransfersFailed) {
            transferStatus.TransfersFailed = parseInt(transferStatus.TransfersFailed.toString(), 10);
        }
        if (!!transferStatus.TransfersSkipped) {
            transferStatus.TransfersSkipped = parseInt(transferStatus.TransfersSkipped.toString(), 10);
        }
        if (!!transferStatus.PercentComplete) {
            transferStatus.PercentComplete = parseInt(transferStatus.PercentComplete.toString(), 10);
        }
        if (!!transferStatus.BytesOverWire) {
            transferStatus.BytesOverWire = parseInt(transferStatus.BytesOverWire.toString(), 10);
        }
        if (!!transferStatus.TotalBytesTransferred) {
            transferStatus.TotalBytesTransferred = parseInt(transferStatus.TotalBytesTransferred.toString(), 10);
        }
        if (!!transferStatus.TotalBytesEnumerated) {
            transferStatus.TotalBytesEnumerated = parseInt(transferStatus.TotalBytesEnumerated.toString(), 10);
        }
        return transferStatus;
    }
}
