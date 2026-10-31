"use strict";

/**
 * Read-only Electron shell. Never give a remote renderer Node.js access.
 * This shell deliberately exposes NO IPC, signing, key storage or trade APIs.
 */
const {app,BrowserWindow,session}=require("electron");
const path=require("node:path");

const {ALLOWED_ORIGIN,TERMINAL_URL,isAllowedAppNavigation}=require("./security-policy.cjs");
const OFFLINE_PAGE=path.join(__dirname,"offline.html");

function createWindow(){
  let offlineShown=false;
  const window=new BrowserWindow({
    title:"Symb-II Desktop — Read-only",
    width:1450,
    height:940,
    minWidth:980,
    minHeight:660,
    show:false,
    backgroundColor:"#0b100e",
    autoHideMenuBar:true,
    webPreferences:{
      sandbox:true,
      contextIsolation:true,
      nodeIntegration:false,
      webSecurity:true,
      allowRunningInsecureContent:false,
      webviewTag:false,
      devTools:!app.isPackaged,
    },
  });

  // Close all new window requests. The website may display its own
  // non-sensitive explorer links in regular browsers, not this shell.
  window.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  window.webContents.on("will-navigate",(event,url)=>{
    if(!isAllowedAppNavigation(url))event.preventDefault();
  });
  window.webContents.on("will-redirect",(event,url)=>{
    if(!isAllowedAppNavigation(url))event.preventDefault();
  });
  window.webContents.on("will-attach-webview",(event)=>event.preventDefault());
  window.once("ready-to-show",()=>window.show());
  // No hidden remote download can place a Windows executable or data file
  // onto the device. All updates require a separate signed release path.
  window.webContents.on("did-finish-load",()=>{
    if(window.webContents.getURL().startsWith(ALLOWED_ORIGIN+"/")){
      offlineShown=false;
    }
  });
  window.webContents.on("did-fail-load",(_event,code,_description,_url,isMainFrame)=>{
    // -3 is an intentionally cancelled navigation. Subframe failures must
    // never replace the whole trading terminal with an offline screen.
    if(code===-3||!isMainFrame||offlineShown||window.isDestroyed())return;
    offlineShown=true;
    void window.loadFile(OFFLINE_PAGE).catch(()=>{
      if(!window.isDestroyed()&&!window.isVisible())window.show();
    });
  });
  void window.loadURL(TERMINAL_URL);
  return window;
}

app.whenReady().then(()=>{
  // A remote site cannot obtain camera, microphone, geolocation,
  // notifications, USB, HID or other privileged browser permissions.
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,respond)=>respond(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.on("will-download",(event)=>event.preventDefault());
  if(process.platform==="win32")app.setAppUserModelId("xyz.mushee.symbii.desktop");
  createWindow();
  app.on("activate",()=>{
    if(BrowserWindow.getAllWindows().length===0)createWindow();
  });
});
app.on("window-all-closed",()=>{
  if(process.platform!=="darwin")app.quit();
});
