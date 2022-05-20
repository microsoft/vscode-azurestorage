import { localize } from "./localize";

function parseResourceId(id: string): RegExpMatchArray {
    const matches: RegExpMatchArray | null = id.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/(.*)\/(.*)/);

    if (matches === null || matches.length < 3) {
        throw new Error(localize('InvalidResourceId', 'Invalid Azure Resource Id'));
    }

    return matches;
}

export function getResourceGroupFromId(id: string): string {
    return parseResourceId(id)[2];
}

export function getAppResourceIdFromId(id: string): string | undefined {
    const matches: RegExpMatchArray | null = id.match(/\/subscriptions\/.*\/resourceGroups\/.*\/providers\/Microsoft.Storage\/storageAccounts\/[^\/]*/);

    return matches?.[0];
}
