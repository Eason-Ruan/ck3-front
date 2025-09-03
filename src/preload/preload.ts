import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  chat: {
    newSession: async (sessionId: string) => ipcRenderer.invoke('chat:newSession', { sessionId }),
    send: async (sessionId: string, text: string) => ipcRenderer.invoke('chat:send', { sessionId, text }),
  }
});


