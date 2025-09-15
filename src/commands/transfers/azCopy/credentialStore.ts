/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

import { ICredentialStore } from "@azure-tools/azcopy-node";
import { ext } from "../../../extensionVariables";

export class CredentialStore implements ICredentialStore {
    private credentialMap: Map<string, string> = new Map<string, string>();
    public async setEntry(service: string, account: string, value: string): Promise<void> {
        try {
            this.credentialMap.set(`${service}-${account}`, value);
        } catch (error) {
            ext.outputChannel.appendLog(`Unable to set password. service:${service} account:${account}`, error);
        }
    }

    public async getEntry(service: string, account: string): Promise<string | null> {
        try {
            return this.credentialMap.get(`${service}-${account}`) ?? null;
        } catch (error) {
            ext.outputChannel.appendLog(`Unable to get password. service:${service} account:${account}`, error);
            return null;
        }
    }

    public async deleteEntry(service: string, account: string): Promise<boolean> {
        try {
            return this.credentialMap.delete(`${service}-${account}`);
        } catch (error) {
            ext.outputChannel.appendLog(`Unable to delete password. service:${service} account:${account}`, error);
            return false;
        }
    }
}
