"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const db_js_1 = require("./db.js");
const models_js_1 = require("./models.js");
// Initialize MCP Server
const server = new mcp_js_1.McpServer({
    name: "balaji-inventory-mcp",
    version: "1.0.0",
});
// Tool: Search Inventory
server.tool("inventory_search", {
    query: zod_1.z.string().describe("Product name to search (e.g., 'Harpic')"),
    location: zod_1.z.enum(["shop", "factory", "godown"]).optional().describe("Filter by location"),
}, async ({ query, location }) => {
    const filter = { itemName: { $regex: query, $options: "i" } };
    if (location)
        filter.location = location;
    const items = await models_js_1.Stock.find(filter).limit(5);
    if (items.length === 0)
        return { content: [{ type: "text", text: `No stock found for ${query}.` }] };
    const result = items.map(i => `${i.itemName} (${i.location}): ${i.quantity} ${i.unit}`).join("\n");
    return { content: [{ type: "text", text: result }] };
});
// Tool: Update Inventory (Write)
// Action: 'add' | 'reduce' | 'set'
server.tool("inventory_update", {
    itemName: zod_1.z.string().describe("Exact name of the item"),
    quantityChange: zod_1.z.number().describe("Amount to add (positive) or remove (negative-ish, handled by action)"),
    action: zod_1.z.enum(["add", "reduce", "set"]).describe("Action to perform"),
    location: zod_1.z.enum(["shop", "factory", "godown"]).describe("Target location"),
    userRole: zod_1.z.string().describe("Role of the user requesting update (for verify)"),
}, async ({ itemName, quantityChange, action, location, userRole }) => {
    // RBAC Check
    if (!["superadmin", "admin", "manager"].includes(userRole)) {
        return { content: [{ type: "text", text: "Error: You do not have permission to update stock." }], isError: true };
    }
    const item = await models_js_1.Stock.findOne({ itemName: { $regex: `^${itemName}$`, $options: "i" }, location });
    if (!item) {
        // If 'add', maybe create? For now only update existing.
        return { content: [{ type: "text", text: `Error: Item '${itemName}' not found in ${location}.` }], isError: true };
    }
    let newQty = item.quantity;
    if (action === 'add')
        newQty += quantityChange;
    else if (action === 'reduce')
        newQty -= quantityChange;
    else if (action === 'set')
        newQty = quantityChange;
    if (newQty < 0)
        return { content: [{ type: "text", text: `Error: Insufficient stock. Current: ${item.quantity}` }], isError: true };
    item.quantity = newQty;
    await item.save();
    return { content: [{ type: "text", text: `Success: Updated ${itemName} in ${location}. New Quantity: ${newQty}` }] };
});
// Tool: List Orders
server.tool("orders_list", {
    limit: zod_1.z.number().min(1).max(20).default(5).describe("Number of recent orders to fetch")
}, async ({ limit }) => {
    const orders = await models_js_1.Order.find().sort({ createdAt: -1 }).limit(limit);
    if (orders.length === 0)
        return { content: [{ type: "text", text: "No recent orders found." }] };
    const result = orders.map(o => {
        const itemsSummary = o.items.map(i => `${i.quantity}x ${i.productName}`).join(", ");
        return `Order from ${o.vendorName} (${o.status}): ${itemsSummary}`;
    }).join("\n---\n");
    return { content: [{ type: "text", text: result }] };
});
// Start Server
async function main() {
    await (0, db_js_1.connectDB)();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server running on stdio");
}
main();
//# sourceMappingURL=index.js.map