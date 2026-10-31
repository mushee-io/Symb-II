"use strict";

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

module.exports={ALLOWED_ORIGIN,TERMINAL_URL,isAllowedAppNavigation};
