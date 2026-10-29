export function validatedProductionUrl(base){
 const u=new URL(base);
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||
    (u.pathname!=="/"&&u.pathname!==""))
  throw Error("Production smoke URL must be an HTTPS origin without credentials or parameters");
 return u;
}
export function releaseMatches(release,expected){
 if(typeof release!=="string"||!/^[0-9a-f]{12}$/i.test(release))return false;
 if(!expected)return true;
 return /^[0-9a-f]{40}$/i.test(expected)&&release.toLowerCase()===expected.slice(0,12).toLowerCase();
}
