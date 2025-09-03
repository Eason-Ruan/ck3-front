import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { buildGraph } from './graph';
import { GraphState } from './state';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    frame: false,
    fullscreen: false,
    transparent: true,
    backgroundColor: '#00000000',
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
}

app.whenReady().then(() => {
  createMainWindow();

  // —— 简单的会话状态：sessionId -> GraphState ——
  const sessions = new Map<string, GraphState>();
  const graph = buildGraph();

  ipcMain.handle('chat:newSession', async (_event, { sessionId }: { sessionId: string }) => {
    sessions.set(sessionId, { messages: [], next: 'router', scratch: {} } as GraphState);
    return { ok: true };
  });

  ipcMain.handle('chat:send', async (_event, { sessionId, text }: { sessionId: string; text: string }) => {
    const prev = sessions.get(sessionId) || ({ messages: [], next: 'router', scratch: {} } as GraphState);
    const withUser: GraphState = {
      ...prev,
      messages: [...prev.messages, new HumanMessage(text)]
    };
    const result: GraphState = await (graph as any).invoke(withUser);
    sessions.set(sessionId, result);

    // 取本轮面向用户的答复：优先拿最后一条 name 为 decision_suggestion 的 AIMessage
    const reversed = [...result.messages].reverse();
    const finalMsg = (reversed.find((m: any) => m?._getType?.() === 'ai' && (m.name === 'decision_suggestion'))
      || reversed.find((m: any) => m?._getType?.() === 'ai')) as AIMessage | undefined;
    const reply = (finalMsg?.content as any) || '';
    return { reply };
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


