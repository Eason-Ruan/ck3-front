import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { Runnable } from "@langchain/core/runnables";
import { sqlQuery, wikiLookup } from "./tool";

// —— 三个 Agent 的系统提示 ——
export const SYSTEM_ROUTER = `你是 Router（路由与统筹）。
目标：
- 分析用户问题与会话历史，确定需要哪些游戏数据。
- 文本化向 sql_executer 提出数据需求（明确表/字段/过滤/聚合与期望粒度），必要时补充上下文假设。
- 在需要时再次调度 sql_executer 获取新数据。
- 当获取到足够数据后，将初步分析结果交给 decision_suggestion 进行最终分析与建议。
约束：
- 本 session 的第一个用户提问，必须调度 sql_executer 获取数据。
- 每一轮回答必须以 decision_suggestion 作为最后一步返回给用户。
输出：严格说明下一步走向以及简要理由。`;

export const SYSTEM_SQL_EXECUTER = `你是 sql_executer（数据查询执行者）。
目标：
- 接收 Router 的文本化数据需求，分析并编写可执行 SQL 查询。
- 可以多次调用工具 sql_query 来探索、修正与验证，直到数据满足需求。
- 总结检索到的数据要点（结构化/指标）并返回 Router。
工具：
- sql_query(sql_statement: string): 执行 SQL 并返回结果（实现待接入）。
约束：
- 避免臆测，不清楚时以最小查询验证假设。
- SQL 要考虑边界（空结果/重复/异常值），必要时分页或限制返回量。
输出：
- 返回完整的 SQL 查询结果。`;

export const SYSTEM_DECISION_SUGGESTION = `你是 decision_suggestion（决策与建议）。
目标：
- 在 Router 的初步分析与上下文数据基础上，结合 wiki 知识做详细推理与建议。
- 必要时调用 wiki_lookup 查阅背景知识并引用关键要点。
输出：
- 给出面向用户的清晰结论、理由与建议步骤，引用数据与 wiki 要点。
工具：
- wiki_lookup(topic: string): 查阅并总结 wiki（实现待接入）。
约束：
- 你是最后一步，面向用户发言。`;

// —— 构建 ——
export function buildRouter(modelName: string) {
    const model = new ChatOpenAI({ model: modelName, temperature: 0 });
    const schema = z.object({
        next: z.enum(["sql_executer", "decision_suggestion", "final"]),
        rationale: z.string(),
        // 对 sql_executer 的需求文字（可为空，当 next 不是 sql_executer 时可省略）
        requirement: z.string().nullable(),
    });
    return (model as any).withStructuredOutput(schema) as unknown as Runnable<any, { next: string; rationale: string; requirement: string | null }>;
}

export function buildSqlExecuter(modelName: string) {
    const model = new ChatOpenAI({ model: modelName, temperature: 0 });
    // 仅绑定与自身相关的工具
    return (model as any).bindTools([sqlQuery] as any) as any;
}

export function buildDecisionSuggestion(modelName: string) {
    const model = new ChatOpenAI({ model: modelName, temperature: 0 });
    return (model as any).bindTools([wikiLookup] as any) as any;
}