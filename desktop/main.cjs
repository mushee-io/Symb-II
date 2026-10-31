"use strict";

/**
 * Read-only Electron shell. Never give a remote renderer Node.js access.
 * This shell deliberately exposes NO IPC, signing, key storage or trade APIs.
 */
const {app,BrowserWindow,session}=require("electron");

const ALLOWED_ORIGIN="https://symb-ii.vercel.app";
const TERMINAL_URL=ALLOWED_ORIGIN+"/workspace/terminal";

function isAllowedAppNavigation(candidate){
  try {
    const url=new URL(candidate);
    return url.origin===ALLOWED_ORIGIN &&
      (url.pathname==="/workspace"||url.pathname.startsWith("/workspace/")||
       url.pathname==="/agent");
  } catch {
    return false;
  }
}

function createWindow(){
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
  window.webContents.on("did-fail-load",(_event,code)=>{
    // -3 indicates a deliberately cancelled navigation.
    if(code!==-3 && !window.isVisible())window.show();
  });
  void window.loadURL(TERMINAL_URL);
  return window;
}

app.whenReady().then(()=>{
  // A remote site cannot obtain camera, microphone, geolocation,
  // notifications, USB, HID or other privileged browser permissions.
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,respond)=>respond(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  createWindow();
  app.on("activate",()=>{
    if(BrowserWindow.getAllWindows().length===0)createWindow();
  });
});
app.on("window-all-closed",()=>{
  if(process.platform!=="darwin")app.quit();
});
