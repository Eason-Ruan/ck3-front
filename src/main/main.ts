import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { buildGraph } from './graph';
import { loadEnv } from './config';
import { GraphState } from './state';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import dotenv from "dotenv";

dotenv.config();

function extractTextFromContent(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  // LangChain 可能返回 [{ type: 'text', text: '...' }, ...]
  if (Array.isArray(content)) {
    try {
      const parts = content
        .map((p: any) => {
          if (!p) return "";
          if (typeof p === "string") return p;
          if (typeof p.text === "string") return p.text;
          if (typeof p.content === "string") return p.content;
          return typeof p === "object" ? JSON.stringify(p) : String(p);
        })
        .filter(Boolean);
      return parts.join("\n");
    } catch {
      // 兜底为字符串
      return String(content);
    }
  }
  if (typeof content === "object") {
    // 若是结构化对象，优先常见字段
    const possible = (content as any);
    if (typeof possible.text === "string") return possible.text;
    if (typeof possible.message === "string") return possible.message;
    if (typeof possible.reply === "string") return possible.reply;
    try { return JSON.stringify(content); } catch { return String(content); }
  }
  return String(content);
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    frame: false,
    fullscreen: false,
    transparent: true,
    backgroundColor: '#00000000',
    // 在 Windows 上置顶
    alwaysOnTop: process.platform === 'win32',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      devTools: true
    },
    show: false
  });

  const indexHtmlPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(indexHtmlPath).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to load index.html:', err);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 再次确保置顶（运行时设置），仅在 Windows 生效
  if (process.platform === 'win32') {
    try {
      // 使用更高置顶等级，确保覆盖大多数窗口
      (mainWindow as any).setAlwaysOnTop(true, 'screen-saver');
    } catch {}
  }
}

app.whenReady().then(() => {
  createMainWindow();

  // —— 简单的会话状态：sessionId -> GraphState ——
  const sessions = new Map<string, GraphState>();
  const env = loadEnv(process.env);
  // —— 设置/校验 Agent 所需的 Keys ——
  // 优先使用现有环境变量；其次使用经过 Schema 校验后的 env 值
  if (!process.env.RAG_TIER && (env as any)?.RAG_TIER) {
    process.env.RAG_TIER = (env as any).RAG_TIER as string;
  }
  if (!process.env.TAVILY_API_KEY && (env as any)?.TAVILY_API_KEY) {
    process.env.TAVILY_API_KEY = (env as any).TAVILY_API_KEY as string;
  }
  if (!process.env.OPENAI_BASE_URL && (env as any)?.OPENAI_BASE_URL) {
    process.env.OPENAI_BASE_URL = (env as any).OPENAI_BASE_URL as string;
  }
  // OpenAI 相关：ChatOpenAI 与 OpenAIEmbeddings 均依赖 OPENAI_API_KEY
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[keys] 缺少 OPENAI_API_KEY：OpenAI 模型与向量检索将不可用。');
  }
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[keys] 缺少 TAVILY_API_KEY：tavily_search 工具将不可用。');
  }
  if (process.env.OPENAI_BASE_URL) {
    console.log(`[keys] 使用自定义 OPENAI_BASE_URL=${process.env.OPENAI_BASE_URL}`);
  }
  const tier = (process.env.RAG_TIER || (env as any)?.RAG_TIER) as string | undefined;
  if (tier && ["1", "2", "3", "4"].includes(tier)) {
    const projectRoot = path.resolve(__dirname, '../../');
    const targetDir = path.join(projectRoot, 'data', `${tier}档`);
    try {
      if (fs.existsSync(targetDir)) {
        process.env.HTML_RAG_DIR = targetDir;
        console.log(`[RAG] 使用 RAG_TIER=${tier}，HTML_RAG_DIR=${targetDir}`);
      } else {
        console.warn(`[RAG] 目录不存在：${targetDir}。保留现有 HTML_RAG_DIR=${process.env.HTML_RAG_DIR || '(未设置)'}。`);
      }
    } catch (e: any) {
      console.warn(`[RAG] 检查目录失败：${e?.message || String(e)}`);
    }

    // 设置 CSV_BASE_DIR 为项目 data 目录，便于按 <tier>.csv 加载
    const dataDir = path.join(projectRoot, 'data');
    process.env.CSV_BASE_DIR = dataDir;
    console.log(`[CSV] CSV_BASE_DIR=${process.env.CSV_BASE_DIR}`);
  }
  const graph = buildGraph(env);

  ipcMain.handle('chat:newSession', async (_event, { sessionId }: { sessionId: string }) => {
    sessions.set(sessionId, { messages: [], next: 'router', scratch: {} } as GraphState);
    return { ok: true };
  });

  ipcMain.handle('chat:send', async (_event, { sessionId, text }: { sessionId: string; text: string }) => {
    try {
      console.log(`[chat:send] 开始处理会话 ${sessionId}, 消息: ${text}`);
      
      const prev = sessions.get(sessionId) || ({ messages: [], next: 'router', scratch: {} } as GraphState);
      console.log(`[chat:send] 上一状态:`, { 
        messagesCount: prev.messages?.length || 0, 
        next: prev.next, 
        scratchKeys: Object.keys(prev.scratch || {}) 
      });
      
      const prevMessages = prev.messages || [];
      const withUser: GraphState = {
        ...prev,
        messages: [...prevMessages, new HumanMessage(text)]
      };
      
      console.log(`[chat:send] 准备调用图执行, 消息数量: ${withUser.messages.length}`);
      const result: GraphState = await (graph as any).invoke(withUser);
      console.log(`[chat:send] 图执行完成, 结果消息数量: ${result.messages?.length || 0}`);

      // —— 打印本轮会话中的所有消息（包含类型、名称、内容与工具调用）——
      try {
        const all = result.messages || [];
        console.log(`[chat:send] —— 本轮所有消息（${all.length}）——`);
        all.forEach((m: any, idx: number) => {
          const type = m?._getType?.();
          const name = (m as any)?.name;
          const contentText = extractTextFromContent((m as any)?.content);
          const hasToolCalls = Array.isArray((m as any)?.tool_calls) && (m as any).tool_calls.length > 0;
          console.log(`[chat:send] [${idx}] type=${type} name=${name || '-'} len=${contentText?.length || 0} toolCalls=${hasToolCalls}`);
          if (hasToolCalls) {
            console.log(`[chat:send] [${idx}] tool_calls:`, (m as any).tool_calls);
          }
          console.log(`[chat:send] [${idx}] content:\n${contentText}`);
        });
      } catch (e: any) {
        console.warn(`[chat:send] 打印消息失败: ${e?.message || String(e)}`);
      }
      
      sessions.set(sessionId, result);

      // 取本轮面向用户的答复：优先拿最后一条 name 为 decision_suggestion 的 AIMessage
      const messages = result.messages || [];
      const reversed = [...messages].reverse();
      const finalMsg = (reversed.find((m: any) => m?._getType?.() === 'ai' && (m.name === 'decision_suggestion'))
        || reversed.find((m: any) => m?._getType?.() === 'ai')) as AIMessage | undefined;
      
      console.log(`[chat:send] 找到最终消息:`, { 
        found: !!finalMsg, 
        type: finalMsg?._getType?.(), 
        name: (finalMsg as any)?.name 
      });
      
      const raw = (finalMsg?.content as any);
      const reply = extractTextFromContent(raw);
      console.log(`[chat:send] 提取的回复长度: ${reply?.length || 0}`);
      
      return { reply };
    } catch (error: any) {
      console.error(`[chat:send] 错误:`, error);
      console.error(`[chat:send] 错误堆栈:`, error.stack);
      const message = (error && error.message) ? error.message : String(error);
      return { reply: `处理失败：${message}` };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


