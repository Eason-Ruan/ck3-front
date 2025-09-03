import { z } from "zod";
import { tool } from "@langchain/core/tools";

const createTool: any = tool as any;

export const timeNow = createTool(
    async () => new Date().toISOString(),
    {
        name: "time_now",
        description: "Get current ISO timestamp.",
        schema: z.object({})
    }
) as any; // 保守断言以避免深层类型展开

export const httpGet = createTool(
    async ({ url }: { url: string }) => {
        const res = await fetch(url);
        const text = await res.text();
        return text.slice(0, 4000); // 防止超长
    },
    {
        name: "http_get",
        description: "Fetch raw text via HTTP GET (first 4000 chars).",
        schema: z.object({ url: z.string().url() })
    }
) as any; //

// —— CK3 领域工具占位 ——
export const sqlQuery = createTool(
    async ({ sql_statement }: { sql_statement: string }) => {
        // TODO: 执行 SQL 查询并返回结果（分页/裁剪/错误处理）
        return `TODO: execute SQL -> ${sql_statement}`;
    },
    {
        name: "sql_query",
        description: "Execute a SQL query against CK3 save DB and return concise results.",
        schema: z.object({ sql_statement: z.string().describe("The SQL statement to execute") })
    }
) as any;

export const wikiLookup = createTool(
    async ({ topic }: { topic: string }) => {
        // TODO: 查找 Wiki（网络/本地索引）并返回要点摘要
        return `TODO: lookup wiki for: ${topic}`;
    },
    {
        name: "wiki_lookup",
        description: "Look up CK3 related knowledge from wiki and summarize key points.",
        schema: z.object({ topic: z.string().describe("The topic to lookup in wiki") })
    }
) as any;

export const tools = [timeNow, httpGet, sqlQuery, wikiLookup];
