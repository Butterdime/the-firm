import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { VercelConnector } from '../connectors/vercel.js';
import { logAudit } from '../audit/logger.js';
import { sanitizeInput } from '../config/security.js';

export function createVercelTools(connector: VercelConnector): Tool[] {
  return [
    {
      name: 'vercel_list_projects',
      description: 'List all Vercel projects',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of projects to return',
            default: 20,
          },
        },
      },
    },
    {
      name: 'vercel_get_project',
      description: 'Get detailed information about a specific project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID or name',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'vercel_create_project',
      description: 'Create a new Vercel project',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name',
          },
          gitRepository: {
            type: 'object',
            description: 'Git repository connection (optional)',
            properties: {
              type: { type: 'string', enum: ['github', 'gitlab', 'bitbucket'] },
              repo: { type: 'string' },
            },
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'vercel_list_deployments',
      description: 'List deployments for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          limit: {
            type: 'number',
            default: 20,
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'vercel_get_deployment',
      description: 'Get detailed information about a specific deployment',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'Deployment ID or URL',
          },
        },
        required: ['deploymentId'],
      },
    },
    {
      name: 'vercel_create_deployment',
      description: 'Create a new deployment',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name',
          },
          files: {
            type: 'array',
            description: 'Files to deploy (array of { file: path, data: base64 })',
          },
          projectSettings: {
            type: 'object',
            description: 'Project settings',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'vercel_list_domains',
      description: 'List domains for a project',
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
      name: 'vercel_add_domain',
      description: 'Add a domain to a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          domain: {
            type: 'string',
            description: 'Domain name',
          },
        },
        required: ['projectId', 'domain'],
      },
    },
    {
      name: 'vercel_get_logs',
      description: 'Get deployment logs',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'Deployment ID',
          },
          follow: {
            type: 'boolean',
            description: 'Follow logs in real-time',
            default: false,
          },
        },
        required: ['deploymentId'],
      },
    },
  ];
}

export async function handleVercelTool(
  name: string,
  args: unknown,
  connector: VercelConnector
): Promise<unknown> {
  const startTime = Date.now();

  try {
    const client = connector.getClient();

    switch (name) {
      case 'vercel_list_projects': {
        const params = args as { limit?: number };
        const response = await client.get('/v9/projects', {
          params: { limit: params.limit || 20 },
        });
        logAudit({
          action: 'vercel_list_projects',
          platform: 'vercel',
          request: params,
          response: { count: response.data.projects?.length || 0 },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_get_project': {
        const params = args as { projectId: string };
        const projectId = sanitizeInput(params.projectId, 200);
        const response = await client.get(`/v9/projects/${projectId}`);
        logAudit({
          action: 'vercel_get_project',
          platform: 'vercel',
          request: params,
          response: { id: response.data.id, name: response.data.name },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_create_project': {
        const params = args as { name: string; gitRepository?: { type: string; repo: string } };
        const name = sanitizeInput(params.name, 200);
        const response = await client.post('/v9/projects', {
          name,
          ...(params.gitRepository && { gitRepository: params.gitRepository }),
        });
        logAudit({
          action: 'vercel_create_project',
          platform: 'vercel',
          request: params,
          response: { id: response.data.id, name: response.data.name },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_list_deployments': {
        const params = args as { projectId: string; limit?: number };
        const projectId = sanitizeInput(params.projectId, 200);
        const response = await client.get(`/v6/deployments`, {
          params: {
            projectId,
            limit: params.limit || 20,
          },
        });
        logAudit({
          action: 'vercel_list_deployments',
          platform: 'vercel',
          request: params,
          response: { count: response.data.deployments?.length || 0 },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_get_deployment': {
        const params = args as { deploymentId: string };
        const deploymentId = sanitizeInput(params.deploymentId, 200);
        const response = await client.get(`/v13/deployments/${deploymentId}`);
        logAudit({
          action: 'vercel_get_deployment',
          platform: 'vercel',
          request: params,
          response: { id: response.data.id, state: response.data.readyState },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_create_deployment': {
        const params = args as { name: string; files?: Array<{ file: string; data: string }>; projectSettings?: unknown };
        const name = sanitizeInput(params.name, 200);
        const response = await client.post('/v13/deployments', {
          name,
          files: params.files || [],
          projectSettings: params.projectSettings || {},
        });
        logAudit({
          action: 'vercel_create_deployment',
          platform: 'vercel',
          request: { name, hasFiles: !!params.files },
          response: { id: response.data.id, url: response.data.url },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_list_domains': {
        const params = args as { projectId: string };
        const projectId = sanitizeInput(params.projectId, 200);
        const response = await client.get(`/v9/projects/${projectId}/domains`);
        logAudit({
          action: 'vercel_list_domains',
          platform: 'vercel',
          request: params,
          response: { count: response.data.domains?.length || 0 },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_add_domain': {
        const params = args as { projectId: string; domain: string };
        const projectId = sanitizeInput(params.projectId, 200);
        const domain = sanitizeInput(params.domain, 253);
        const response = await client.post(`/v9/projects/${projectId}/domains`, {
          name: domain,
        });
        logAudit({
          action: 'vercel_add_domain',
          platform: 'vercel',
          request: params,
          response: { domain: response.data.name },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      case 'vercel_get_logs': {
        const params = args as { deploymentId: string; follow?: boolean };
        const deploymentId = sanitizeInput(params.deploymentId, 200);
        const response = await client.get(`/v2/deployments/${deploymentId}/events`);
        logAudit({
          action: 'vercel_get_logs',
          platform: 'vercel',
          request: params,
          response: { hasLogs: !!response.data },
          success: true,
          duration: Date.now() - startTime,
        });
        return response.data;
      }

      default:
        throw new Error(`Unknown Vercel tool: ${name}`);
    }
  } catch (error) {
    logAudit({
      action: name,
      platform: 'vercel',
      request: args,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

