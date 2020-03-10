import { IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { AttachedStorageAccountTreeItem } from "../tree/AttachedStorageAccountTreeItem";

export async function detachStorageAccount(actionContext: IActionContext, treeItem?: AttachedStorageAccountTreeItem): Promise<void> {
    if (!treeItem) {
        treeItem = <AttachedStorageAccountTreeItem>await ext.tree.showTreeItemPicker(AttachedStorageAccountTreeItem.contextValue, actionContext);
    }

    await ext.attachedStorageAccountsTreeItem.detach(treeItem);
    await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
}
