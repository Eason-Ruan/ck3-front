import { z } from "zod";
import { tool } from "@langchain/core/tools";
import * as fs from "fs/promises";
import * as path from "path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

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

// —— HTML RAG 工具 ——
function stripHtml(raw: string): string {
    const withoutScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
    return withoutTags.replace(/\s+/g, " ").trim();
}

function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(text.length, start + chunkSize);
        chunks.push(text.slice(start, end));
        if (end === text.length) break;
        start = Math.max(end - overlap, start + 1);
    }
    return chunks;
}

async function readAllHtmlFiles(dir: string): Promise<{ file: string; content: string }[]> {
    const result: { file: string; content: string }[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const sub = await readAllHtmlFiles(full);
            result.push(...sub);
        } else if (/\.(html?|xhtml)$/i.test(entry.name)) {
            try {
                const raw = await fs.readFile(full, "utf8");
                const text = stripHtml(raw);
                if (text) result.push({ file: full, content: text });
            } catch {
                // 忽略不可读文件
            }
        }
    }
    return result;
}

export const htmlRagContext = createTool(
    async ({ query, dir, k }: { query: string; dir?: string; k?: number }) => {
        const baseDir = dir || process.env.HTML_RAG_DIR || "";
        if (!baseDir) {
            return JSON.stringify({ error: "No directory provided. Set dir or HTML_RAG_DIR. 可通过 RAG_TIER=1|2|3|4 自动映射到 data/<n档>。", contexts: [] });
        }
        let statOk = false;
        try {
            const st = await fs.stat(baseDir);
            statOk = st.isDirectory();
        } catch {
            statOk = false;
        }
        if (!statOk) {
            return JSON.stringify({ error: `Directory not found: ${baseDir}`, contexts: [] });
        }

        const files = await readAllHtmlFiles(baseDir);
        if (files.length === 0) {
            return JSON.stringify({ error: "No HTML files found.", contexts: [] });
        }

        const allChunks: { text: string; source: string; idx: number }[] = [];
        for (const f of files) {
            const chunks = chunkText(f.content);
            chunks.forEach((c, i) => allChunks.push({ text: c, source: f.file, idx: i }));
        }
        const embeddings = new OpenAIEmbeddings({
            configuration: process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } as any : undefined
        } as any);
        const store = await MemoryVectorStore.fromTexts(
            allChunks.map((c) => c.text),
            allChunks.map((c) => ({ source: c.source, idx: c.idx })),
            embeddings
        );
        const topK = Math.max(1, Math.min(20, k ?? 6));
        const results = await store.similaritySearch(query, topK);

        const contexts = results.map((doc, rank) => ({
            rank: rank + 1,
            source: (doc.metadata?.source as string) || "",
            index: (doc.metadata?.idx as number) ?? 0,
            text: doc.pageContent
        }));
        return JSON.stringify({ query, dir: baseDir, k: topK, contexts });
    },
    {
        name: "html_rag_context",
        description: "扫描指定目录内的 HTML 文件，构建临时向量索引并返回与查询最相关的 Top-K 文本片段（含来源路径与分片索引）。若未指定 dir，默认读取环境变量 HTML_RAG_DIR。",
        schema: z.object({
            query: z.string().describe("检索查询（描述你需要的上下文）"),
            dir: z.string().optional().describe("HTML 根目录（可省略以使用 HTML_RAG_DIR）"),
            k: z.number().int().min(1).max(20).optional().describe("返回片段数，默认 6，最大 20")
        })
    }
) as any;

// —— 读取 CSV 工具 ——
function resolveCsvPath(inputPath: string): { abs: string; baseDir?: string } {
    const baseDir = process.env.CSV_BASE_DIR;
    if (path.isAbsolute(inputPath)) {
        return { abs: inputPath, baseDir };
    }
    if (!baseDir) {
        throw new Error("Relative path provided but CSV_BASE_DIR is not set.");
    }
    return { abs: path.join(baseDir, inputPath), baseDir };
}

function parseCsv(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentField = "";
    let currentRow: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                const next = text[i + 1];
                if (next === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === delimiter) {
            currentRow.push(currentField);
            currentField = "";
            continue;
        }
        if (ch === "\n" || ch === "\r") {
            // handle CRLF
            if (ch === "\r" && text[i + 1] === "\n") i++;
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = "";
            continue;
        }
        currentField += ch;
    }
    // last field
    currentRow.push(currentField);
    rows.push(currentRow);
    // 过滤可能的最后一行空行
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
        rows.pop();
    }
    return rows;
}

export const csvRead = createTool(
    async ({ file, delimiter, limit, header }: { file?: string; delimiter?: string; limit?: number; header?: boolean }) => {
        const dlm = (delimiter && delimiter.length > 0 ? delimiter : ",");
        const useHeader = header !== undefined ? header : true;
        const maxRows = Math.max(1, Math.min(5000, limit ?? 200));

        let absPath: string;
        try {
            // 若未显式传入 file，则按 RAG_TIER 自动选择 <tier>.csv（位于 CSV_BASE_DIR）
            const tier = process.env.RAG_TIER;
            const effectiveFile = file && file.length > 0 ? file : (tier ? `${tier}.csv` : "");
            ({ abs: absPath } = resolveCsvPath(effectiveFile));
        } catch (e: any) {
            return JSON.stringify({ error: e?.message || String(e) });
        }

        try {
            const st = await fs.stat(absPath);
            if (!st.isFile()) {
                return JSON.stringify({ error: `Not a file: ${absPath}` });
            }
        } catch (e: any) {
            return JSON.stringify({ error: `File not found: ${absPath}` });
        }

        let raw = "";
        try {
            raw = await fs.readFile(absPath, "utf8");
        } catch (e: any) {
            return JSON.stringify({ error: `Failed to read file: ${absPath}`, detail: e?.message || String(e) });
        }

        const table = parseCsv(raw, dlm);
        if (table.length === 0) {
            return JSON.stringify({ file: absPath, delimiter: dlm, header: useHeader, totalRows: 0, rows: [] });
        }

        let rows: any[] = [];
        if (useHeader) {
            const headers = table[0].map(h => h.trim());
            for (let i = 1; i < table.length && rows.length < maxRows; i++) {
                const record: Record<string, string> = {};
                const line = table[i];
                for (let j = 0; j < headers.length; j++) {
                    record[headers[j] || `col_${j + 1}`] = (line[j] ?? "").trim();
                }
                rows.push(record);
            }
        } else {
            for (let i = 0; i < table.length && rows.length < maxRows; i++) {
                rows.push(table[i]);
            }
        }

        return JSON.stringify({ file: absPath, delimiter: dlm, header: useHeader, totalRows: rows.length, rows });
    },
    {
        name: "csv_read",
        description: "读取本地 CSV 文件。若未传 file，将按 RAG_TIER 自动读取 <tier>.csv（相对 CSV_BASE_DIR）。默认按第一行表头解析，并返回前 N 行。",
        schema: z.object({
            file: z.string().optional().describe("CSV 文件绝对路径，或相对 CSV_BASE_DIR 的相对路径。省略则读取 <RAG_TIER>.csv"),
            delimiter: z.string().min(1).max(3).optional().describe("列分隔符，默认 ,"),
            limit: z.number().int().min(1).max(5000).optional().describe("最大返回行数，默认 200"),
            header: z.boolean().optional().describe("是否把第一行作为表头，默认 true")
        })
    }
) as any;

// —— CK3 领域工具：仅保留 wiki 查询 ——
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

// —— Tavily 搜索工具（惰性包装）：仅在调用时读取环境变量并实例化 ——
export const tavilySearch = createTool(
    async ({ query }: { query: string }) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            return JSON.stringify({ error: "TAVILY_API_KEY missing: tavily_search disabled.", query });
        }
        const inner = new TavilySearchResults({ maxResults: 8, apiKey });
        // 直接转发给 Tavily 工具，保持与原工具一致的返回结构
        return await (inner as any).invoke({ query });
    },
    {
        name: "tavily_search",
        description: "使用 Tavily 进行网络检索。缺少 TAVILY_API_KEY 时返回错误信息而非崩溃。",
        schema: z.object({ query: z.string() })
    }
) as any;

export const tools = [timeNow, httpGet, htmlRagContext, csvRead, wikiLookup, tavilySearch];
