import { BaseMessage } from "@langchain/core/messages";

export type NextHop = "router" | "sql_executer" | "decision_suggestion" | "final";

export type GraphState = {
    messages: BaseMessage[];
    next: NextHop;
    scratch?: Record<string, any>;
};