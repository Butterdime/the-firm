import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RailwayConnector } from '../connectors/railway.js';
import { logAudit } from '../audit/logger.js';
import { sanitizeInput } from '../config/security.js';

export function createRailwayTools(connector: RailwayConnector): Tool[] {
  return [
    {
      name: 'railway_list_projects',
      description: 'List all Railway projects',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'railway_get_project',
      description: 'Get detailed information about a specific project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'railway_list_services',
      description: 'List services in a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'railway_get_service',
      description: 'Get detailed information about a specific service',
      inputSchema: {
        type: 'object',
        properties: {
          serviceId: {
            type: 'string',
            description: 'Service ID',
          },
        },
        required: ['serviceId'],
      },
    },
    {
      name: 'railway_get_logs',
      description: 'Get logs from a service',
      inputSchema: {
        type: 'object',
        properties: {
          serviceId: {
            type: 'string',
            description: 'Service ID',
          },
          limit: {
            type: 'number',
            description: 'Number of log lines to retrieve',
            default: 100,
          },
        },
        required: ['serviceId'],
      },
    },
    {
      name: 'railway_create_deployment',
      description: 'Trigger a new deployment for a service',
      inputSchema: {
        type: 'object',
        properties: {
          serviceId: {
            type: 'string',
            description: 'Service ID',
          },
        },
        required: ['serviceId'],
      },
    },
    {
      name: 'railway_get_deployment',
      description: 'Get deployment status',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'Deployment ID',
          },
        },
        required: ['deploymentId'],
      },
    },
    {
      name: 'railway_list_variables',
      description: 'List environment variables for a service',
      inputSchema: {
        type: 'object',
        properties: {
          serviceId: {
            type: 'string',
            description: 'Service ID',
          },
        },
        required: ['serviceId'],
      },
    },
    {
      name: 'railway_set_variable',
      description: 'Set an environment variable for a service',
      inputSchema: {
        type: 'object',
        properties: {
          serviceId: {
            type: 'string',
            description: 'Service ID',
          },
          key: {
            type: 'string',
            description: 'Variable name',
          },
          value: {
            type: 'string',
            description: 'Variable value',
          },
        },
        required: ['serviceId', 'key', 'value'],
      },
    },
  ];
}

export async function handleRailwayTool(
  name: string,
  args: unknown,
  connector: RailwayConnector
): Promise<unknown> {
  const startTime = Date.now();

  try {
    const client = connector.getClient();

    switch (name) {
      case 'railway_list_projects': {
        const response = await client.post('', {
          query: `
            query {
              projects {
                edges {
                  node {
                    id
                    name
                    description
                    createdAt
                  }
                }
              }
            }
          `,
        });
        logAudit({
          action: 'railway_list_projects',
          platform: 'railway',
          request: {},
          response: {
            count: response.data.data?.projects?.edges?.length || 0,
          },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data?.projects?.edges?.map((e: { node: unknown }) => e.node) || [];
      }

      case 'railway_get_project': {
        const params = args as { projectId: string };
        const projectId = sanitizeInput(params.projectId, 200);
        const response = await client.post('', {
          query: `
            query($id: String!) {
              project(id: $id) {
                id
                name
                description
                createdAt
                services {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          `,
          variables: { id: projectId },
        });
        logAudit({
          action: 'railway_get_project',
          platform: 'railway',
          request: params,
          response: { id: response.data.data?.project?.id },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data?.project;
      }

      case 'railway_list_services': {
        const params = args as { projectId: string };
        const projectId = sanitizeInput(params.projectId, 200);
        const response = await client.post('', {
          query: `
            query($projectId: String!) {
              project(id: $projectId) {
                services {
                  edges {
                    node {
                      id
                      name
                      serviceType
                      createdAt
                    }
                  }
                }
              }
            }
          `,
          variables: { projectId },
        });
        logAudit({
          action: 'railway_list_services',
          platform: 'railway',
          request: params,
          response: {
            count: response.data.data?.project?.services?.edges?.length || 0,
          },
          success: true,
          duration: Date.now() - startTime,
        });
        return (
          response.data.data?.project?.services?.edges?.map((e: { node: unknown }) => e.node) || []
        );
      }

      case 'railway_get_service': {
        const params = args as { serviceId: string };
        const serviceId = sanitizeInput(params.serviceId, 200);
        const response = await client.post('', {
          query: `
            query($id: String!) {
              service(id: $id) {
                id
                name
                serviceType
                createdAt
                project {
                  id
                  name
                }
              }
            }
          `,
          variables: { id: serviceId },
        });
        logAudit({
          action: 'railway_get_service',
          platform: 'railway',
          request: params,
          response: { id: response.data.data?.service?.id },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data?.service;
      }

      case 'railway_get_logs': {
        const params = args as { serviceId: string; limit?: number };
        const serviceId = sanitizeInput(params.serviceId, 200);
        // Railway logs are typically accessed via a different endpoint
        // This is a placeholder - actual implementation may vary
        const response = await client.post('', {
          query: `
            query($serviceId: String!) {
              service(id: $serviceId) {
                deployments {
                  edges {
                    node {
                      id
                      createdAt
                      status
                    }
                  }
                }
              }
            }
          `,
          variables: { serviceId },
        });
        logAudit({
          action: 'railway_get_logs',
          platform: 'railway',
          request: params,
          response: { hasData: !!response.data.data },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data;
      }

      case 'railway_create_deployment': {
        const params = args as { serviceId: string };
        const serviceId = sanitizeInput(params.serviceId, 200);
        const response = await client.post('', {
          query: `
            mutation($serviceId: String!) {
              deploymentCreate(input: { serviceId: $serviceId }) {
                id
                status
                createdAt
              }
            }
          `,
          variables: { serviceId },
        });
        logAudit({
          action: 'railway_create_deployment',
          platform: 'railway',
          request: params,
          response: { id: response.data.data?.deploymentCreate?.id },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data?.deploymentCreate;
      }

      case 'railway_get_deployment': {
        const params = args as { deploymentId: string };
        const deploymentId = sanitizeInput(params.deploymentId, 200);
        const response = await client.post('', {
          query: `
            query($id: String!) {
              deployment(id: $id) {
                id
                status
                createdAt
                finishedAt
              }
            }
          `,
          variables: { id: deploymentId },
        });
        logAudit({
          action: 'railway_get_deployment',
          platform: 'railway',
          request: params,
          response: { id: response.data.data?.deployment?.id },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data?.deployment;
      }

      case 'railway_list_variables': {
        const params = args as { serviceId: string };
        const serviceId = sanitizeInput(params.serviceId, 200);
        const response = await client.post('', {
          query: `
            query($serviceId: String!) {
              service(id: $serviceId) {
                variables {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
              }
            }
          `,
          variables: { serviceId },
        });
        logAudit({
          action: 'railway_list_variables',
          platform: 'railway',
          request: params,
          response: {
            count: response.data.data?.service?.variables?.edges?.length || 0,
          },
          success: true,
          duration: Date.now() - startTime,
        });
        return (
          response.data.data?.service?.variables?.edges?.map((e: { node: unknown }) => e.node) || []
        );
      }

      case 'railway_set_variable': {
        const params = args as { serviceId: string; key: string; value: string };
        const serviceId = sanitizeInput(params.serviceId, 200);
        const key = sanitizeInput(params.key, 200);
        const response = await client.post('', {
          query: `
            mutation($serviceId: String!, $key: String!, $value: String!) {
              variableUpsert(input: { serviceId: $serviceId, key: $key, value: $value }) {
                key
                value
              }
            }
          `,
          variables: {
            serviceId,
            key,
            value: params.value,
          },
        });
        logAudit({
          action: 'railway_set_variable',
          platform: 'railway',
          request: { serviceId, key },
          response: { success: !!response.data.data?.variableUpsert },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data.data?.variableUpsert;
      }

      default:
        throw new Error(`Unknown Railway tool: ${name}`);
    }
  } catch (error) {
    logAudit({
      action: name,
      platform: 'railway',
      request: args,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

