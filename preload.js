/*
 * VXCode
 * Copyright (c) 2026 VX VXVULGO
 * Licensed under the MIT License.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vx', {
  win: {
    close:       () => ipcRenderer.send('win-close'),
    minimize:    () => ipcRenderer.send('win-minimize'),
    maximize:    () => ipcRenderer.send('win-maximize'),
    isMaximized: () => ipcRenderer.invoke('win-is-maximized'),
  },
  fs: {
    openFolder:  ()  => ipcRenderer.invoke('fs:open-folder'),
    openFile:    ()  => ipcRenderer.invoke('fs:open-file'),
    readFile:    (p) => ipcRenderer.invoke('fs:read-file', p),
    saveFile:    (d) => ipcRenderer.invoke('fs:save-file', d),
    newFile:     (d) => ipcRenderer.invoke('fs:new-file', d),
    newFolder:   (d) => ipcRenderer.invoke('fs:new-folder', d),
    delete:      (p) => ipcRenderer.invoke('fs:delete', p),
    rename:      (d) => ipcRenderer.invoke('fs:rename', d),
    refreshTree: (p) => ipcRenderer.invoke('fs:refresh-tree', p),
    search:      (d) => ipcRenderer.invoke('fs:search', d),
  },
  config: {
    load: ()  => ipcRenderer.invoke('config:load'),
    save: (c) => ipcRenderer.invoke('config:save', c),
  },
  session: {
    load: ()  => ipcRenderer.invoke('session:load'),
    save: (d) => ipcRenderer.invoke('session:save', d),
  },
  discord: {
    update: (d) => ipcRenderer.send('discord:update', d),
  },
  terminal: {
    create:  (cwd) => ipcRenderer.invoke('terminal:create', cwd),
    write:   (d)   => ipcRenderer.send('terminal:write', d),
    kill:    ()    => ipcRenderer.invoke('terminal:kill'),
    onData:  (cb)  => ipcRenderer.on('terminal:data',   (_, d) => cb(d)),
    onClose: (cb)  => ipcRenderer.on('terminal:closed', (_, c) => cb(c)),
  }
})
