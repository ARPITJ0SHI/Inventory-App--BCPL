const { spawn } = require('child_process');
const path = require('path');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

// Path to compiled MCP server JS
const MCP_SERVER_PATH = path.join(__dirname, '../../mcp-server/dist/index.js');

let client;
let transport;
let process;

async function startMCPClient() {
    if (client) return client;

    console.log('Starting MCP Client...');
    console.log('MCP Server Path:', MCP_SERVER_PATH);

    transport = new StdioClientTransport({
        command: "node",
        args: [MCP_SERVER_PATH],
        env: process.env
    });

    client = new Client({
        name: "express-backend-client",
        version: "1.0.0",
    }, {
        capabilities: {} // Agent capabilities
    });

    await client.connect(transport);
    console.log('MCP Client Connected to Server');
    return client;
}

async function listTools() {
    if (!client) await startMCPClient();
    return await client.listTools();
}

async function callTool(name, args) {
    if (!client) await startMCPClient();
    return await client.callTool({
        name: name,
        arguments: args
    });
}

module.exports = { startMCPClient, listTools, callTool };
