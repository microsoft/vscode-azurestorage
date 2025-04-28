/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ResourceGroup } from "@azure/arm-resources";
import { LocationListStep, type ILocationWizardContext } from "@microsoft/vscode-azext-azureutils";
import { ActivityChildItem, ActivityChildType, activityInfoContext, activityInfoIcon, AzureWizardPromptStep, createContextValue, type ExecuteActivityContext, type IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { prependOrInsertAfterLastInfoChild } from "../utils/activityUtils";
import { localize } from "../utils/localize";

type StartingResourcesLogContext = IActionContext & Partial<ExecuteActivityContext> & ILocationWizardContext & {
    resourceGroup?: ResourceGroup,
};

const startingResourcesContext: string = 'startingResourcesLogStepItem';

/**
 * Use to display primary Azure resource data to the output and activity log
 * i.e. resource group, location, etc.
 */
export class StartingResourcesLogStep<T extends StartingResourcesLogContext> extends AzureWizardPromptStep<T> {
    public hideStepCount: boolean = true;
    protected hasLogged: boolean = false;

    /**
     * Implement if you require additional context loading before resource logging
     */
    protected configureStartingResources?(context: T): void | Promise<void>;

    public async configureBeforePrompt(context: T): Promise<void> {
        if (this.hasLogged) {
            return;
        }
        await this.configureStartingResources?.(context);
        await this.logStartingResources(context);
    }

    public async prompt(): Promise<void> {
        // Don't prompt, just use to log starting resources
    }

    public shouldPrompt(): boolean {
        return false;
    }

    protected async logStartingResources(context: T): Promise<void> {
        if (context.resourceGroup) {
            prependOrInsertAfterLastInfoChild(context,
                new ActivityChildItem({
                    contextValue: createContextValue([startingResourcesContext, activityInfoContext]),
                    label: localize('useResourceGroup', 'Use resource group "{0}"', context.resourceGroup.name),
                    activityType: ActivityChildType.Info,
                    iconPath: activityInfoIcon
                })
            );
            ext.outputChannel.appendLog(localize('usingResourceGroup', 'Using resource group "{0}".', context.resourceGroup.name));
        }

        if (LocationListStep.hasLocation(context)) {
            const location: string = (await LocationListStep.getLocation(context)).name;
            ext.outputChannel.appendLog(localize('usingLocation', 'Using location: "{0}".', location));
        }

        this.hasLogged = true;
    }
}
