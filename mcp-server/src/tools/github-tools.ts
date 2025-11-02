import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GitHubConnector } from '../connectors/github.js';
import { validateRepository, validatePullRequest } from '../utils/validation.js';
import { logAudit } from '../audit/logger.js';

export function createGitHubTools(connector: GitHubConnector): Tool[] {
  return [
    {
      name: 'github_list_repositories',
      description: 'List all repositories accessible to the authenticated user or organization',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Owner username or organization name (optional, defaults to authenticated user)',
          },
          type: {
            type: 'string',
            enum: ['all', 'owner', 'member'],
            description: 'Type of repositories to list',
            default: 'all',
          },
          sort: {
            type: 'string',
            enum: ['created', 'updated', 'pushed', 'full_name'],
            description: 'Sort repositories by this field',
            default: 'updated',
          },
          per_page: {
            type: 'number',
            description: 'Number of results per page (max 100)',
            default: 30,
          },
        },
      },
    },
    {
      name: 'github_get_repository',
      description: 'Get detailed information about a specific repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner username or organization',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
      },
      required: ['owner', 'repo'],
    },
    {
      name: 'github_create_pull_request',
      description: 'Create a new pull request',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          title: {
            type: 'string',
            description: 'Pull request title',
          },
          body: {
            type: 'string',
            description: 'Pull request body/description',
          },
          head: {
            type: 'string',
            description: 'Branch name containing changes',
          },
          base: {
            type: 'string',
            description: 'Branch to merge into',
            default: 'main',
          },
        },
        required: ['owner', 'repo', 'title', 'head'],
      },
    },
    {
      name: 'github_list_pull_requests',
      description: 'List pull requests for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          per_page: {
            type: 'number',
            default: 30,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    {
      name: 'github_merge_pull_request',
      description: 'Merge a pull request (with safety checks)',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          pull_number: {
            type: 'number',
            description: 'Pull request number',
          },
          merge_method: {
            type: 'string',
            enum: ['merge', 'squash', 'rebase'],
            default: 'merge',
          },
        },
        required: ['owner', 'repo', 'pull_number'],
      },
    },
    {
      name: 'github_create_deployment',
      description: 'Create a GitHub deployment',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          ref: {
            type: 'string',
            description: 'Branch or tag to deploy',
          },
          environment: {
            type: 'string',
            default: 'production',
          },
          description: {
            type: 'string',
            description: 'Deployment description',
          },
        },
        required: ['owner', 'repo', 'ref'],
      },
    },
    {
      name: 'github_list_deployments',
      description: 'List deployments for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          environment: {
            type: 'string',
            description: 'Filter by environment',
          },
          per_page: {
            type: 'number',
            default: 30,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    {
      name: 'github_create_issue',
      description: 'Create a new issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          title: {
            type: 'string',
            description: 'Issue title',
          },
          body: {
            type: 'string',
            description: 'Issue body',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issue labels',
          },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
    {
      name: 'github_list_issues',
      description: 'List issues for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          per_page: {
            type: 'number',
            default: 30,
          },
        },
        required: ['owner', 'repo'],
      },
    },
    {
      name: 'github_search_code',
      description: 'Search code across repositories',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (GitHub search syntax)',
          },
          per_page: {
            type: 'number',
            default: 30,
          },
        },
        required: ['query'],
      },
    },
  ];
}

export async function handleGitHubTool(
  name: string,
  args: unknown,
  connector: GitHubConnector
): Promise<unknown> {
  const startTime = Date.now();

  try {
    const octokit = connector.getOctokit();

    switch (name) {
      case 'github_list_repositories': {
        const params = args as { owner?: string; type?: string; sort?: string; per_page?: number };
        const result = await octokit.repos.listForAuthenticatedUser({
          type: (params.type as 'all' | 'owner' | 'member') || 'all',
          sort: (params.sort as 'created' | 'updated' | 'pushed' | 'full_name') || 'updated',
          per_page: params.per_page || 30,
        });
        logAudit({
          action: 'github_list_repositories',
          platform: 'github',
          request: params,
          response: { count: result.data.length },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_get_repository': {
        const { owner, repo } = validateRepository(args as { owner: string; repo: string });
        const result = await octokit.repos.get({ owner, repo });
        logAudit({
          action: 'github_get_repository',
          platform: 'github',
          request: { owner, repo },
          response: { id: result.data.id, name: result.data.name },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_create_pull_request': {
        const params = validatePullRequest(args);
        const result = await octokit.pulls.create({
          owner: params.owner,
          repo: params.repo,
          title: params.title,
          body: params.body || '',
          head: params.head,
          base: params.base,
        });
        logAudit({
          action: 'github_create_pull_request',
          platform: 'github',
          request: params,
          response: { number: result.data.number, url: result.data.html_url },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_list_pull_requests': {
        const { owner, repo } = validateRepository(args as { owner: string; repo: string });
        const params = args as { state?: string; per_page?: number };
        const result = await octokit.pulls.list({
          owner,
          repo,
          state: (params.state as 'open' | 'closed' | 'all') || 'open',
          per_page: params.per_page || 30,
        });
        logAudit({
          action: 'github_list_pull_requests',
          platform: 'github',
          request: { owner, repo, ...params },
          response: { count: result.data.length },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_merge_pull_request': {
        const params = args as { owner: string; repo: string; pull_number: number; merge_method?: string };
        const { owner, repo } = validateRepository(params);
        const result = await octokit.pulls.merge({
          owner,
          repo,
          pull_number: params.pull_number,
          merge_method: (params.merge_method as 'merge' | 'squash' | 'rebase') || 'merge',
        });
        logAudit({
          action: 'github_merge_pull_request',
          platform: 'github',
          request: params,
          response: { merged: result.data.merged, sha: result.data.sha },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_create_deployment': {
        const params = args as { owner: string; repo: string; ref: string; environment?: string; description?: string };
        const { owner, repo } = validateRepository(params);
        const result = await octokit.repos.createDeployment({
          owner,
          repo,
          ref: params.ref,
          environment: params.environment || 'production',
          description: params.description,
          auto_merge: false,
        });
        logAudit({
          action: 'github_create_deployment',
          platform: 'github',
          request: params,
          response: { id: result.data.id, status: result.data.status },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_list_deployments': {
        const { owner, repo } = validateRepository(args as { owner: string; repo: string });
        const params = args as { environment?: string; per_page?: number };
        const result = await octokit.repos.listDeployments({
          owner,
          repo,
          environment: params.environment,
          per_page: params.per_page || 30,
        });
        logAudit({
          action: 'github_list_deployments',
          platform: 'github',
          request: { owner, repo, ...params },
          response: { count: result.data.length },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_create_issue': {
        const params = args as { owner: string; repo: string; title: string; body?: string; labels?: string[] };
        const { owner, repo } = validateRepository(params);
        const result = await octokit.issues.create({
          owner,
          repo,
          title: params.title,
          body: params.body || '',
          labels: params.labels,
        });
        logAudit({
          action: 'github_create_issue',
          platform: 'github',
          request: params,
          response: { number: result.data.number, url: result.data.html_url },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_list_issues': {
        const { owner, repo } = validateRepository(args as { owner: string; repo: string });
        const params = args as { state?: string; per_page?: number };
        const result = await octokit.issues.listForRepo({
          owner,
          repo,
          state: (params.state as 'open' | 'closed' | 'all') || 'open',
          per_page: params.per_page || 30,
        });
        logAudit({
          action: 'github_list_issues',
          platform: 'github',
          request: { owner, repo, ...params },
          response: { count: result.data.length },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      case 'github_search_code': {
        const params = args as { query: string; per_page?: number };
        const result = await octokit.search.code({
          q: params.query,
          per_page: params.per_page || 30,
        });
        logAudit({
          action: 'github_search_code',
          platform: 'github',
          request: params,
          response: { count: result.data.total_count },
          success: true,
          duration: Date.now() - startTime,
        });
        return result.data;
      }

      default:
        throw new Error(`Unknown GitHub tool: ${name}`);
    }
  } catch (error) {
    logAudit({
      action: name,
      platform: 'github',
      request: args,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    });
    throw error;
  }
}

