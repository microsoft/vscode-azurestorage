import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";

export class BlobContainerGroupItem implements StorageAccountModel {
    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Blob Containers');

        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureBlobContainer.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureBlobContainer.svg')
        };

        return treeItem;
    }
}
