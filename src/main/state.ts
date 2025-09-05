import { BaseMessage } from "@langchain/core/messages";

export type NextHop = "router" | "data_loader" | "decision_suggestion" | "final";

export type GraphState = {
    messages: BaseMessage[];
    next: NextHop;
    scratch?: Record<string, any>;
};