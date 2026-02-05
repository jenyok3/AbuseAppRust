const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 750,
    minWidth: 1000,
    minHeight: 700,
    useContentSize: true, // Window size includes content area, not frame
    resizable: true,
    maximizable: true,
    minimizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'hidden', // Completely hide title bar
    show: false, // Keep hidden until content is loaded
    backgroundColor: '#0a0a0a' // Dark background to prevent white flash
  });

  // Show window when content is ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Load the app with retry logic
  const startUrl = 'http://localhost:4000'; // Always use dev server for desktop app
  
  console.log('Loading URL:', startUrl);
  
  // Load with timeout and retry
  let retryCount = 0;
  const maxRetries = 10;
  
  function loadApp() {
    console.log(`Attempt ${retryCount + 1}/${maxRetries} - Loading URL:`, startUrl);
    mainWindow.loadURL(startUrl).catch(() => {
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Retry ${retryCount}/${maxRetries} - waiting for server...`);
        setTimeout(loadApp, 2000);
      } else {
        console.error('Failed to load app after maximum retries');
        // Show error page
        mainWindow.loadURL(`data:text/html,<html><body style="background:#0a0a0a;color:white;font-family:Arial;text-align:center;padding:50px;"><h1>AbuseApp Desktop</h1><p>Сервер не запущено. Будь ласка, зачекайте...</p></body></html>`);
      }
    });
  }
  
  loadApp();

  // Window will be shown after size calculation in did-finish-load
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Remove auto-resize logic to prevent layout distortion
  // Comment out the entire did-finish-load handler
  /*
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
    
    // Wait a bit for content to render and JavaScript to adjust widget heights
    setTimeout(() => {
      // Get content size from the web page
      mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Wait for widget height adjustments to complete
            return new Promise((resolve) => {
              setTimeout(() => {
                const body = document.body;
                const html = document.documentElement;
                const main = document.querySelector('main');
                
                // Debug measurements
                console.log('🔍 Debug measurements:');
                console.log('Body scrollHeight:', body.scrollHeight);
                console.log('Body offsetHeight:', body.offsetHeight);
                console.log('Body clientHeight:', body.clientHeight);
                console.log('HTML scrollHeight:', html.scrollHeight);
                console.log('HTML offsetHeight:', html.offsetHeight);
                console.log('HTML clientHeight:', html.clientHeight);
                console.log('Main element:', main ? main.offsetHeight : 'not found');
                console.log('Main clientHeight:', main ? main.clientHeight : 'not found');
                
                // Get computed styles to check for padding/margin
                if (main) {
                  const styles = window.getComputedStyle(main);
                  console.log('Main padding-top:', styles.paddingTop);
                  console.log('Main padding-bottom:', styles.paddingBottom);
                  console.log('Main margin-top:', styles.marginTop);
                  console.log('Main margin-bottom:', styles.marginBottom);
                  console.log('Main border-top:', styles.borderTopWidth);
                  console.log('Main border-bottom:', styles.borderBottomWidth);
                  console.log('Main box-shadow:', styles.boxShadow);
                  
                  // Calculate actual content height without padding and borders
                  const paddingTop = parseInt(styles.paddingTop) || 0;
                  const paddingBottom = parseInt(styles.paddingBottom) || 0;
                  const borderTop = parseInt(styles.borderTopWidth) || 0;
                  const borderBottom = parseInt(styles.borderBottomWidth) || 0;
                  const mainContentHeight = main.clientHeight - paddingTop - paddingBottom;
                  console.log('📏 Main content height (without padding):', mainContentHeight);
                  console.log('📏 Border sizes:', borderTop + 'px top, ' + borderBottom + 'px bottom');
                  
                  // Use content height without padding
                  const height = Math.max(
                    mainContentHeight,
                    body.clientHeight - (paddingTop + paddingBottom),
                    html.clientHeight - (paddingTop + paddingBottom)
                  );
                  
                  console.log('📏 Final calculated height:', height);
                  
                  // Try to get the actual dashboard content height
                  const dashboardContent = document.querySelector('.grid-container') || 
                                          document.querySelector('[class*="grid"]') ||
                                          document.querySelector('.flex');
                  if (dashboardContent) {
                    const contentHeight = dashboardContent.getBoundingClientRect().height;
                    console.log('📏 Dashboard content height:', contentHeight);
                    
                    // Get the bottom position of the lowest element
                    const allElements = document.querySelectorAll('[data-add-project-widget], [data-logs-widget], [data-daily-widget]');
                    let maxBottom = 0;
                    allElements.forEach(el => {
                      const rect = el.getBoundingClientRect();
                      const bottom = rect.bottom;
                      if (bottom > maxBottom) {
                        maxBottom = bottom;
                      }
                    });
                    console.log('📍 Max bottom position of widgets:', maxBottom);
                    
                    // Use the actual bottom position plus minimal padding
                    const finalHeight = Math.min(Math.ceil(maxBottom + 35), 1080); // +35px for minimal spacing
                    console.log('📏 Final height based on widget positions:', finalHeight);
                    
                    // Get the actual content dimensions
                    const width = Math.max(
                      body.scrollWidth,
                      body.offsetWidth,
                      html.clientWidth,
                      html.scrollWidth,
                      html.offsetWidth
                    );
                    
                    console.log('📏 Calculated size:', width + 'x' + finalHeight);
                    
                    // Add minimal padding (smaller than before)
                    const finalWidth = Math.min(width + 20, 1920); // Reduced padding
                    const finalWindowHeight = Math.min(finalHeight + 0, 1080); // No extra padding
                    
                    // Ensure minimum window size
                    const windowWidth = Math.max(finalWidth, 1000);
                    const windowHeight = Math.max(finalWindowHeight, 700);
                    
                    console.log('📐 Final window size:', windowWidth + 'x' + windowHeight);
                    
                    resolve({ width: windowWidth, height: windowHeight });
                  } else {
                    console.log('❌ Dashboard content not found');
                    // Fallback to original calculation
                    const width = Math.max(
                      body.scrollWidth,
                      body.offsetWidth,
                      html.clientWidth,
                      html.scrollWidth,
                      html.offsetWidth
                    );
                    
                    console.log('📏 Calculated size:', width + 'x' + height);
                    
                    // Add minimal padding (smaller than before)
                    const finalWidth = Math.min(width + 20, 1920); // Reduced padding
                    const finalHeight = Math.min(height + 2, 1080); // Minimal padding
                    
                    // Ensure minimum window size
                    const windowWidth = Math.max(finalWidth, 1000);
                    const windowHeight = Math.max(finalHeight, 700);
                    
                    console.log('📐 Final window size:', windowWidth + 'x' + windowHeight);
                    
                    resolve({ width: windowWidth, height: windowHeight });
                  }
                } else {
                  console.log('❌ Main element not found');
                  return { width: 1200, height: 800 };
                }
              }, 1500); // Wait for widget adjustments
            });
          } catch (error) {
            console.log('❌ Error in measurement:', error);
            return { width: 1200, height: 800 };
          }
        })()
      `).then((contentSize) => {
        if (contentSize && contentSize.width && contentSize.height) {
          console.log(`✅ Setting window size to ${contentSize.width}x${contentSize.height}`);
          // Set window size without animation
          mainWindow.setSize(contentSize.width, contentSize.height, false);
          
          // Center window on screen
          mainWindow.center();
          
          // Now show the window with correct size
          mainWindow.show();
        } else {
          console.log('❌ Invalid content size, using fallback');
          mainWindow.setSize(1200, 800, false);
          mainWindow.center();
          mainWindow.show();
        }
      }).catch((error) => {
        console.log('❌ Could not get content size:', error);
        // Fallback to smaller default size
        mainWindow.setSize(1200, 800, false);
        mainWindow.center();
        mainWindow.show();
      });
    }, 2500); // Wait longer for all JavaScript to complete
  });
  */

  // Handle page load events
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for window controls
ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('is-maximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized();
  }
  return false;
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});
