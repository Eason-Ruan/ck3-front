import { StateGraph, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState } from "./state";
import { buildRouter, buildSqlExecuter, buildDecisionSuggestion, SYSTEM_ROUTER, SYSTEM_SQL_EXECUTER, SYSTEM_DECISION_SUGGESTION } from "./lang_agent";
import { tools } from "./tool";

export function buildGraph(modelName = process.env.OPENAI_MODEL || "gpt-4o-mini") {
    const router = buildRouter(modelName);
    const sqlExecuter = buildSqlExecuter(modelName);
    const decisionSuggestion = buildDecisionSuggestion(modelName);
    const toolNode = new ToolNode(tools);

    const graph: any = new (StateGraph as any)({
        channels: {
            messages: { value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y), default: () => [] },
            next: { value: (x: any, y: any) => y ?? x, default: () => "router" }
        }
    } as any)
        // 节点：Router（强制首次调用 sql_executer；最终必须进入 decision_suggestion）
        .addNode("router", async (state: GraphState) => {
            const count = (state.scratch?.executerRoundTrips ?? 0);
            const messages = [
                new SystemMessage(SYSTEM_ROUTER),
                ...state.messages
            ];
            const decision: any = await router.invoke(messages);
            const hasExecuted = !!state.scratch?.hasExecutedExecutor;
            let next: any = decision.next;
            if (!hasExecuted) {
                next = "sql_executer";
            } else if (count >= 5) next = "decision_executer"; // 最多循环5次
            else if (next !== "sql_executer" && next !== "decision_suggestion") {
                next = "decision_suggestion";
            }
            return {
                next,
                scratch: {
                    ...(state.scratch || {}),
                    hasExecutedExecutor: hasExecuted || next === "sql_executer",
                    executerRoundTrips: next === "sql_executer" ? count + 1 : count
                },
                messages: [
                    new AIMessage({ content: `ROUTER→${next}: ${decision.rationale}${decision.requirement ? `\nREQ: ${decision.requirement}` : ""}` as any, name: "router" })
                ]
            };
        })

        // 节点：sql_executer（会触发工具调用）
        .addNode("sql_executer", async (state: GraphState) => {
            const messages = [
                new SystemMessage(SYSTEM_SQL_EXECUTER),
                ...state.messages
            ];
            const msg = await sqlExecuter.invoke(messages);
            return { messages: [msg], scratch: { ...(state.scratch || {}), lastToolCaller: "sql_executer" } };
        })

        // 节点：decision_suggestion（会触发工具调用，且作为最终对用户输出）
        .addNode("decision_suggestion", async (state: GraphState) => {
            const messages = [
                new SystemMessage(SYSTEM_DECISION_SUGGESTION),
                ...state.messages
            ];
            const msg = await decisionSuggestion.invoke(messages);
            return { messages: [msg], scratch: { ...(state.scratch || {}), lastToolCaller: "decision_suggestion" } };
        })

        // 工具执行节点
        .addNode("tools", toolNode)

        // 路由与循环逻辑
        .addConditionalEdges("router", (state: GraphState) => {
            return state.next;
        }, { router: "router", sql_executer: "sql_executer", decision_suggestion: "decision_suggestion", final: "final" })

        .addConditionalEdges("sql_executer", (state: GraphState) => {
            const last = state.messages[state.messages.length - 1];
            // @ts-ignore
            return (last as any)?.tool_calls?.length ? "tools" : "router";
        }, { tools: "tools", router: "router" })

        .addConditionalEdges("decision_suggestion", (state: GraphState) => {
            const last = state.messages[state.messages.length - 1];
            // @ts-ignore
            return (last as any)?.tool_calls?.length ? "tools" : "final";
        }, { tools: "tools", final: "final" })

        .addConditionalEdges("tools", (state: GraphState) => {
            const back = state.scratch?.lastToolCaller;
            return back === "sql_executer" ? "sql_executer" : back === "decision_suggestion" ? "decision_suggestion" : "router";
        }, { sql_executer: "sql_executer", decision_suggestion: "decision_suggestion", router: "router" })

        // 终止分支
        .addNode("final", async (_state: GraphState) => ({ messages: [new SystemMessage({ content: "[FINAL] 已生成最终答复。", name: "decision_suggestion" })] }))
        .addEdge("final", END)

        // 开始 → router
        .addEdge("__start__", "router");

    return graph.compile();
}

export type CompiledGraph = ReturnType<typeof buildGraph>;