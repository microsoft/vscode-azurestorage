import { Environment } from '@azure/ms-rest-azure-env';
import * as request from 'request';
import * as vscode from "vscode";
import { ISubscriptionContext } from "vscode-azureextensionui";

let environmentType: string = "unknown";
let baseUrl: string = "";

interface IJsonObject {
    galleryEndpoint: string;
    graphEndpoint: string;
    portalEndpoint: string;
    authentication: {
        loginEndpoint: string,
        audiences: [
            string
        ]
    };
}
interface IAzureConfig {
    resourceFilter: string[];
    showSignedInEmail: boolean;
    tenant: string;
    cloud: string;
    ppe: IPPE;
    target_azurestack_api_version?: string;
}
interface IPPE {
    activeDirectoryEndpointUrl: string;
    activeDirectoryResourceId: string;
    resourceManagerEndpointUrl: string;
    validateAuthority: boolean;
}

export function ifStack(): boolean {
    if (environmentType === "unknown") {
        let isStack: string = "";
        let azureConfig = <IAzureConfig>vscode.workspace.getConfiguration().get<IAzureConfig>("azure");
        try {
            if (azureConfig.hasOwnProperty("target_azurestack_api_version")) {
                isStack = <string>azureConfig.target_azurestack_api_version;
                if (azureConfig.ppe.hasOwnProperty("resourceManagerEndpointUrl")) {
                    baseUrl = azureConfig.ppe.resourceManagerEndpointUrl;
                } else {
                    throw new Error("Haven't detected valid resource Manager Endpoint Url");
                }
            }
        } catch (error) {
            throw error;
        } finally {
            if (isStack === "true") {
                environmentType = "AzureStack";
            } else {
                environmentType = "NonAzureStack";
            }
        }
    }
    if (environmentType === "AzureStack") {
        return true;
    }
    return false;
}

// tslint:disable-next-line: no-any
async function fetchEndpointMetadata(): Promise<any> {
    const fetchUrl: string = baseUrl.concat("metadata/endpoints?api-version=1.0");
    let options = {
        url: fetchUrl,
        headers: {
            'User-Agent': 'request'
        },
        rejectUnauthorized: false
    };
    return new Promise((resolve, reject) => {
        // tslint:disable-next-line: no-unsafe-any
        request.get(options, (err, _resp, body) => {
            if (err) {
                reject(err);
            } else {
                // tslint:disable-next-line: no-unsafe-any
                resolve(JSON.parse(body));
            }
        });
    });
}

export async function getEnvironment(root: ISubscriptionContext): Promise<void> {
    if (environmentType === "AzureStack") {
        let result = await fetchEndpointMetadata();
        let metadata: IJsonObject = <IJsonObject>result;
        type IRootEnvironment<T> = { -readonly [P in keyof T]: T[P] };
        let env: IRootEnvironment<Environment> = root.credentials.environment;
        env.name = "AzureStack";
        env.portalUrl = metadata.portalEndpoint;
        env.resourceManagerEndpointUrl = baseUrl;
        env.galleryEndpointUrl = metadata.galleryEndpoint;
        env.activeDirectoryEndpointUrl = metadata.authentication.loginEndpoint.slice(0, metadata.authentication.loginEndpoint.lastIndexOf("/") + 1);
        env.activeDirectoryResourceId = metadata.authentication.audiences[0];
        env.activeDirectoryGraphResourceId = metadata.graphEndpoint;
        env.storageEndpointSuffix = baseUrl.substring(baseUrl.indexOf('.'));
        env.keyVaultDnsSuffix = ".vault".concat(baseUrl.substring(baseUrl.indexOf('.')));
        env.managementEndpointUrl = metadata.authentication.audiences[0];
        root.environment = env;
    }
}
