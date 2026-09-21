import type {FieldSnapshot} from '../../fields/model';
import {fieldValueText} from '../../fields/editor';
export function FieldValues({fields=[],locale='zh-CN'}:{fields?:FieldSnapshot[];locale?:'zh-CN'|'en'}){if(!fields.length)return null;return <section className="field-values" aria-label={locale==='en'?'Custom fields':'自定义资料'}><h2>{locale==='en'?'Custom fields':'自定义资料'}</h2><dl>{fields.map(f=><div key={f.id}><dt>{f.name}</dt><dd>{locale==='en'?(f.value===null?'—':typeof f.value==='boolean'?(f.value?'Yes':'No'):String(f.value)):fieldValueText(f.value)}</dd></div>)}</dl></section>;}
