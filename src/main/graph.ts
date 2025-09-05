import { StateGraph, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { GraphState } from "./state";
import { buildRouter, buildDataLoader, buildDecisionSuggestion, SYSTEM_ROUTER, SYSTEM_DATA_LOADER, SYSTEM_DECISION_SUGGESTION } from "./lang_agent";
import { tools } from "./tool";
import type { AppEnv } from "./config";

export function buildGraph(env: AppEnv) {
    const modelName = env.OPENAI_MODEL || "gpt-4o-mini";
    const router = buildRouter(modelName);
    const dataLoader = buildDataLoader(modelName);
    const decisionSuggestion = buildDecisionSuggestion(modelName);
    const toolNode = new ToolNode(tools);

    const graph: any = new (StateGraph as any)({
        channels: {
            messages: { 
                value: (x: BaseMessage[], y: BaseMessage[]) => {
                    // 确保x和y都是数组
                    const xArray = Array.isArray(x) ? x : [];
                    const yArray = Array.isArray(y) ? y : [];
                    return xArray.concat(yArray);
                }, 
                default: () => [] 
            },
            next: { value: (x: any, y: any) => y ?? x, default: () => "router" },
            scratch: { value: (x: any, y: any) => ({ ...(x || {}), ...(y || {}) }), default: () => ({}) }
        }
    } as any)
        // 节点：Router（强制首次调用 data_loader；其后固定进入 decision_suggestion）
        .addNode("router", async (state: GraphState) => {
            try {
                console.log(`[router] 开始处理, 状态:`, { 
                    messagesCount: state.messages?.length || 0, 
                    next: state.next, 
                    hasExecutedExecutor: !!state.scratch?.hasExecutedExecutor 
                });
                // 打印入参消息详情
                try {
                    const msgs = state.messages || [];
                    msgs.forEach((m: any, i: number) => {
                        const type = m?._getType?.();
                        const name = (m as any)?.name;
                        const content = (m as any)?.content;
                        const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((x: any) => (x?.text || x?.content || '')).join('\n') : (typeof content === 'object' ? JSON.stringify(content) : String(content)));
                        console.log(`[router] 输入消息[${i}] type=${type} name=${name || '-'} len=${text?.length || 0}`);
                    });
                } catch {}
                
                const count = (state.scratch?.executerRoundTrips ?? 0);
                const stateMessages = state.messages || [];
                const messages = [
                    new SystemMessage(SYSTEM_ROUTER),
                    ...stateMessages
                ];
                
                console.log(`[router] 调用路由器, 消息数量: ${messages.length}`);
                const decision: any = await router.invoke(messages);
                console.log(`[router] 路由器决策:`, decision);
                
                const hasExecuted = !!state.scratch?.hasExecutedExecutor;
                let next: any = decision.next;
                if (!hasExecuted) {
                    next = "data_loader";
                } else {
                    next = "decision_suggestion";
                }
                
                console.log(`[router] 最终决策: ${next}`);
                
                return {
                    next,
                    scratch: {
                        ...(state.scratch || {}),
                        hasExecutedExecutor: hasExecuted || next === "data_loader",
                        executerRoundTrips: next === "data_loader" ? count + 1 : count
                    },
                    messages: [
                        new AIMessage({ content: `ROUTER→${next}: ${decision.rationale}${decision.requirement ? `\nREQ: ${decision.requirement}` : ""}` as any, name: "router" })
                    ]
                };
            } catch (error: any) {
                console.error(`[router] 错误:`, error);
                console.error(`[router] 状态:`, state);
                throw error;
            }
        })

        // 节点：data_loader（可触发工具；若无工具调用则直接返回结构化摘要或模板）
        .addNode("data_loader", async (state: GraphState) => {
            try {
                console.log(`[data_loader] 开始处理, 消息数量: ${state.messages?.length || 0}`);
                // 打印入参消息详情
                try {
                    const msgs = state.messages || [];
                    msgs.forEach((m: any, i: number) => {
                        const type = m?._getType?.();
                        const name = (m as any)?.name;
                        const content = (m as any)?.content;
                        const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((x: any) => (x?.text || x?.content || '')).join('\n') : (typeof content === 'object' ? JSON.stringify(content) : String(content)));
                        const hasToolCalls = Array.isArray((m as any)?.tool_calls) && (m as any).tool_calls.length > 0;
                        console.log(`[data_loader] 输入消息[${i}] type=${type} name=${name || '-'} len=${text?.length || 0} toolCalls=${hasToolCalls}`);
                    });
                } catch {}
                
                const stateMessages = state.messages || [];
                const messages = [
                    new SystemMessage(SYSTEM_DATA_LOADER),
                    // 在此注入一次性的"原始封臣数据"文本（留空占位）
                    new SystemMessage("原始封臣数据：\n"),
                    ...stateMessages
                ];
                
                console.log(`[data_loader] 调用数据加载器, 消息数量: ${messages.length}`);
                const msg = await dataLoader.invoke(messages);
                console.log(`[data_loader] 数据加载器响应:`, { type: msg?._getType?.(), hasToolCalls: !!(msg as any)?.tool_calls?.length });
                try {
                    const c = (msg as any)?.content;
                    const text = typeof c === 'string' ? c : (Array.isArray(c) ? c.map((x: any) => (x?.text || x?.content || '')).join('\n') : (typeof c === 'object' ? JSON.stringify(c) : String(c)));
                    console.log(`[data_loader] 输出消息 len=${text?.length || 0}`);
                } catch {}
                
                return { messages: [msg], scratch: { ...(state.scratch || {}), lastToolCaller: "data_loader" } };
            } catch (error: any) {
                console.error(`[data_loader] 错误:`, error);
                console.error(`[data_loader] 状态:`, state);
                throw error;
            }
        })

        // 节点：decision_suggestion（会触发工具调用，且作为最终对用户输出）
        .addNode("decision_suggestion", async (state: GraphState) => {
            try {
                console.log(`[decision_suggestion] 开始处理, 消息数量: ${state.messages?.length || 0}`);
                // 打印入参消息详情
                try {
                    const msgs = state.messages || [];
                    msgs.forEach((m: any, i: number) => {
                        const type = m?._getType?.();
                        const name = (m as any)?.name;
                        const content = (m as any)?.content;
                        const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((x: any) => (x?.text || x?.content || '')).join('\n') : (typeof content === 'object' ? JSON.stringify(content) : String(content)));
                        const hasToolCalls = Array.isArray((m as any)?.tool_calls) && (m as any).tool_calls.length > 0;
                        console.log(`[decision_suggestion] 输入消息[${i}] type=${type} name=${name || '-'} len=${text?.length || 0} toolCalls=${hasToolCalls}`);
                    });
                } catch {}
                
                const stateMessages = state.messages || [];
                const messages = [
                    new SystemMessage(SYSTEM_DECISION_SUGGESTION),
                    ...stateMessages
                ];
                
                console.log(`[decision_suggestion] 调用决策建议器, 消息数量: ${messages.length}`);
                const msg = await decisionSuggestion.invoke(messages);
                console.log(`[decision_suggestion] 决策建议器响应:`, { type: msg?._getType?.(), hasToolCalls: !!(msg as any)?.tool_calls?.length });
                try {
                    const c = (msg as any)?.content;
                    const text = typeof c === 'string' ? c : (Array.isArray(c) ? c.map((x: any) => (x?.text || x?.content || '')).join('\n') : (typeof c === 'object' ? JSON.stringify(c) : String(c)));
                    console.log(`[decision_suggestion] 输出消息 len=${text?.length || 0}`);
                } catch {}
                
                return { messages: [msg], scratch: { ...(state.scratch || {}), lastToolCaller: "decision_suggestion" } };
            } catch (error: any) {
                console.error(`[decision_suggestion] 错误:`, error);
                console.error(`[decision_suggestion] 状态:`, state);
                throw error;
            }
        })

        // 工具执行节点
        .addNode("tools", toolNode)

        // 路由与循环逻辑
        .addConditionalEdges("router", (state: GraphState) => {
            return state.next;
        }, { router: "router", data_loader: "data_loader", decision_suggestion: "decision_suggestion", final: "final" })

        .addConditionalEdges("data_loader", (state: GraphState) => {
            const messages = state.messages || [];
            const last = messages[messages.length - 1];
            // @ts-ignore
            return (last as any)?.tool_calls?.length ? "tools" : "router";
        }, { tools: "tools", router: "router" })

        .addConditionalEdges("decision_suggestion", (state: GraphState) => {
            const messages = state.messages || [];
            const last = messages[messages.length - 1];
            // @ts-ignore
            return (last as any)?.tool_calls?.length ? "tools" : "final";
        }, { tools: "tools", final: "final" })

        .addConditionalEdges("tools", (state: GraphState) => {
            const back = state.scratch?.lastToolCaller;
            return back === "data_loader" ? "data_loader" : back === "decision_suggestion" ? "decision_suggestion" : "router";
        }, { data_loader: "data_loader", decision_suggestion: "decision_suggestion", router: "router" })

        // 终止分支
        .addNode("final", async (_state: GraphState) => ({ messages: [new SystemMessage({ content: "[FINAL] 已生成最终答复。", name: "decision_suggestion" })] }))
        .addEdge("final", END)

        // 开始 → router
        .addEdge("__start__", "router");

    return graph.compile();
}

export type CompiledGraph = ReturnType<typeof buildGraph>;