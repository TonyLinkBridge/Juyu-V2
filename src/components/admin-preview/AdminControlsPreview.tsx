'use client';
import {useState} from 'react';
import {CopyButton} from '../ui/copy-button';
import styles from './admin-controls-preview.module.css';
export function AdminControlsPreview(){
 const [draft,setDraft]=useState('域名转入操作指南\n\n1. 核对客户授权。\n2. 确认域名状态。\n3. 记录处理结果。');
 return <section className={styles.panel} aria-labelledby="copy-preview-title"><div><h2 id="copy-preview-title">草稿复制</h2><p>复制整份输入，方便备份或交给同事核对。</p></div><label className={styles.label}>示例草稿<textarea value={draft} onChange={event=>setDraft(event.target.value)} rows={6} spellCheck={false}/></label><div className={styles.actions}><CopyButton value={draft} label="复制当前输入"/><small>这份示例只留在当前页面，请先复制再关闭。</small></div></section>;
}
