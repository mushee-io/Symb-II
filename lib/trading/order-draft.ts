import type {NadoMarket} from "@/lib/nado/types";

export type TerminalCommand =
  | {ok:true;market:NadoMarket;side:"long"|"short";notional:number;leverage:number}
  | {ok:false;reason:string};

/** A bounded, deterministic parser for local UI drafts. Never generates orders or transactions. */
export function parseTerminalCommand(text:string,markets:NadoMarket[],fallbackLeverage=2):TerminalCommand{
  const prompt=text.trim();
  if(!prompt)return {ok:false,reason:"Enter an instruction first. No network transaction will be created."};
  const sideMatch=prompt.match(/\b(long|short|buy|sell)\b/i);
  const cashMatch=prompt.match(/\$\s*(\d+(?:\.\d+)?)/);
  const leverageMatch=prompt.match(/\b(\d+(?:\.\d+)?)\s*x\b/i);
  // Nado's canonical base is BTC-PERP; commands normally say "BTC".
  const market=markets.find(m=>{
    const asset=m.base.replace(/-PERP$/i,"").replace(/[^A-Za-z0-9]/g,"");
    return asset.length>0&&new RegExp("\\b"+asset+"\\b","i").test(prompt);
  });
  if(!sideMatch||!cashMatch||!market){
    return {ok:false,reason:"Could not safely parse a side, $ notional and supported market. Try: Prepare a $500 BTC long at 2x."};
  }
  const notional=Number(cashMatch[1]);
  const leverage=leverageMatch?Number(leverageMatch[1]):fallbackLeverage;
  if(!Number.isFinite(notional)||notional<=0||!Number.isFinite(leverage)||leverage<1||leverage>10){
    return {ok:false,reason:"Draft rejected: use a positive USD notional and leverage from 1x to 10x."};
  }
  return {ok:true,market,side:/long|buy/i.test(sideMatch[1])?"long":"short",notional,leverage};
}

/** Basic arithmetic only, never an exchange quote or verified margin requirement. */
export function calculateDraftIllustration(notional:number,leverage:number,lastPrice:number){
  if(!Number.isFinite(notional)||notional<=0||!Number.isFinite(leverage)||leverage<1||leverage>10||
     !Number.isFinite(lastPrice)||lastPrice<=0)return null;
  return {simpleMarginDivision:notional/leverage,approximateQuantity:notional/lastPrice,grossOnePercentMove:notional*0.01};
}
