import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'node:path';

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
      devTools: true
    },
    show: false
  });

  const indexHtmlPath = path.resolve(__dirname, '../src/index.html');
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


