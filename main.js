/*
 * VXCode
 * Copyright (c) 2026 VX VXVULGO
 * Licensed under the MIT License.
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, nativeImage } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const { spawn } = require('child_process')

let mainWindow
let terminalProcess = null

// ─── DISCORD RICH PRESENCE ────────────────────────────────
let rpc = null
let startTimestamp = null
let discordFile   = 'Nenhum arquivo'
let discordFolder = 'VXCode'

function initDiscord() {
  try {
    const { Client } = require('discord-rpc')
    rpc = new Client({ transport: 'ipc' })
    startTimestamp = new Date()
    rpc.on('ready', () => { console.log('[Discord] Conectado!'); updatePresence() })
    rpc.login({ clientId: '1476731773407723540' }).catch(e => { console.log('[Discord]', e.message); rpc = null })
  } catch(e) { console.log('[Discord] Não instalado:', e.message); rpc = null }
}

function updatePresence() {
  if (!rpc) return
  try {
    const ext = discordFile.includes('.') ? discordFile.split('.').pop().toLowerCase() : ''
    const langs = { lua:'Lua',js:'JavaScript',ts:'TypeScript',html:'HTML',css:'CSS',sql:'SQL',py:'Python',cs:'C#',json:'JSON',xml:'XML',md:'Markdown',sh:'Shell',php:'PHP',cpp:'C++',c:'C' }
    rpc.setActivity({
      details: discordFile === 'Nenhum arquivo' ? '📂 Sem arquivo aberto' : `📝 Editando ${discordFile}`,
      state:   `📁 ${discordFolder}`,
      startTimestamp,
      largeImageKey:  'vxcode',
      largeImageText: 'VXCode by VX VULGO OFICIAL',
      smallImageText: langs[ext] || 'Código',
      buttons: [{ label: '⚡ VXCode', url: 'https://github.com' }]
    })
  } catch(e) { console.log('[Discord] Erro:', e.message) }
}

// ─── JANELA ───────────────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0a0e1a',
    icon,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [''] } })
  })
  mainWindow.once('ready-to-show', () => { mainWindow.show(); initDiscord() })
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools()
  })
  Menu.setApplicationMenu(null)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (rpc) { try { rpc.destroy() } catch(e) {} }
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ─── IPC JANELA ───────────────────────────────────────────
ipcMain.on('win-close',    () => mainWindow.close())
ipcMain.on('win-minimize', () => mainWindow.minimize())
ipcMain.on('win-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.handle('win-is-maximized', () => mainWindow.isMaximized())

// ─── IPC DISCORD ──────────────────────────────────────────
ipcMain.on('discord:update', (_, { file, folder }) => {
  if (file)   discordFile   = file
  if (folder) discordFolder = folder
  updatePresence()
})

// ─── SESSÃO ───────────────────────────────────────────────
const sessionPath = path.join(os.homedir(), '.vxcode-session.json')

ipcMain.handle('session:load', async () => {
  try { if (fs.existsSync(sessionPath)) return JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) } catch(e) {}
  return null
})
ipcMain.handle('session:save', async (_, data) => {
  try { fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf-8'); return { success: true } }
  catch(e) { return { success: false } }
})

// ─── CONFIGURAÇÕES ────────────────────────────────────────
const configPath = path.join(os.homedir(), '.vxcode-settings.json')
ipcMain.handle('config:load', async () => {
  try { if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch(e) {}
  return null
})
ipcMain.handle('config:save', async (_, config) => {
  try { fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8'); return { success: true } }
  catch(e) { return { success: false } }
})

// ─── ARQUIVOS ─────────────────────────────────────────────
ipcMain.handle('fs:open-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (r.canceled) return null
  const p = r.filePaths[0]
  return { folderPath: p, name: path.basename(p), tree: buildTree(p) }
})

ipcMain.handle('fs:open-file', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Todos os Arquivos', extensions: ['*'] },
      { name: 'Lua', extensions: ['lua'] },
      { name: 'JavaScript', extensions: ['js','mjs'] },
      { name: 'TypeScript', extensions: ['ts'] },
      { name: 'HTML/CSS', extensions: ['html','css'] },
      { name: 'SQL', extensions: ['sql'] },
      { name: 'XML/JSON', extensions: ['xml','json'] },
      { name: 'Imagens', extensions: ['png','jpg','jpeg','gif','svg','webp','bmp'] },
      { name: 'Texto', extensions: ['txt','md'] },
    ]
  })
  if (r.canceled) return null
  const filePath = r.filePaths[0]
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const imgExts = ['png','jpg','jpeg','gif','svg','webp','bmp','ico']
  if (imgExts.includes(ext)) {
    const data = fs.readFileSync(filePath)
    const b64  = data.toString('base64')
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return { filePath, name: path.basename(filePath), content: `data:${mime};base64,${b64}`, isImage: true }
  }
  try {
    return { filePath, name: path.basename(filePath), content: fs.readFileSync(filePath, 'utf-8') }
  } catch(e) {
    return { filePath, name: path.basename(filePath), content: '[Arquivo binário]' }
  }
})

ipcMain.handle('fs:read-file', async (_, filePath) => {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const imgExts = ['png','jpg','jpeg','gif','svg','webp','bmp','ico']
  if (imgExts.includes(ext)) {
    try {
      const data = fs.readFileSync(filePath)
      const b64  = data.toString('base64')
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
      return { success: true, content: `data:${mime};base64,${b64}`, isImage: true }
    } catch(e) { return { success: false, error: e.message } }
  }
  try { return { success: true, content: fs.readFileSync(filePath, 'utf-8') } }
  catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:save-file', async (_, { filePath, content }) => {
  try {
    if (filePath) { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true, filePath } }
    const r = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Todos', extensions: ['*'] }, { name: 'Lua', extensions: ['lua'] }]
    })
    if (r.canceled) return { success: false }
    fs.writeFileSync(r.filePath, content, 'utf-8')
    return { success: true, filePath: r.filePath }
  } catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:new-file', async (_, { dirPath, name }) => {
  try {
    const filePath = path.join(dirPath, name)
    if (fs.existsSync(filePath)) return { success: false, error: 'Arquivo já existe' }
    fs.writeFileSync(filePath, '', 'utf-8')
    return { success: true, filePath }
  } catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:new-folder', async (_, { dirPath, name }) => {
  try { fs.mkdirSync(path.join(dirPath, name), { recursive: true }); return { success: true } }
  catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:delete', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true })
    else fs.unlinkSync(filePath)
    return { success: true }
  } catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:rename', async (_, { oldPath, newName }) => {
  try { const np = path.join(path.dirname(oldPath), newName); fs.renameSync(oldPath, np); return { success: true, newPath: np } }
  catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:refresh-tree', async (_, folderPath) => {
  try { return { success: true, tree: buildTree(folderPath) } }
  catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('fs:search', async (_, { folderPath, query, caseSensitive, useRegex }) => {
  if (!folderPath || !query) return []
  const results = []
  try { searchInFolder(folderPath, query, caseSensitive, useRegex, results) } catch(e) {}
  return results.slice(0, 500)
})

// ─── TERMINAL ─────────────────────────────────────────────
ipcMain.handle('terminal:create', async (_, cwd) => {
  if (terminalProcess) { try { terminalProcess.kill() } catch(e) {} terminalProcess = null }
  const shell = process.platform === 'win32' ? (process.env.ComSpec||'cmd.exe') : (process.env.SHELL||'/bin/bash')
  const args  = process.platform === 'win32' ? [] : ['--login']
  try {
    terminalProcess = spawn(shell, args, {
      cwd: cwd && fs.existsSync(cwd) ? cwd : os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe','pipe','pipe']
    })
    const send = d => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:data', d.toString()) }
    terminalProcess.stdout.on('data', send)
    terminalProcess.stderr.on('data', send)
    terminalProcess.on('close', code => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:closed', code); terminalProcess = null })
    terminalProcess.on('error', err => send(`\r\nErro: ${err.message}\r\n`))
    return { success: true }
  } catch(e) { return { success: false, error: e.message } }
})
ipcMain.on('terminal:write', (_, d) => { if (terminalProcess?.stdin && !terminalProcess.stdin.destroyed) { try { terminalProcess.stdin.write(d) } catch(e) {} } })
ipcMain.handle('terminal:kill', async () => { if (terminalProcess) { try { terminalProcess.kill() } catch(e) {} terminalProcess = null }; return { success: true } })

// ─── HELPERS ──────────────────────────────────────────────
const IGNORE = new Set(['.git','node_modules','__pycache__','.DS_Store','dist','build','.next'])

function buildTree(dir, depth=0) {
  if (depth > 8) return []
  let items; try { items = fs.readdirSync(dir) } catch { return [] }
  const folders=[], files=[]
  for (const item of items) {
    if (IGNORE.has(item)) continue
    if (item.startsWith('.') && item!=='.env' && item!=='.gitignore') continue
    const full = path.join(dir, item)
    let stat; try { stat = fs.statSync(full) } catch { continue }
    if (stat.isDirectory()) folders.push({ name:item, type:'folder', path:full, children:buildTree(full, depth+1) })
    else files.push({ name:item, type:'file', path:full, ext:path.extname(item).slice(1), size:stat.size })
  }
  return [...folders.sort((a,b)=>a.name.localeCompare(b.name)), ...files.sort((a,b)=>a.name.localeCompare(b.name))]
}

function searchInFolder(dir, query, cs, rx, results, max=500) {
  if (results.length >= max) return
  let items; try { items = fs.readdirSync(dir) } catch { return }
  for (const item of items) {
    if (results.length >= max) return
    if (IGNORE.has(item)) continue
    const full = path.join(dir, item)
    let stat; try { stat = fs.statSync(full) } catch { continue }
    if (stat.isDirectory()) { searchInFolder(full, query, cs, rx, results, max); continue }
    if (stat.size > 1024*1024) continue
    const imgExts = new Set(['png','jpg','jpeg','gif','svg','webp','bmp','ico','ttf','otf','woff','woff2'])
    if (imgExts.has(path.extname(item).slice(1).toLowerCase())) continue
    try {
      const lines = fs.readFileSync(full, 'utf-8').split('\n')
      for (let i=0; i<lines.length; i++) {
        if (results.length >= max) return
        const line = lines[i]; let match = false
        if (rx) { try { match = new RegExp(query, cs?'':'i').test(line) } catch {} }
        else match = cs ? line.includes(query) : line.toLowerCase().includes(query.toLowerCase())
        if (match) results.push({ file:full, name:item, line:i+1, text:line.trim().slice(0,200), col: cs ? line.indexOf(query) : line.toLowerCase().indexOf(query.toLowerCase()) })
      }
    } catch {}
  }
}
