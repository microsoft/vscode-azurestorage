/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "./utils/localize";

export class AttachedAccountRoot implements ISubscriptionContext {
    private _error: Error = new Error(localize('cannotRetrieveAzureSubscriptionInfoForAttachedAccount', 'Cannot retrieve Azure subscription information for an attached account.'));

    public get credentials(): never {
        throw this._error;
    }

    public get subscriptionDisplayName(): never {
        throw this._error;
    }

    public get subscriptionId(): never {
        throw this._error;
    }

    public get subscriptionPath(): never {
        throw this._error;
    }

    public get tenantId(): never {
        throw this._error;
    }

    public get userId(): never {
        throw this._error;
    }

    public get environment(): never {
        throw this._error;
    }

    public get isCustomCloud(): never {
        throw this._error;
    }
}
