export const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export function streamURL(model){if(!/^models\/[\w.-]+$/.test(model))throw Error('Select a valid Gemini model.');return `${API_BASE}/${model}:streamGenerateContent?alt=sse`;}
// No HTML from messages is interpreted. Markdown is constructed with DOM nodes.
export function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
export function inline(text, parent) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(start, match.index)));
    const value = match[0];
    if (value.startsWith('`')) parent.append(node('code', value.slice(1,-1)));
    else if (value.startsWith('**')) parent.append(node('strong', value.slice(2,-2)));
    else if (value.startsWith('*')) parent.append(node('em', value.slice(1,-1)));
    else { const [,label,url] = value.match(/^\[([^\]]+)\]\((.+)\)$/); if (/^https?:\/\//i.test(url)) { const link = node('a',label); link.href=url; link.target='_blank'; link.rel='noopener noreferrer'; parent.append(link); } else parent.append(document.createTextNode(label)); }
    start = match.index + value.length;
  }
  parent.append(document.createTextNode(text.slice(start)));
}
export function highlight(text, parent) {
  const re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|def|print|True|False|None|null|true|false)\b)/g;
  let pos=0;
  for (const m of text.matchAll(re)) { parent.append(document.createTextNode(text.slice(pos,m.index)),node('span',m[0],/^["']/.test(m[0])?'syntax-string':'syntax-key')); pos=m.index+m[0].length; }
  parent.append(document.createTextNode(text.slice(pos)));
}
export function markdown(text, parent) {
  parent.replaceChildren(); const lines=text.split('\n');
  for(let i=0;i<lines.length;i++) {
    const line=lines[i]; if(!line.trim()) continue;
    if(line.startsWith('```')) { const language=line.slice(3).trim(); const code=[]; while(++i<lines.length&&!lines[i].startsWith('```')) code.push(lines[i]); const pre=node('pre'); const copy=node('button','Copy code'); copy.type='button'; copy.addEventListener('click',()=>copyText(code.join('\n'),copy)); const content=node('code'); content.setAttribute('aria-label',language||'Code'); highlight(code.join('\n'),content); pre.append(copy,content); parent.append(pre); continue; }
    if(i+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])) { const wrap=node('div',undefined,'table-wrap'),table=node('table'); const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()); const row=(s,tag)=>{ const tr=node('tr'); for(const cell of cells(s)){const td=node(tag);inline(cell,td);tr.append(td);}return tr; };const head=node('thead');head.append(row(line,'th'));table.append(head);i++;const body=node('tbody');while(i+1<lines.length&&lines[i+1].includes('|')) body.append(row(lines[++i],'td'));table.append(body);wrap.append(table);parent.append(wrap);continue; }
    const heading=line.match(/^(#{1,6})\s+(.+)/);if(heading){const h=node('h'+heading[1].length);inline(heading[2],h);parent.append(h);continue;}
    if(/^\s*(?:[-*+] |\d+\. )/.test(line)){ const ordered=/^\s*\d+\./.test(line);const list=node(ordered?'ol':'ul');let current=line;while(true){const li=node('li');inline(current.replace(/^\s*(?:[-*+]|\d+\.)\s+/,''),li);list.append(li);if(i+1>=lines.length||!(ordered?/^\s*\d+\. /:/^\s*[-*+] /).test(lines[i+1]))break;current=lines[++i];}parent.append(list);continue; }
    const p=node(line.startsWith('> ')?'blockquote':'p'); inline(line.replace(/^> /,''),p);parent.append(p);
  }
}
export async function copyText(text,button){try{await navigator.clipboard.writeText(text);button.textContent='Copied';}catch{button.textContent='Copy unavailable';}}
export function validateImport(data) {
  if(!data||data.version!==1||!Array.isArray(data.conversations)||data.conversations.length>1000) throw Error('Invalid conversation file. Expected a version 1 export (up to 1,000 conversations).');
  return data.conversations.map(c=>{
    if(!c||typeof c.title!=='string'||c.title.length>200||!Array.isArray(c.messages)||c.messages.length>2000)throw Error('Invalid conversation history.');
    return {id:crypto.randomUUID(),title:c.title,updated:Date.now(),messages:c.messages.map(m=>{if(!m||!['user','model'].includes(m.role)||typeof m.text!=='string'||m.text.length>200000)throw Error('Invalid conversation message.');return {role:m.role,text:m.text,complete:m.complete!==false};})};
  });
}
export function contents(messages){
  const valid=messages.filter(m=>m.text.trim()&&m.complete!==false);let previous='model';
  for(const m of valid){if(!['user','model'].includes(m.role)||m.role===previous)throw Error('Invalid conversation history. Edit the last question or start a new conversation.');previous=m.role;}
  if(!valid.length||valid.at(-1).role!=='user')throw Error('A user question is required.');
  return valid.map(m=>({role:m.role,parts:[{text:m.text}]}));
}
export function config(prefs,model){const out={};if(prefs.temperature!==''){const n=Number(prefs.temperature);if(!Number.isFinite(n)||n<0||n>Math.min(2,model?.maxTemperature??2))throw Error('Temperature must be between 0 and 2.');out.temperature=n;}if(prefs.tokens!==''){const n=Number(prefs.tokens);if(!Number.isSafeInteger(n)||n<1||(model?.outputTokenLimit&&n>model.outputTokenLimit))throw Error('Maximum output tokens must be a positive integer within this model’s output limit.');out.maxOutputTokens=n;}return out;}
export function apiError(status){return ({400:'Google rejected the request. Check generation options and the conversation/context token limits; try a new conversation.',401:'The API key is invalid or revoked. Replace it in Settings.',403:'Access denied. Check your API key, API restrictions, and regional availability.',404:'Google returned HTTP 404 for this generation request. Listing models does not confirm generation access.',429:'Rate limit or quota exceeded. Wait before retrying, or check your Google quota and billing.',500:'Gemini encountered a service error. Try again later.',503:'Gemini is temporarily unavailable. Try again later.',504:'Gemini timed out. Try again or shorten the conversation.'})[status]||'The request failed. Please try again.';}
export async function listModels(key,signal,fetcher=fetch){let token='',all=[];do{const url=new URL(`${API_BASE}/models`);url.searchParams.set('pageSize','1000');if(token)url.searchParams.set('pageToken',token);const r=await fetcher(url,{headers:{'x-goog-api-key':key},signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error(apiError(r.status));const data=await r.json();all.push(...(data.models||[]));token=data.nextPageToken||'';}while(token);return all.filter(m=>/^models\/[\w.-]+$/.test(m.name)&&m.supportedGenerationMethods?.includes('generateContent')&&!/(embedding|image|tts|robotics|video|computer-use)/i.test(m.name));}
export async function readSSE(body,onData){const reader=body.getReader(),decoder=new TextDecoder();let buffer='';const event=block=>{const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data&&data!=='[DONE]')onData(JSON.parse(data));};try{while(true){const {done,value}=await reader.read();buffer=(buffer+decoder.decode(value||new Uint8Array(),{stream:!done})).replace(/\r\n/g,'\n');let boundary;while((boundary=buffer.indexOf('\n\n'))!==-1){event(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);}if(done){if(buffer.trim())event(buffer);break;}}}finally{reader.releaseLock();}}
export function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('kirk-ai',1);req.onupgradeneeded=()=>req.result.createObjectStore('conversations',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Browser storage unavailable. This session will remain in memory; export before leaving.'));req.onblocked=()=>reject(Error('History storage is blocked by another tab. Close other AI tabs and reload.'));});}
export function dbAction(db,mode,action){return new Promise((resolve,reject)=>{const tx=db.transaction('conversations',mode);const req=action(tx.objectStore('conversations'));tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(Error('Could not save local history. Export your conversations before leaving.'));tx.onabort=tx.onerror;});}

// Keep Google's useful diagnostic, but never render credentials or request headers.
export function safeDiagnostic(message, key='') {
  if(typeof message!=='string')return '';
  let safe=key?message.split(key).join('[redacted]'):message;
  return safe.replace(/(?:AIza[\w-]{15,}|AQ\.[\w.-]{15,})/g,'[redacted]')
    .replace(/(x-goog-api-key|authorization|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,'$1: [redacted]')
    .replace(/https?:\/\/[^\s]+/g,url=>url.split('?')[0])
    .replace(/[\w.-]{40,}/g,'[redacted]').slice(0,800);
}
export async function responseError(response,key,model) {
  let detail='',status='';
  try {const data=await response.json();const error=(Array.isArray(data)?data[0]:data)?.error;if(error&&typeof error==='object'){detail=safeDiagnostic(error.message,key);if(typeof error.status==='string'&&/^[A-Z_]{1,40}$/.test(error.status))status=error.status;}} catch { /* Never display raw HTML or JSON parser errors. */ }
  const context=/^models\/[\w.-]+$/.test(model||'')?` Model: ${model}.`:'';
  return `${apiError(response.status)}${context}${status?` Status: ${status}.`:''}${detail?` Google says: ${detail}`:''}`;
}
