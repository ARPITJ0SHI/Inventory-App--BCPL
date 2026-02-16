import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connectDB } from "./db.js";
import { Stock, Order } from "./models.js";

// Initialize MCP Server
const server = new McpServer({
    name: "balaji-inventory-mcp",
    version: "1.0.0",
});

// Tool: Search Inventory
// NOTE: Stock collection has {location, items: [{name, quantity, unit}]}
server.tool(
    "inventory_search",
    {
        query: z.string().describe("Product name to search (e.g., 'bleach', 'Harpic')"),
        location: z.enum(["shop", "factory"]).optional().describe("Filter by location (shop or factory)"),
    },
    async ({ query, location }) => {
        // Convert lowercase location to capitalized (DB uses Shop/Factory)
        const dbLocation = location ? location.charAt(0).toUpperCase() + location.slice(1) : null;

        // 1. Regex Search (Exact/Partial)
        const filter: any = { "items.name": { $regex: query, $options: "i" } };
        if (dbLocation) filter.location = dbLocation;

        const stockDocs = await Stock.find(filter);
        let results: string[] = [];

        // Helper to formatting results
        const formatItem = (item: any, loc: string) => `${item.name} (${loc}): ${item.quantity} ${item.unit}`;

        if (stockDocs.length > 0) {
            for (const doc of stockDocs) {
                const matchingItems = (doc as any).items.filter((item: any) =>
                    new RegExp(query, "i").test(item.name)
                );
                for (const item of matchingItems) {
                    results.push(formatItem(item, (doc as any).location));
                }
            }
        }

        // 2. Fuzzy Search Fallback if Regex failed
        if (results.length === 0) {
            console.log(`[MCP] Regex failed for '${query}'. Trying fuzzy search...`);

            // Fetch ALL stock (optimized: projection could be used, but stock is small)
            const allStock = await Stock.find(dbLocation ? { location: dbLocation } : {});
            const allItems: { item: any, loc: string, score: number }[] = [];

            const cleanQuery = query.toLowerCase().trim();

            for (const doc of allStock) {
                for (const item of (doc as any).items) {
                    const itemName = item.name.toLowerCase();
                    const dist = levenshtein(cleanQuery, itemName);

                    // Allow distance based on length
                    // Short words (<=4): dist must be 0 or 1
                    // Medium (5-8): dist <= 2
                    // Long (>8): dist <= 4 (allow more typos)
                    let threshold = 3;
                    if (cleanQuery.length <= 4) threshold = 1;
                    if (cleanQuery.length > 8) threshold = 4;

                    if (dist <= threshold) {
                        // Prioritize prefix match or very close match
                        allItems.push({ item, loc: (doc as any).location, score: dist });
                    }
                }
            }

            // Sort by score (lower distance is better)
            allItems.sort((a, b) => a.score - b.score);

            // Take top 5
            results = allItems.slice(0, 5).map(m => formatItem(m.item, m.loc));
        }

        if (results.length === 0) {
            return { content: [{ type: "text", text: `No stock found for "${query}" (checked spelling variations).` }] };
        }

        return { content: [{ type: "text", text: results.join("\n") }] };
    }
);

// Helper: Levenshtein Distance
function levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Tool: Update Inventory (Write)
// Action: 'add' | 'reduce' | 'set'
server.tool(
    "inventory_update",
    {
        itemName: z.string().describe("Name of the item to update"),
        quantityChange: z.number().describe("Amount to add/reduce/set"),
        action: z.enum(["add", "reduce", "set"]).describe("Action to perform"),
        location: z.enum(["shop", "factory"]).describe("Target location"),
        userRole: z.string().default("viewer").describe("Role of the user (for permissions)"),
    },
    async ({ itemName, quantityChange, action, location, userRole }) => {
        // RBAC Check
        const allowedRoles = ["super_admin", "khushal", "factory_manager", "shop_manager", "admin", "superadmin"]; // Added variations
        if (!allowedRoles.includes(userRole)) {
            return { content: [{ type: "text", text: `Error: You do not have permission to update stock. Role: ${userRole}` }], isError: true };
        }

        // Convert to DB format (capitalized)
        const dbLocation = location.charAt(0).toUpperCase() + location.slice(1);

        // Find the stock document for this location
        const stockDoc = await Stock.findOne({ location: dbLocation });
        if (!stockDoc) {
            return { content: [{ type: "text", text: `Error: Location '${dbLocation}' not found.` }], isError: true };
        }

        // Find the item in the items array (Smart Search)
        const itemsArray = (stockDoc as any).items;
        let itemIndex = -1;

        // 1. Exact/Regex Match
        itemIndex = itemsArray.findIndex((i: any) =>
            new RegExp(`^${itemName.trim()}$`, "i").test(i.name.trim())
        );

        // 2. Fuzzy Match Fallback
        if (itemIndex === -1) {
            const cleanQuery = itemName.toLowerCase().trim();
            const candidates = itemsArray.map((item: any, idx: number) => ({
                item, idx,
                score: levenshtein(cleanQuery, item.name.toLowerCase())
            })).filter((c: any) => {
                let threshold = 3;
                if (cleanQuery.length <= 4) threshold = 1;
                if (cleanQuery.length > 8) threshold = 4;
                return c.score <= threshold;
            }).sort((a: any, b: any) => a.score - b.score);

            if (candidates.length === 1) {
                itemIndex = candidates[0].idx;
                // Proceed with auto-corrected item
            } else if (candidates.length > 1) {
                // Return Ambiguity Error for Frontend to handle
                const names = candidates.map((c: any) => c.item.name);
                return { content: [{ type: "text", text: `AMBIGUOUS:${JSON.stringify(names)}` }], isError: true };
            }
        }

        if (itemIndex === -1) {
            return { content: [{ type: "text", text: `Error: Item '${itemName}' not found in ${dbLocation}.` }], isError: true };
        }

        const item = itemsArray[itemIndex];
        let newQty = item.quantity;

        if (action === 'add') newQty += quantityChange;
        else if (action === 'reduce') newQty -= quantityChange;
        else if (action === 'set') newQty = quantityChange;

        if (newQty < 0) {
            return { content: [{ type: "text", text: `Error: Insufficient stock. Current: ${item.quantity}` }], isError: true };
        }

        // Update the item in the array
        itemsArray[itemIndex].quantity = newQty;
        (stockDoc as any).lastUpdated = new Date();
        await stockDoc.save();

        return { content: [{ type: "text", text: `Success: Updated ${itemName} in ${dbLocation}. New Quantity: ${newQty}` }] };
    }
);

// Tool: List Orders
server.tool(
    "orders_list",
    {
        limit: z.number().min(1).max(20).default(5).describe("Number of recent orders to fetch"),
        status: z.enum(["pending", "completed"]).optional().describe("Filter by order status"),
        vendor: z.string().optional().describe("Filter by vendor name (partial match)")
    },
    async ({ limit, status, vendor }) => {
        const filter: any = {};
        if (status) filter.status = status;
        if (vendor) filter.vendorName = { $regex: vendor, $options: "i" };

        const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit);

        if (orders.length === 0) return { content: [{ type: "text", text: "No orders found matching functionality." }] };

        const result = orders.map(o => {
            const dateStr = new Date(o.createdAt).toLocaleDateString();
            const itemsSummary = o.items.map(i => `${i.quantity}x ${i.name} (${i.price ? '₹' + i.price : '-'})`).join(", ");
            const idShort = (o._id as any).toString().slice(-4);
            return `[${idShort}] ${dateStr} - ${o.vendorName} (${o.status})\nItems: ${itemsSummary}`;
        }).join("\n\n");

        return { content: [{ type: "text", text: result }] };
    }
);

// Tool: Count Inventory Items
server.tool(
    "inventory_count",
    {
        location: z.enum(["shop", "factory"]).optional().describe("Optional location filter"),
    },
    async ({ location }) => {
        const dbLocation = location ? location.charAt(0).toUpperCase() + location.slice(1) : null;
        const filter: any = dbLocation ? { location: dbLocation } : {};
        const stockDocs = await Stock.find(filter);

        let totalItems = 0;
        for (const doc of stockDocs) {
            totalItems += (doc as any).items.length;
        }

        const locationLabel = dbLocation || "all locations";
        return { content: [{ type: "text", text: `Total unique items in ${locationLabel}: ${totalItems}` }] };
    }
);

// Tool: List Sample Items
server.tool(
    "inventory_list_sample",
    {
        count: z.number().min(1).max(10).default(5).describe("Number of item names to return (max 10)"),
        location: z.enum(["shop", "factory"]).optional().describe("Optional location filter"),
    },
    async ({ count, location }) => {
        const dbLocation = location ? location.charAt(0).toUpperCase() + location.slice(1) : null;
        const filter: any = dbLocation ? { location: dbLocation } : {};
        const stockDocs = await Stock.find(filter);

        const allItems: string[] = [];
        for (const doc of stockDocs) {
            for (const item of (doc as any).items) {
                allItems.push(`${item.name} (${(doc as any).location})`);
            }
        }

        if (allItems.length === 0) {
            return { content: [{ type: "text", text: "No items found." }] };
        }

        // Shuffle and pick 'count' items
        const shuffled = allItems.sort(() => Math.random() - 0.5);
        const sample = shuffled.slice(0, Math.min(count, allItems.length));

        return { content: [{ type: "text", text: `Sample items:\n${sample.join("\n")}` }] };
    }
);

// Start Server
async function main() {
    await connectDB();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server running on stdio");
}

main();
