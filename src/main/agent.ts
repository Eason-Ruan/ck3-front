// electron/main/agents.ts
import { Agent, tool } from '@openai/agents';
import OpenAI from 'openai';
import { z } from 'zod';

const MODEL = 'gpt-4o-mini';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // 仅主进程持有

const sqlQueryTool = tool({
  // The name of the tool will be used by the agent to tell what tool to use.
  name: 'CK3 Save File Query',
  // The description is used to describe **when** to use the tool by telling it **what** it does.
  description: '通过SQL查询语句查阅CK3存档行程的数据库信息，请结合schema构建SQL查询语句。',
  // This tool takes no parameters, so we provide an empty Zod Object.
  parameters: z.object({ sql_statement: z.string().describe('要执行的SQL查询语句') }),
  // The actual function that will be executed when the agent uses this tool.
  execute: async () => {
    // TODO: implement the actual logic of the tool
  },
});

const sqlAgent = new Agent({
  name: 'SQL Agent',
  instructions: '',
  model: 'o4-mini', // optional – falls back to the default model
  tools: [sqlQueryTool],
  modelSettings: {toolChoice: 'CK3 Save File Query'}
});

const decisionAgent = new Agent({
  name: 'Decision Agent',
  instructions: '',
  model: 'o4-mini', // optional – falls back to the default model
});

const routerAgent = Agent.create({
  name: 'Router Agent',
  instructions: '',
  model: 'o4-mini', // optional – falls back to the default model
  handoffs: [sqlAgent, decisionAgent],
});

const RouterSchema = {
  type: "object",
  properties: {
    next: { type: "string", enum: ["researcher","coder","final"] },
    message: { type: "string" }
  },
  required: ["next","message"],
  additionalProperties: false
};

export const agents = {
  router: {
    name: 'router',
    system: '你是 Router，决定把任务分配给 researcher 或 coder，或直接 final。严格输出 JSON: {thought,message,next}',
  },
  researcher: {
    name: 'researcher',
    system: '你是 Researcher，做分析与验收标准，不写大段代码。严格输出 JSON: {thought,message,next}',
  },
  coder: {
    name: 'coder',
    system: '你是 Coder，把方案转成最小可运行代码。严格输出 JSON: {thought,message,next}',
  },
};

type Turn = { by: string; content: string };
type ConversationState = { task: string; turns: Turn[] };

function buildContext(state: ConversationState) {
  const history = state.turns.map(t => `- [${t.by}] ${t.content}`).join('\n');
  return `用户需求：\n${state.task}\n\n已产生的内容：\n${history || '(尚无)'}`;
}

async function runAgent(agent: { system: string }, state: ConversationState) {
  const context = buildContext(state);
  const res = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: agent.system },
      { role: 'user', content: `请基于以下上下文继续推进任务：\n---\n${context}\n---\n严格以 JSON 输出（{ "thought": "...", "message": "...", "next": "..." }）。` }
    ]
  });
  const raw = (res.choices[0]?.message?.content || '{}').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]);
    throw new Error(`Non-JSON output: ${raw}`);
  }
}

// —— 会话运行（一次“轮次”推进）——
export async function stepRun(state: ConversationState, current: string) {
  const out = await runAgent((agents as any)[current], state);
  state.turns.push({ by: current, content: out.message });
  const next = ['router','researcher','coder','final'].includes(out.next) ? out.next : 'router';
  return { next, message: out.message };
}

// —— 简单的会话仓库：windowId × conversationId ——
// 一个窗口可开多个会话；不同窗口互不干扰
export const Sessions = new Map<number, ConversationState>();

export function ensureConversation(tabId: number, task: string) {
  if (!Sessions.has(tabId)) {
    Sessions.set(tabId, { task, turns: [] });
  }
  return Sessions.get(tabId)!;
}