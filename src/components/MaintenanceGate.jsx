import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";

const getStoredTheme = () => typeof window === "undefined" ? "beige" : localStorage.getItem("archiwiki-theme") || "beige";
const themes = {
  beige:{page:"bg-[#F5F2EB] text-[#202122]",panel:"bg-white/75 border-[#D8CDBA]",muted:"text-neutral-500",accent:"bg-[#2E8B57]",icon:"text-[#2E8B57]"},
  wikipedia:{page:"bg-[#F8F9FA] text-[#202122]",panel:"bg-white border-neutral-300",muted:"text-neutral-600",accent:"bg-[#202122]",icon:"text-[#202122]"},
  charcoal:{page:"bg-neutral-900 text-neutral-100 dark",panel:"bg-neutral-950 border-neutral-700",muted:"text-neutral-400",accent:"bg-neutral-100",icon:"text-neutral-100"}
};

export default function MaintenanceGate({children}) {
  const [checking,setChecking]=useState(true),[maintenance,setMaintenance]=useState(false),[theme,setTheme]=useState(getStoredTheme);
  useEffect(()=>{const sync=()=>setTheme(getStoredTheme());window.addEventListener("storage",sync);window.addEventListener("archiwiki-theme-change",sync);return()=>{window.removeEventListener("storage",sync);window.removeEventListener("archiwiki-theme-change",sync)}},[]);
  useEffect(()=>{
    const maintenanceRef=doc(db,"adminMetrics","maintenance");
    return onSnapshot(maintenanceRef,async snap=>{
      const enabled=snap.exists()&&snap.data()?.inMaintenance===true;
      setMaintenance(enabled);setChecking(false);
      if(enabled&&auth.currentUser){try{await signOut(auth)}catch(error){console.error("Failed to sign out during maintenance:",error)}}
    },error=>{console.error("Failed to read maintenance status:",error);setMaintenance(false);setChecking(false)});
  },[]);
  const palette=themes[theme]||themes.beige;
  if(checking)return <div className={`min-h-screen flex items-center justify-center p-6 ${palette.page}`}><div className={`w-full max-w-md rounded-xl border p-8 text-center shadow-sm ${palette.panel}`}><div className={`mx-auto mb-5 h-2 w-16 rounded-full ${palette.accent}`}/><h1 className="text-2xl font-bold tracking-tight">ArchiWiki</h1><p className={`mt-3 text-sm ${palette.muted}`}>Checking service status…</p></div></div>;
  if(!maintenance)return children;
  return <div className={`min-h-screen flex items-center justify-center p-6 ${palette.page}`}><div className={`w-full max-w-lg rounded-xl border p-8 sm:p-10 text-center shadow-sm ${palette.panel}`}><div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border ${palette.icon}`}><svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12"/><circle cx="12" cy="12" r="3.2"/></svg></div><p className="text-[11px] uppercase tracking-[0.22em] opacity-60">ArchiWiki</p><h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">We'll be back shortly</h1><p className={`mx-auto mt-4 max-w-md text-sm leading-6 ${palette.muted}`}>ArchiWiki is temporarily unavailable while maintenance is being carried out. Please try again later.</p><div className={`mx-auto mt-7 h-px w-20 opacity-30 ${palette.accent}`}/></div></div>;
}
