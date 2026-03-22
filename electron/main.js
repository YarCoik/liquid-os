// =============================================================================
// main.js — точка входа Electron-обёртки для LiquidOS
// Открывает borderless fullscreen окно без chrome браузера.
// Дополнительно регистрирует системные hot-keys (Ctrl+Alt+T = Terminal и т.д.)
// =============================================================================

const { app, BrowserWindow, globalShortcut, ipcMain, powerSaveBlocker } = require('electron');
const path = require('path');

// Путь к нашему приложению
const APP_PATH = path.join(__dirname, 'app', 'index.html');

// Запретить Chromium отправлять метрики в Google
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('metrics-recording-only');
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('no-first-run');

// GPU acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('use-gl', 'egl');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');

// Wayland (Linux)
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
}

let mainWindow = null;

// Предотвратить гашение экрана (важно для kiosk)
let powerBlockerId = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        // ── Вид ─────────────────────────────────────────────────────────────
        fullscreen:       true,
        kiosk:            true,      // настоящий kiosk (блокирует alt+F4 и т.д.)
        frame:            false,     // без рамки ОС
        titleBarStyle:    'hidden',
        backgroundColor:  '#0b0d14', // цвет фона из нашего CSS пока не загрузилось

        // ── Поведение ────────────────────────────────────────────────────────
        alwaysOnTop:      true,
        autoHideMenuBar:  true,
        resizable:        false,
        movable:          false,
        minimizable:      false,
        maximizable:      false,

        // ── Web Preferences ──────────────────────────────────────────────────
        webPreferences: {
            nodeIntegration:        false,   // изоляция — не давать доступ к Node
            contextIsolation:       true,
            sandbox:                true,
            allowRunningInsecureContent: false,
            // Preload для опциональных системных интеграций
            // preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Загрузить наш index.html
    mainWindow.loadFile(APP_PATH);

    // Заблокировать переход в sleep (нужен для kiosk-дисплеев)
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');

    // ── Горячие клавиши ──────────────────────────────────────────────────────
    // Ctrl+Alt+Q = выход из kiosk (для разработки/обслуживания)
    globalShortcut.register('CommandOrControl+Alt+Q', () => {
        app.quit();
    });

    // Ctrl+Alt+R = перезагрузить UI
    globalShortcut.register('CommandOrControl+Alt+R', () => {
        mainWindow.webContents.reload();
    });

    // F11 = toggle fullscreen (если нужно для dev)
    globalShortcut.register('F11', () => {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

// Не закрываться при закрытии последнего окна (kiosk должен работать всегда)
app.on('window-all-closed', () => {
    // Намеренно НЕ вызываем app.quit() — пусть система решит
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (powerBlockerId !== null) {
        powerSaveBlocker.stop(powerBlockerId);
    }
});
