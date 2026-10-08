"use client";
// Cult UI official CopyButton. Source and JUYU adaptations: copy-button.source.json.
import * as React from "react";
import {Check,Copy} from "lucide-react";
import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import styles from "./copy-button.module.css";

const ICON_SPRING = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0,
}

function iconMotion(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      initial: { opacity: 1, scale: 1, filter: "blur(0px)" },
      animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
      exit: { opacity: 1, scale: 1, filter: "blur(0px)" },
      transition: { duration: 0 },
    }
  }
  return {
    initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    transition: ICON_SPRING,
  }
}

function legacyCopyToClipboard(value: string) {
  const textArea = document.createElement("textarea")
  textArea.value = value
  textArea.setAttribute("readonly", "")
  textArea.style.position = "fixed"
  textArea.style.opacity = "0"
  textArea.style.pointerEvents = "none"

  const previousFocus = document.activeElement
  // A modal makes the rest of the document inert; fallback selection must stay inside it.
  const copyHost = document.activeElement?.closest("dialog[open]") ?? document.querySelector("dialog:modal") ?? document.body
  copyHost.appendChild(textArea)
  textArea.focus()
  textArea.select()
  textArea.setSelectionRange(0, value.length)

  let hasCopied = false
  try {
    hasCopied = document.execCommand("copy")
  } catch {
    hasCopied = false
  }

  textArea.remove()
  if (previousFocus instanceof HTMLElement) previousFocus.focus({preventScroll: true})
  return hasCopied
}

export async function copyToClipboardWithMeta(value: string) {
  if (typeof window === "undefined") {
    return false
  }

  if (!value) {
    return false
  }

  let hasCopied = false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      hasCopied = true
    } catch {
      hasCopied = legacyCopyToClipboard(value)
    }
  } else {
    hasCopied = legacyCopyToClipboard(value)
  }

  if (!hasCopied) {
    return false
  }

  return true
}


export interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> {
 value:string;
 label?:string;
 copiedLabel?:string;
 pendingLabel?:string;
 errorLabel?:string;
 onCopied?:()=>void;
 onCopyError?:()=>void;
}
export function CopyButton({value,label='复制',copiedLabel='已复制',pendingLabel='正在复制…',errorLabel='复制未成功，请手动选择文字复制。',className,onCopied,onCopyError,disabled,...props}:CopyButtonProps){
 const [copiedValue,setCopiedValue]=React.useState<string|null>(null);
 const [pending,setPending]=React.useState(false);
 const [failed,setFailed]=React.useState(false);
 const busy=React.useRef(false);
 const restoreFocus=React.useRef<HTMLButtonElement|null>(null);
 const hasCopied=copiedValue===value && copiedValue!==null;
 const reduceMotion=useReducedMotion();
 React.useEffect(()=>{if(copiedValue!==null){const timer=setTimeout(()=>setCopiedValue(null),2000);return()=>clearTimeout(timer);}},[copiedValue]);
 React.useLayoutEffect(()=>{
  if(!pending&&restoreFocus.current){
   if(document.activeElement===document.body)restoreFocus.current.focus({preventScroll:true});
   restoreFocus.current=null;
  }
 },[pending]);
 const motionProps=iconMotion(!!reduceMotion);
 async function handleCopy(button:HTMLButtonElement){
  if(busy.current||disabled||!value)return;
  restoreFocus.current=document.activeElement===button?button:null;
  busy.current=true;setPending(true);setFailed(false);setCopiedValue(null);
  const snapshot=value;
  const ok=await copyToClipboardWithMeta(snapshot);
  busy.current=false;setPending(false);
  if(ok){setCopiedValue(snapshot);onCopied?.();}else{setFailed(true);onCopyError?.();}
 }
 const text=pending?pendingLabel:hasCopied?copiedLabel:label;
 return <>
  <button {...props} type="button" aria-label={text} className={[styles.button,className].filter(Boolean).join(' ')} data-copied={hasCopied} data-slot="copy-button" disabled={disabled||pending||!value} aria-busy={pending} onClick={event=>void handleCopy(event.currentTarget)}>
   <span aria-hidden="true" className={styles.icon}><AnimatePresence initial={false} mode="sync">
    {hasCopied?<motion.span className={styles.glyph} key="check" {...motionProps}><Check strokeWidth={2}/></motion.span>:<motion.span className={styles.glyph} key="copy" {...motionProps}><Copy strokeWidth={2}/></motion.span>}
   </AnimatePresence></span><span aria-live="polite" aria-atomic="true">{text}</span>
  </button>
  {failed&&<p role="status" className={styles.message}>{errorLabel}</p>}
 </>;
}
