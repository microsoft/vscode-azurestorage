import { Environment } from '@azure/ms-rest-azure-env';
import * as path from 'path';
import * as request from 'request';
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
export function ifStack(): boolean {
    if (environmentType === "unknown") {
        const vscodetype = 'Code';
        const settingsPath = path.join(<string>process.env.APPDATA, vscodetype, 'User', 'settings.json');
        let isStack: string = "";
        try {
            // tslint:disable-next-line: non-literal-require
            const data = require(settingsPath);
            // tslint:disable-next-line: no-unsafe-any
            baseUrl = data["azure.ppe"].resourceManagerEndpointUrl;
            // tslint:disable-next-line: no-unsafe-any
            isStack = data["azure.target_azurestack_api_version"];
        } catch (err) {
            console.log("Error parsing settings.json. Fallings back to default endpoints.");
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