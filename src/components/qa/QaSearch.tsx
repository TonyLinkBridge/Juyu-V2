import Form from 'next/form';
import type {QaPage} from '../../qa/model';
export function QaSearch({data,locale='zh-CN'}:{data:QaPage;locale?:'zh-CN'|'en'}){
 const english=locale==='en',label=(zh:string,en:string)=>english?en:zh;
 return <Form action="/help-centre/qa" className="qa-search"><label className="sr-only" htmlFor="qa-search">{label('搜索问题或答案','Search questions or answers')}</label><input key={data.q??''} id="qa-search" name="q" type="search" maxLength={120} defaultValue={data.q??''} placeholder={label('例如：转入失败、修改邮箱、退款','For example: transfer failed, change email, refund')}/>{data.category!==undefined&&<input type="hidden" name="category" value={data.category}/>} {data.topic!==undefined&&<input type="hidden" name="topic" value={data.topic}/>} {english&&<input type="hidden" name="lang" value="en"/>}<button type="submit">{label('搜索问答','Search Q&A')}</button></Form>;
}
