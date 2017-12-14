/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as path from 'path';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class TableNode implements IAzureTreeItem {
    constructor(
		public readonly tableName: string,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {		
    }

    public id: string = undefined;
    public label: string = this.tableName;
    public contextValue: string = 'azureTable';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureTable_16x.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureTable_16x.svg')
    };
}
