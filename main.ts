import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

let mainWindow: Electron.BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const port = 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load static Next.js export
    const indexPath = path.join(__dirname, '..', 'out', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('checkout-success') || url.includes('success') || url.includes('payment_intent')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          mainWindow?.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
        }, 1000);
      }
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Also handle navigation events within the window
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl.includes('checkout-success') || navigationUrl.includes('success') || navigationUrl.includes('payment_intent')) {
      event.preventDefault();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
        }
      }, 1000);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});