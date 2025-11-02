# MCP Server Integrations

A secure, modular Model Context Protocol (MCP) server that enables integration with GitHub, Vercel, Railway, and Google AI Studio/Cloud. This server runs as a standalone process and can be configured in Cursor or other MCP-compatible clients.

## Features

- **GitHub Integration**: Repository management, pull requests, deployments, issues, code search
- **Vercel Integration**: Project management, deployments, domains, logs
- **Railway Integration**: Service management, deployments, logs, environment variables
- **Google AI Integration**: Content generation, model management, image analysis, embeddings
- **Security**: Token encryption, audit logging, rate limiting, input validation
- **Modular Architecture**: Easy to extend with new platform connectors

## Prerequisites

Before setting up the MCP server, ensure you have the following installed:

### Required Software

1. **Xcode Command Line Tools** (macOS):
   ```bash
   xcode-select --install
   ```

2. **Homebrew** (macOS package manager):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. **Git**:
   ```bash
   brew install git
   ```

4. **Python 3** (for some dependencies):
   ```bash
   brew install python@3
   ```

5. **Node.js** (v18 or higher):
   ```bash
   brew install node
   ```

6. **Docker** (optional, for containerized deployment):
   ```bash
   brew install docker
   ```

## Installation

1. **Navigate to the MCP server directory**:
   ```bash
   cd mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the TypeScript code**:
   ```bash
   npm run build
   ```

## Configuration

### 1. Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials. **NEVER commit this file to version control.**

### 2. Platform Credentials Setup

#### GitHub

**Option 1: Personal Access Token (Simpler)**

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `admin:repo_hook`
4. Copy the token and add to `.env`:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```

**Option 2: OAuth App (For OAuth Flow)**

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set:
   - **Application name**: MCP Server
   - **Homepage URL**: `http://127.0.0.1:3000`
   - **Authorization callback URL**: `http://127.0.0.1:3000/auth/github/callback`
4. Copy Client ID and Client Secret to `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_REDIRECT_URI=http://127.0.0.1:3000/auth/github/callback
   ```

#### Vercel

1. Go to [Vercel Account Settings > Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Give it a name (e.g., "MCP Server")
4. Copy the token and add to `.env`:
   ```
   VERCEL_TOKEN=your_vercel_token_here
   ```

#### Railway

1. Go to [Railway Account > Tokens](https://railway.app/account/tokens)
2. Click "New Token"
3. Give it a name (e.g., "MCP Server")
4. Copy the token and add to `.env`:
   ```
   RAILWAY_TOKEN=your_railway_token_here
   ```

#### Google AI Studio/Cloud

**Option 1: API Key (Simpler, Recommended)**

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key"
3. Create a new API key or use an existing one
4. Copy the API key and add to `.env`:
   ```
   GOOGLE_AI_API_KEY=your_api_key_here
   ```

**Option 2: OAuth2 (For Broader Access)**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Generative Language API"
4. Go to "Credentials" > "Create Credentials" > "OAuth client ID"
5. Set application type to "Web application"
6. Add redirect URI: `http://127.0.0.1:3000/auth/google/callback`
7. Copy Client ID and Client Secret to `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:3000/auth/google/callback
   ```

### 3. Security Configuration

Generate an encryption key for token storage:

```bash
openssl rand -hex 32
```

Add to `.env`:
```
ENCRYPTION_KEY=your_generated_key_here
```

## Usage

### Running the Server

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm run build
npm start
```

The server runs via stdio and will wait for MCP client connections.

### Cursor Configuration

Add the MCP server to your Cursor settings:

1. Open Cursor Settings (Cmd+, on Mac)
2. Search for "MCP" or "Model Context Protocol"
3. Add a new MCP server configuration:

```json
{
  "mcpServers": {
    "platform-integrations": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token",
        "VERCEL_TOKEN": "your_token",
        "RAILWAY_TOKEN": "your_token",
        "GOOGLE_AI_API_KEY": "your_key",
        "ENCRYPTION_KEY": "your_key"
      }
    }
  }
}
```

**Or use environment variables from `.env` file**:

```json
{
  "mcpServers": {
    "platform-integrations": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

Make sure the `.env` file is in the `mcp-server` directory.

4. **Restart Cursor** for changes to take effect.

### Using the Tools in Cursor

Once configured, you can use the MCP tools in Cursor's chat:

- `github_list_repositories` - List your GitHub repositories
- `github_create_pull_request` - Create a new pull request
- `vercel_list_projects` - List Vercel projects
- `railway_list_services` - List Railway services
- `google_ai_generate_content` - Generate content with Google AI

Example:
```
@github_list_repositories List my repositories
```

## Available Tools

### GitHub Tools

- `github_list_repositories` - List repositories
- `github_get_repository` - Get repository details
- `github_create_pull_request` - Create PR
- `github_list_pull_requests` - List PRs
- `github_merge_pull_request` - Merge PR
- `github_create_deployment` - Create deployment
- `github_list_deployments` - List deployments
- `github_create_issue` - Create issue
- `github_list_issues` - List issues
- `github_search_code` - Search code

### Vercel Tools

- `vercel_list_projects` - List projects
- `vercel_get_project` - Get project details
- `vercel_create_project` - Create project
- `vercel_list_deployments` - List deployments
- `vercel_get_deployment` - Get deployment details
- `vercel_create_deployment` - Create deployment
- `vercel_list_domains` - List domains
- `vercel_add_domain` - Add domain
- `vercel_get_logs` - Get deployment logs

### Railway Tools

- `railway_list_projects` - List projects
- `railway_get_project` - Get project details
- `railway_list_services` - List services
- `railway_get_service` - Get service details
- `railway_get_logs` - Get service logs
- `railway_create_deployment` - Trigger deployment
- `railway_get_deployment` - Get deployment status
- `railway_list_variables` - List environment variables
- `railway_set_variable` - Set environment variable

### Google AI Tools

- `google_ai_generate_content` - Generate content
- `google_ai_list_models` - List available models
- `google_ai_get_model` - Get model details
- `google_ai_create_prompt` - Create prompt template
- `google_ai_analyze_image` - Analyze image
- `google_ai_stream_content` - Stream generated content
- `google_ai_embed_text` - Generate embeddings

## Security Best Practices

1. **Never Commit Secrets**: Always keep `.env` in `.gitignore`
2. **Rotate Tokens Regularly**: Update tokens every 90 days
3. **Use Minimal Scopes**: Only grant necessary permissions
4. **Enable Rate Limiting**: Prevents abuse (enabled by default)
5. **Review Audit Logs**: Check `audit-logs/audit.log` regularly
6. **Network Security**: Server only binds to localhost (127.0.0.1)
7. **Token Encryption**: All stored tokens are encrypted using AES-256-GCM

## Troubleshooting

### Server Won't Start

- Check that all required environment variables are set
- Verify credentials are valid (test with platform APIs directly)
- Check logs in `audit-logs/error.log`

### Tools Not Appearing in Cursor

- Verify MCP server configuration in Cursor settings
- Ensure the server is running (`npm run dev` or `npm start`)
- Check that absolute path in Cursor config is correct
- Restart Cursor after configuration changes

### Authentication Errors

- Verify tokens are valid and not expired
- Check OAuth scopes/permissions are correct
- For GitHub, ensure token has required scopes: `repo`, `workflow`, `admin:repo_hook`

### Rate Limiting Issues

- Adjust `RATE_LIMIT_POINTS_PER_SECOND` in `.env`
- Check platform-specific rate limits (GitHub, Vercel, etc.)

## Development

### Project Structure

```
mcp-server/
├── src/
│   ├── index.ts                 # Main server entry point
│   ├── config/                  # Configuration modules
│   ├── connectors/              # Platform connectors
│   ├── tools/                   # MCP tool implementations
│   ├── auth/                    # Authentication modules
│   ├── audit/                   # Audit logging
│   └── utils/                   # Utility functions
├── dist/                        # Compiled JavaScript (generated)
├── audit-logs/                  # Audit logs (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Adding a New Platform

1. Create a new connector in `src/connectors/`
2. Extend `BaseConnector` class
3. Create tools in `src/tools/`
4. Register connector and tools in `src/index.ts`

### Running Tests

```bash
npm test
```

## License

MIT

## Support

For issues or questions:
- Check audit logs: `mcp-server/audit-logs/`
- Review platform API documentation
- Check MCP specification: https://modelcontextprotocol.io/

