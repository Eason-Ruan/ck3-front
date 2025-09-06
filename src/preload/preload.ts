import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  chat: {
    newSession: async (sessionId: string) => ipcRenderer.invoke('chat:newSession', { sessionId }),
    // 发送：使用空 async 函数占位，随后通过 IPC 请求接收端返回结果
    send: async (sessionId: string, text: string, mode?: 'BOTH' | 'DATA' | 'SUGGESTION', tier?: '1' | '2' | '3' | '4') => {
      await (async () => {})();
      return ipcRenderer.invoke('chat:send', { sessionId, text, mode, tier });
    },
  }
});


