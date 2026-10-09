import { validateStudioBufferWorkspace } from "./studio-buffer-store.js";
// One noneditable pre-open workspace backup + immutable intent. No URLs/tokens,
// no filesystem grant. A timeout never clears it or authorizes a new request.
export function createStudioDocumentOpenStorage(storage, key, expected) {
 let loaded=false,raw=null,record=null,error=null;
 function normalize(value){
  const r=value?.request,b=validateStudioBufferWorkspace(value?.before,expected);
  if(value?.version!==1||Object.keys(value).some(k=>!['version','request','before'].includes(k))||!b.ok||!r
   ||Object.keys(r).some(k=>!['operationId','bufferId','documentEpoch','expectedRevision','path','sourcePath','resourceDir','discardTarget'].includes(k))
   ||typeof r.operationId!=='string'||!/^[a-f0-9]{48}$/.test(r.operationId)||typeof r.expectedRevision!=='string'||!/^[a-f0-9]{48}$/.test(r.expectedRevision)
   ||!Number.isSafeInteger(r.documentEpoch)||r.documentEpoch<1||!b.state.buffers.some(n=>n.id===r.bufferId)||r.discardTarget!==true
   ||['path','sourcePath','resourceDir'].some(k=>typeof r[k]!=='string'||r[k].length>16384||r[k].includes('\0'))||!r.path)throw Error('Invalid retained file-open record. Keep it for inspection.');
  return Object.freeze({version:1,request:Object.freeze({...r}),before:b.state});
 }
 const failure=e=>({ok:false,reason:'open-storage',message:e.message||'File-open backup storage is unavailable.'});
 function peek(){if(!loaded)try{raw=storage.getItem(key)||null;if(raw?.length>6100000)throw Error('Oversized file-open backup.');record=raw?normalize(JSON.parse(raw)):null;loaded=true;error=null;}catch(e){error=failure(e);}return {record,error};}
 return Object.freeze({peek,
  capture(value){try{peek();if(error)return error;if(record)throw Error('Resolve the existing file-open request first.');const next=normalize(value),encoded=JSON.stringify(next);if(encoded.length>6100000)throw Error('File-open backup exceeds its limit. Nothing was opened.');if((storage.getItem(key)||null)!==raw)throw Error('File-open tracking changed independently.');storage.setItem(key,encoded);if(storage.getItem(key)!==encoded)throw Error('File-open backup readback failed.');raw=encoded;record=next;return {ok:true,record};}catch(e){return failure(e);}},
  clear(operationId){try{peek();if(error)return error;if(!record||record.request.operationId!==operationId)throw Error('The file-open backup changed.');if((storage.getItem(key)||null)!==raw)throw Error('File-open tracking changed independently.');storage.removeItem(key);if(storage.getItem(key))throw Error('File-open backup removal could not be verified.');raw=record=null;return {ok:true};}catch(e){return failure(e);}}
 });
}
