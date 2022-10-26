import { ResourceModelBase } from "../../vscode-azureresourcegroups.api.v2";

/**
 * Represents a branch data provider resource model as returned by a context menu command.
 * TODO: Do we use this internally?
 */
export interface WrappedResourceModel {
    /**
     * Unwraps the resource, returning the underlying branch data provider resource model.
     *
     * @remarks TODO: Should this be an async method (which might be viral for existing command implementations)?
     */
    unwrap<T extends ResourceModelBase>(): T | undefined;
}
