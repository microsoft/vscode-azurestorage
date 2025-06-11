/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { ResourceGraphClient } from "@azure/arm-resourcegraph";
import { IActionContext, ISubscriptionContext, callWithTelemetryAndErrorHandling } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "@microsoft/vscode-azext-utils/hostapi";
import { IStorageRoot } from "./tree/IStorageRoot";
import { StorageAccountTreeItem, StorageQueryResult, WebsiteHostingStatus } from "./tree/StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./tree/blob/BlobContainerTreeItem";
import { StorageAccountWrapper } from "./utils/storageWrappers";

export interface ResolvedStorageAccount extends ResolvedAppResourceBase {
    label: string;
    root: IStorageRoot;
    storageAccount: StorageAccountWrapper;
    getWebsiteCapableContainer(context: IActionContext): Promise<BlobContainerTreeItem | undefined>;
    getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus>;
    setWebsiteHostingProperties(properties: BlobServiceProperties): Promise<void>;
    ensureHostingCapable(context: IActionContext, hostingStatus: WebsiteHostingStatus): Promise<void>;
    configureStaticWebsite(context: IActionContext): Promise<void>;
    disableStaticWebsite(context: IActionContext): Promise<void>;
    browseStaticWebsite(context: IActionContext): Promise<void>;
    kind: 'microsoft.storage/storageaccounts';
}

export class StorageAccountResolver implements AppResourceResolver {

    private storageAccountCacheLastUpdated = 0;
    private storageAccountCache: Map<string, StorageQueryResult> = new Map<string, StorageQueryResult>();
    private listStorageAccountsTask: Promise<void> | undefined;

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedStorageAccount | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            context.telemetry.properties.isActivationEvent = 'true';
            if (this.storageAccountCacheLastUpdated < Date.now() - 1000 * 3) {
                this.storageAccountCacheLastUpdated = Date.now();
                this.listStorageAccountsTask = new Promise((resolve, reject) => {
                    this.storageAccountCache.clear();
                    const graphClient = new ResourceGraphClient(subContext.credentials);
                    const subscriptions = [subContext.subscriptionId];
                    const query = "resources|where type =~ \"microsoft.storage/storageaccounts\" or type =~ \"microsoft.classicstorage/storageaccounts\"\r\n| extend isStorageV2 = iff(type =~ \"microsoft.storage/storageaccounts\", true, false)\r\n| extend SkuName = replace('-', '_', tostring(iff(isStorageV2, sku.name, properties.accountType)))\r\n| extend replicationCode = split(SkuName, '_', 1)[0]\r\n| extend ReplicationType = case(replicationCode =~ \"lrs\", 'Locally-redundant storage (LRS)', \r\n                                replicationCode =~ \"zrs\", 'Zone-redundant storage (ZRS)',\r\n                                replicationCode =~ \"grs\", 'Geo-redundant storage (GRS)',\r\n                                replicationCode =~ \"ragrs\", 'Read-access geo-redundant storage (RA-GRS)',\r\n                                replicationCode =~ \"gzrs\", 'Geo-zone-redundant storage (GZRS)',\r\n                                replicationCode =~ \"ragzrs\", 'Read-access geo-zone-redundant storage (RA-GZRS)',\r\n                                coalesce(replicationCode, '-'))\r\n| extend Created = tostring(properties.creationTime)\r\n| extend AccessTier = tostring(iff(isStorageV2, coalesce(properties.accessTier, '-'), '-'))\r\n| extend primaryStatus = iff(isStorageV2, properties.statusOfPrimary, properties.statusOfPrimaryRegion)\r\n| extend PrimaryStatus = case(primaryStatus =~ \"available\", 'Available',\r\n                              primaryStatus =~ \"unavailable\", 'Unavailable',\r\n                              coalesce(primaryStatus, '-'))\r\n| extend secondaryStatus = iff(isStorageV2, properties.statusOfSecondary, properties.statusOfSecondaryRegion)\r\n| extend SecondaryStatus = case(secondaryStatus =~ \"available\", 'Available',\r\n                              secondaryStatus =~ \"unavailable\", 'Unavailable',\r\n                              coalesce(secondaryStatus, '-'))\r\n| extend provisioningState = properties.provisioningState\r\n| extend ProvisioningState = case(provisioningState =~ \"creating\", 'Creating',\r\n                                  provisioningState =~ \"resolvingdns\", 'ResolvingDNS',\r\n                                  provisioningState =~ \"succeeded\", 'Succeeded',\r\n                                  provisioningState =~ \"deleting\", 'Deleting',\r\n                                  coalesce(provisioningState, '-'))\r\n| extend PrimaryLocation = tostring(iff(isStorageV2, properties.primaryLocation, properties.geoPrimaryRegion))\r\n| extend SecondaryLocation = tostring(iff(isStorageV2, properties.secondaryLocation, properties.geoSecondaryRegion))\r\n| extend EdgeZone = iff(tostring(extendedLocation.type) =~ 'EdgeZone', tostring(extendedLocation.name), '-')\r\n| project id, name, type, location, subscriptionId, resourceGroup, kind, tags, SkuName, ReplicationType, Created, AccessTier, PrimaryLocation, \r\n          PrimaryStatus, SecondaryLocation, SecondaryStatus, ProvisioningState, EdgeZone|where (type !~ ('dell.storage/filesystems'))|where (type !~ ('microsoft.weightsandbiases/instances'))|where (type !~ ('pinecone.vectordb/organizations'))|where (type !~ ('mongodb.atlas/organizations'))|where (type !~ ('commvault.contentstore/cloudaccounts'))|where (type !~ ('microsoft.liftrpilot/organizations'))|where (type !~ ('purestorage.block/storagepools/avsstoragecontainers'))|where (type !~ ('purestorage.block/reservations'))|where (type !~ ('purestorage.block/storagepools'))|where (type !~ ('solarwinds.observability/organizations'))|where (type !~ ('microsoft.agfoodplatform/farmbeats'))|where (type !~ ('microsoft.agricultureplatform/agriservices'))|where (type !~ ('microsoft.appsecurity/policies'))|where (type !~ ('microsoft.arc/allfairfax'))|where (type !~ ('microsoft.arc/all'))|where (type !~ ('microsoft.cdn/profiles/securitypolicies'))|where (type !~ ('microsoft.cdn/profiles/secrets'))|where (type !~ ('microsoft.cdn/profiles/rulesets'))|where (type !~ ('microsoft.cdn/profiles/rulesets/rules'))|where (type !~ ('microsoft.cdn/profiles/afdendpoints/routes'))|where (type !~ ('microsoft.cdn/profiles/origingroups'))|where (type !~ ('microsoft.cdn/profiles/origingroups/origins'))|where (type !~ ('microsoft.cdn/profiles/afdendpoints'))|where (type !~ ('microsoft.cdn/profiles/customdomains'))|where (type !~ ('microsoft.chaos/privateaccesses'))|where (type !~ ('microsoft.sovereign/transparencylogs'))|where (type !~ ('microsoft.compute/virtualmachineflexinstances'))|where (type !~ ('microsoft.compute/standbypoolinstance'))|where (type !~ ('microsoft.compute/computefleetscalesets'))|where (type !~ ('microsoft.compute/computefleetinstances'))|where (type !~ ('microsoft.containerservice/managedclusters/microsoft.kubernetesconfiguration/fluxconfigurations'))|where (type !~ ('microsoft.kubernetes/connectedclusters/microsoft.kubernetesconfiguration/fluxconfigurations'))|where (type !~ ('microsoft.containerservice/managedclusters/microsoft.kubernetesconfiguration/namespaces'))|where (type !~ ('microsoft.kubernetes/connectedclusters/microsoft.kubernetesconfiguration/namespaces'))|where (type !~ ('microsoft.containerservice/managedclusters/managednamespaces'))|where (type !~ ('microsoft.containerservice/managedclusters/microsoft.kubernetesconfiguration/extensions'))|where (type !~ ('microsoft.kubernetesconfiguration/extensions'))|where (type !~ ('microsoft.portalservices/extensions/deployments'))|where (type !~ ('microsoft.portalservices/extensions'))|where (type !~ ('microsoft.portalservices/extensions/slots'))|where (type !~ ('microsoft.portalservices/extensions/versions'))|where (type !~ ('microsoft.deviceregistry/devices'))|where (type !~ ('microsoft.deviceupdate/updateaccounts'))|where (type !~ ('microsoft.deviceupdate/updateaccounts/updates'))|where (type !~ ('microsoft.deviceupdate/updateaccounts/deviceclasses'))|where (type !~ ('microsoft.deviceupdate/updateaccounts/deployments'))|where (type !~ ('microsoft.deviceupdate/updateaccounts/agents'))|where (type !~ ('microsoft.deviceupdate/updateaccounts/activedeployments'))|where (type !~ ('private.devtunnels/tunnelplans'))|where (type !~ ('microsoft.discovery/datacontainers/dataassets'))|where (type !~ ('microsoft.documentdb/fleetspacepotentialdatabaseaccountswithlocations'))|where (type !~ ('microsoft.documentdb/fleetspacepotentialdatabaseaccounts'))|where (type !~ ('private.easm/workspaces'))|where (type !~ ('microsoft.workloads/epicvirtualinstances'))|where (type !~ ('microsoft.fairfieldgardens/provisioningresources'))|where (type !~ ('microsoft.fairfieldgardens/provisioningresources/provisioningpolicies'))|where (type !~ ('microsoft.healthmodel/healthmodels'))|where (type !~ ('microsoft.hybridcompute/machinessoftwareassurance'))|where (type !~ ('microsoft.hybridcompute/machinespaygo'))|where (type !~ ('microsoft.hybridcompute/machinesesu'))|where (type !~ ('microsoft.hybridcompute/machinessovereign'))|where (type !~ ('microsoft.hybridcompute/arcserverwithwac'))|where (type !~ ('microsoft.network/networkvirtualappliances'))|where (type !~ ('microsoft.network/virtualhubs')) or ((kind =~ ('routeserver')))|where (type !~ ('microsoft.devhub/iacprofiles'))|where (type !~ ('private.monitorgrafana/dashboards'))|where (type !~ ('microsoft.insights/diagnosticsettings'))|where not((type =~ ('microsoft.network/serviceendpointpolicies')) and ((kind =~ ('internal'))))|where (type !~ ('microsoft.resources/resourcegraphvisualizer'))|where (type !~ ('microsoft.orbital/l2connections'))|where (type !~ ('microsoft.orbital/groundstations'))|where (type !~ ('microsoft.orbital/edgesites'))|where (type !~ ('microsoft.recommendationsservice/accounts/modeling'))|where (type !~ ('microsoft.recommendationsservice/accounts/serviceendpoints'))|where (type !~ ('microsoft.recoveryservicesintd2/vaults'))|where (type !~ ('microsoft.recoveryservicesintd/vaults'))|where (type !~ ('microsoft.recoveryservicesbvtd2/vaults'))|where (type !~ ('microsoft.recoveryservicesbvtd/vaults'))|where (type !~ ('microsoft.billingbenefits/discounts'))|where (type !~ ('microsoft.billingbenefits/credits'))|where (type !~ ('microsoft.relationships/servicegrouprelationships'))|where (type !~ ('microsoft.resources/virtualsubscriptionsforresourcepicker'))|where (type !~ ('microsoft.resources/deletedresources'))|where (type !~ ('microsoft.deploymentmanager/rollouts'))|where (type !~ ('microsoft.features/featureprovidernamespaces/featureconfigurations'))|where (type !~ ('microsoft.saashub/cloudservices/hidden'))|where (type !~ ('microsoft.providerhub/providerregistrations'))|where (type !~ ('microsoft.providerhub/providerregistrations/customrollouts'))|where (type !~ ('microsoft.providerhub/providerregistrations/defaultrollouts'))|where (type !~ ('microsoft.edge/configurations'))|where (type !~ ('microsoft.storagediscovery/storagediscoveryworkspaces'))|where not((type =~ ('microsoft.synapse/workspaces/sqlpools')) and ((kind =~ ('v3'))))|where (type !~ ('microsoft.mission/virtualenclaves/workloads'))|where (type !~ ('microsoft.mission/virtualenclaves'))|where (type !~ ('microsoft.mission/communities/transithubs'))|where (type !~ ('microsoft.mission/virtualenclaves/enclaveendpoints'))|where (type !~ ('microsoft.mission/enclaveconnections'))|where (type !~ ('microsoft.mission/communities/communityendpoints'))|where (type !~ ('microsoft.mission/communities'))|where (type !~ ('microsoft.mission/catalogs'))|where (type !~ ('microsoft.mission/approvals'))|where (type !~ ('microsoft.workloads/insights'))|where (type !~ ('microsoft.cloudhealth/healthmodels'))|where (type !~ ('microsoft.connectedcache/enterprisemcccustomers/enterprisemcccachenodes'))|where not((type =~ ('microsoft.sql/servers')) and ((kind =~ ('v12.0,analytics'))))|where not((type =~ ('microsoft.sql/servers/databases')) and ((kind in~ ('system','v2.0,system','v12.0,system','v12.0,system,serverless','v12.0,user,datawarehouse,gen2,analytics'))))|project id,name,type,kind,location,subscriptionId,resourceGroup,tags|sort by (tolower(tostring(name))) asc";
                    const queryRequest = {
                        subscriptions,
                        query
                    };

                    graphClient.resources(queryRequest).then(response => {
                        const record = response.data as Record<string, StorageQueryResult>;
                        Object.values(record).forEach(data => {
                            this.storageAccountCache.set(data.id.toLowerCase(), data);
                        });
                        resolve();
                    })
                        .catch((reason) => {
                            reject(reason);
                        });

                });
            }

            await this.listStorageAccountsTask;
            const sa = this.storageAccountCache.get(resource.id.toLowerCase());
            if (!sa) {
                throw new Error(`Storage account not found: ${resource.id}`);
            }

            return new StorageAccountTreeItem(subContext, sa)
        });
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.storage/storageaccounts';
    }
}
