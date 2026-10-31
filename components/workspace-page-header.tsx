import Link from "next/link";
import {ArrowLeft, ShieldCheck} from "lucide-react";

export function WorkspacePageHeader({eyebrow,title,description}:{
  eyebrow:string;title:string;description:string;
}){
  return <div className="workspace-page-head">
    <Link href="/workspace" className="workspace-breadcrumb"><ArrowLeft size={14}/> Workspace overview</Link>
    <span className="eyebrow">{eyebrow}</span>
    <div className="workspace-page-title">
      <div><h1>{title}<span className="title-period">.</span></h1><p>{description}</p></div>
      <span className="workspace-readonly-tag"><ShieldCheck size={14}/> READ ONLY</span>
    </div>
  </div>;
}
