export type Role = "user" | "assistant" | "system" | "tool";

export interface ChatTurn {
    role: Role;
    content: string;
    name?: string; // 可用于标注 agent 名
}

export interface SessionConfig {
    sessionId: string;
}