import { z } from "zod";

// 1) 声明三元枚举
export const InfoModeEnum = z.enum(["OFF", "DATA", "SUGGESTION", "BOTH"]);
export type InfoMode = z.infer<typeof InfoModeEnum>;

// 2) 定义所有需要的环境变量 Schema
const EnvSchema = z.object({
    INFO_MODE: InfoModeEnum.default("BOTH"),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    OPENAI_BASE_URL: z.string().optional(),
    HTML_RAG_DIR: z.string().optional(),
    CSV_BASE_DIR: z.string().optional(),
    TAVILY_API_KEY: z.string().optional(),
    // 新增：选择 data 子目录的档位（1-4）。若设置，则在主进程中派生 HTML_RAG_DIR。
    RAG_TIER: z.enum(["1", "2", "3", "4"]).optional(),
});

// 3) 从 process.env 解析（主进程 & preload 中均可用）
export function loadEnv(raw: NodeJS.ProcessEnv = process.env) {
    // 只挑选我们允许暴露/使用的键
    const parsed = EnvSchema.safeParse({
        INFO_MODE: raw.INFO_MODE,
        OPENAI_MODEL: raw.OPENAI_MODEL,
        OPENAI_BASE_URL: raw.OPENAI_BASE_URL,
        HTML_RAG_DIR: raw.HTML_RAG_DIR,
        CSV_BASE_DIR: raw.CSV_BASE_DIR,
        TAVILY_API_KEY: raw.TAVILY_API_KEY,
        RAG_TIER: raw.RAG_TIER,
    });
    if (!parsed.success) {
        // 生产建议更友好地记录错误并中止启动
        console.error("[env] Invalid configuration:", parsed.error.flatten());
        throw new Error("Invalid environment configuration");
    }
    return parsed.data;
}

export type AppEnv = ReturnType<typeof loadEnv>;