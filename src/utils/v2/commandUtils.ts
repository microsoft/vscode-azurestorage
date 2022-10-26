import { IActionContext, registerCommand } from "@microsoft/vscode-azext-utils";
import { ResourceModelBase } from "../../vscode-azureresourcegroups.api.v2";
import { WrappedResourceModel } from "./WrappedResourceModel";

export type BranchCommandCallback = (context: IActionContext, item: unknown, ...args: never[]) => unknown;

function isWrappedItem(value: WrappedResourceModel | unknown): value is WrappedResourceModel {
    return (value as WrappedResourceModel)?.unwrap !== undefined;
}

export function registerBranchCommand(commandId: string, callback: BranchCommandCallback, debounce?: number, telemetryId?: string): void {
    registerCommand(
        commandId,
        (context, item: WrappedResourceModel | unknown, ...args: never[]) => callback(context, isWrappedItem(item) ? item.unwrap<ResourceModelBase>() : item, ...args),
        debounce,
        telemetryId);
}
