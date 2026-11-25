/** Historical logs are preserved in storage, but old raw free-text diffs are not redisplayed/exported wholesale. */
const safeKeys=new Set(['role','is_active','status','price_lakh','km','year','make','model','variant','fuel','transmission','body','featured','sort_order','asset','state','cover_changed','previous_count','selected_count']);
function scalar(value:unknown):unknown{
 if(value===null||typeof value==='number'||typeof value==='boolean')return value;
 if(typeof value==='string')return value.slice(0,200);
 if(value&&typeof value==='object'&&!Array.isArray(value)){const record=value as Record<string,unknown>;return {from:scalarLeaf(record.from),to:scalarLeaf(record.to)};}
 return '[omitted]';
}
function scalarLeaf(value:unknown){return typeof value==='string'?value.slice(0,200):value===null||typeof value==='number'||typeof value==='boolean'?value:'[omitted]';}
export function safeAuditChanges(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return{};return Object.fromEntries(Object.entries(value).filter(([key])=>safeKeys.has(key)).map(([key,val])=>[key,scalar(val)]));}
