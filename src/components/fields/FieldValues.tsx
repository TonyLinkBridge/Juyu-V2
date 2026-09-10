import type {FieldSnapshot} from '../../fields/model';
import {fieldValueText} from '../../fields/editor';
export function FieldValues({fields=[]}:{fields?:FieldSnapshot[]}){if(!fields.length)return null;return <section className="field-values" aria-label="自定义资料"><h2>自定义资料</h2><dl>{fields.map(f=><div key={f.id}><dt>{f.name}</dt><dd>{fieldValueText(f.value)}</dd></div>)}</dl></section>;}
