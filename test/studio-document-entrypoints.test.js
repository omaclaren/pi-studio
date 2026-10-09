import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createStudioBufferServerStore } from '../shared/studio-buffer-server.js';
const policy = await import('../shared/studio-document-entrypoints.js').catch(error => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const revision='sha256:'+'a'.repeat(64);
const document=(path='/allowed.py')=>({text:'print(1)\n',label:path||'last response',source:path?'file':'last-response',...(path?{path,diskRevision:revision}:{}),resourceDir:'/private/tmp/exact'});
const loader=(path='/allowed.py')=>()=>({ok:true,document:document(path),editorLanguage:'python'});
const store=(extra={})=>createStudioBufferServerStore({hosting:{requireView:true,canonicalPath:p=>p},...extra});
test('trusted bootstrap registers a full Prompt/Document workspace before issuing its URL',()=>{
 const s=store(),r=s.hostingBootstrap({path:'/allowed.py'},loader());assert(r.ok);assert.equal(r.status,'created');const w=s.hostedWorkspace(r.owner.workspaceId);
 assert.equal(w.mode,'full');assert.equal(w.buffers.length,2);assert.equal(w.selectedBufferId,w.activePromptId);const p=w.buffers.find(b=>b.id===w.activePromptId),d=w.buffers.find(b=>b.role==='document');
 assert.equal(p.id,r.owner.bufferId);assert.equal(p.role,'prompt');assert.equal(p.text,p.baselineText);assert.equal(p.diskRevision,revision);assert.equal(p.resourceDir,'/private/tmp/exact');assert.equal(p.view.editorLanguage,'python');assert.equal(p.view.followLatest,true,'fresh full hosted Prompt defaults latest following On');assert.equal(d.view.followLatest,false,'Document remains independent');assert.equal(p.metadata.annotationsEnabled,null);assert.equal(d.text,'');assert.notEqual(d.sourceState.draftId,p.sourceState.draftId);
});
test('bootstrap reuses an unsaved owner before invoking the trusted reader',()=>{
 const s=store(),first=s.hostingBootstrap({path:'/allowed.py'},loader()),id=first.owner.workspaceId,cap=s.issue({workspaceId:id,mode:'full'}).capability;
 const generation=s.bindHostingView(cap,'full',{}).generation,current=s.read(cap),next=structuredClone(current.state);next.revision++;next.savedAt++;next.buffers[0].revision++;next.buffers[0].text='Unsaved original';next.buffers[0].view.followLatest=false;assert(s.write(cap,current.revision,next,generation,current.documents).ok);
 const reused=s.hostingBootstrap({path:'/allowed.py'},()=>{throw Error('must not reread');});assert(reused.ok);assert.equal(reused.status,'reused');assert.deepEqual(reused.owner,first.owner);assert.equal(s.hostedWorkspace(id).buffers[0].text,'Unsaved original');assert.equal(s.hostedWorkspace(id).buffers[0].view.followLatest,false,'reuse preserves an explicit Off');assert.equal(s.size,1);
});
test('bootstrap rechecks ownership after the synchronous reader',()=>{const s=store();let winner;const r=s.hostingBootstrap({path:'/allowed.py'},()=>{winner=s.hostingBootstrap({path:'/allowed.py'},loader());return loader()();});assert(r.ok);assert.equal(r.status,'reused');assert.deepEqual(r.owner,winner.owner);assert.equal(s.size,1);});
test('blank/response launches are distinct explicit command intents',()=>{const s=store(),a=s.hostingBootstrap({},loader(null)),b=s.hostingBootstrap({},loader(null));assert(a.ok&&b.ok);assert.notEqual(a.owner.workspaceId,b.owner.workspaceId);assert.notEqual(a.owner.bufferId,b.owner.bufferId);assert.equal(s.hostedWorkspace(a.owner.workspaceId).buffers[0].sourceState.path,null);});
test('bootstrap refuses missing authorization, asynchronous reads and changed canonical files without registering',()=>{const s=store();assert.equal(s.hostingBootstrap({path:'/allowed.py'},()=>({ok:false,reason:'grant-required'})).reason,'grant-required');assert.equal(s.hostingBootstrap({path:'/allowed.py'},()=>Promise.resolve(loader()())).ok,false);assert.equal(s.hostingBootstrap({path:'/allowed.py'},loader('/other.py')).reason,'source-changed');assert.equal(s.size,0);});
test('bootstrap capacity does not evict old work or prevent owner reuse',()=>{const s=store({maxEntries:1}),first=s.hostingBootstrap({path:'/allowed.py'},loader());assert(first.ok);assert.equal(s.hostingBootstrap({path:'/other.py'},()=>{throw Error('capacity before read');}).reason,'capacity');assert.equal(s.hostingBootstrap({path:'/allowed.py'},()=>{throw Error('reuse before read');}).status,'reused');assert.equal(s.size,1);});
test('pending saved-path claims also win bootstrap ownership lookup',()=>{const s=store(),first=s.hostingBootstrap({path:'/allowed.py'},loader()),cap=s.issue({workspaceId:first.owner.workspaceId,mode:'full'}).capability,generation=s.bindHostingView(cap,'full',{}).generation,current=s.read(cap),r={operationId:'f'.repeat(48),kind:'save-as',bufferId:first.owner.bufferId,documentEpoch:current.documents[first.owner.bufferId],generation,expectedRevision:current.revision,path:'/saved.py',content:'print(1)\n',expectedDiskRevision:null,overwrite:false,force:false};assert(s.hostingSave(cap,r,authorize=>{assert(authorize(r.path).ok);return{ok:true,path:r.path,text:r.content,diskRevision:revision,resourceDir:'/'};}).ok);const reused=s.hostingBootstrap({path:r.path},()=>{throw Error('pending claim must win');});assert(reused.ok);assert.deepEqual(reused.owner,first.owner);});
const page=(query,extra={})=>policy.resolveStudioHostingPage({enabled:true,requestUrl:new URL('http://local/?'+query),mode:query.includes('mode=editor-only')?'editor-only':'full',workspace:()=>null,transient:()=>null,...extra});
test('unregistered editable URLs and forged watch flags fail without reading disk',()=>{for(const q of ['docPath=/secret','mode=editor-only&docPath=/secret','mode=editor-only&watchFile=1&watchedFile=1&docPath=/secret'])assert.equal(page(q).ok,false);});
test('owned page recovery ignores descriptive URL file hints, but not mode or workspace identity',()=>{const w={workspaceId:'host_'+'a'.repeat(48),mode:'full',selectedBufferId:'p',buffers:[{id:'p',text:'Kept unsaved',sourceState:{label:'Kept'}}]};const r=page('hostedWorkspace='+w.workspaceId+'&studioTabState='+w.workspaceId+'&docPath=/secret',{workspace:id=>id===w.workspaceId?w:null});assert(r.ok);assert.equal(r.workspaceId,w.workspaceId);assert.equal(r.document.text,'Kept unsaved');assert.equal(r.document.source,'blank');assert.equal(r.document.path,undefined);for(const q of ['hostedWorkspace='+w.workspaceId+'&mode=editor-only','hostedWorkspace='+w.workspaceId+'&studioTabState=other','hostedWorkspace='+w.workspaceId+'&watchedFile=1'])assert.equal(page(q,{workspace:()=>w}).ok,false);});
test('only the retained watched capability permits a legacy read-only page',()=>{const watched={...document('/watched.md'),watchFile:true};const r=page('mode=editor-only&docId=watch&docPath=/watched.md',{transient:id=>id==='watch'?watched:null});assert(r.ok&&r.watched);assert.deepEqual(r.document,watched);assert.equal(page('mode=editor-only&docId=watch&docPath=/secret',{transient:()=>watched}).ok,false);assert.equal(page('docId=watch',{transient:()=>watched}).ok,false);assert.equal(page('mode=editor-only&docId=watch',{transient:()=>({...watched,watchFile:false})}).ok,false);});
test('off mode stays on the original page resolver without consulting hosting',()=>{assert.deepEqual(page('docPath=/old',{enabled:false,workspace:()=>{throw Error('off');},transient:()=>{throw Error('off');}}),{ok:true,legacy:true});});
test('unsupported hosted command/link paths explicitly refuse before legacy work',()=>{
 for(const values of [{mode:'editor-only'},{mode:'full',replace:true},{mode:'full',current:true}])assert(policy.studioHostingCommandError({enabled:true,...values}));
 assert.equal(policy.studioHostingCommandError({enabled:true,mode:'editor-only',watchedText:true}),null);assert.equal(policy.studioHostingCommandError({enabled:true,mode:'full'}),null);assert.equal(policy.studioHostingCommandError({enabled:false,mode:'editor-only',replace:true,current:true}),null);
 for(const [action,kind] of [['editor-url','text'],['editor-url','office'],['preview-url','pdf'],['document','office']])assert(policy.studioHostingLocalLinkError({enabled:true,action,kind}));
 for(const [action,kind] of [['resolve','office'],['document','text'],['watch-url','text']])assert.equal(policy.studioHostingLocalLinkError({enabled:true,action,kind}),null);
 assert.equal(policy.studioHostingLocalLinkError({enabled:false,action:'editor-url',kind:'office'}),null);
});
const clientSource=readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
function section(start,end){const a=clientSource.indexOf(start),b=clientSource.indexOf(end,a);assert(a>=0&&b>a);return clientSource.slice(a,b);}
test('Office UI refuses before conversion consent, while ordinary conversion is unchanged',async()=>{
 let confirmations=0;const c=vm.createContext({documentHostingEnabled:true,getPreviewLocalLinkKind:()=> 'office',getPreviewOfficeConversionLabel:()=> 'a.docx',requestStudioConfirmation:async()=>{confirmations++;return true;},setStatus(){}});
 vm.runInContext(section('      async function confirmPreviewOfficeConversion(', '      function isLikelyAbsoluteStudioPath('),c);
 await assert.rejects(c.confirmPreviewOfficeConversion('a.docx','here'),/unavailable/);assert.equal(confirmations,0);c.documentHostingEnabled=false;assert.equal(await c.confirmPreviewOfficeConversion('a.docx','here'),true);assert.equal(confirmations,1);
});
test('hosted recovery cannot fork or navigate to an unregistered workspace',()=>{
 const messages=[],c=vm.createContext({documentHostingEnabled:true,setStatus:m=>messages.push(m)});
 const keep=vm.runInContext('({'+section('            keepCurrent:', '            navigate:')+'})',c).keepCurrent;
 const navigate=vm.runInContext('({'+section('            navigate:', '            copy: writeTextToClipboard')+'})',c).navigate;
 assert.equal(keep(null,()=>true).ok,false);navigate({workspaceId:'unregistered'},{});assert.match(messages[0],/unregistered workspace/);
 assert.match(clientSource,/canChange: \(\) => !documentHostingEnabled && recoveryCanChangeWorkspace\(\)/);
});
test('HTTP hosting policy is evaluated before the old URL reader and cannot be skipped by restore flags',()=>{
 const source=readFileSync(new URL('../index.ts',import.meta.url),'utf8'),start=source.indexOf('const hostingPage = resolveStudioHostingPage('),end=source.indexOf('res.writeHead(200',start),route=source.slice(start,end);
 assert(start>0&&end>start);assert(route.indexOf('if (!hostingPage.ok)')<route.indexOf('resolveRequestedStudioDocumentFromUrl('));assert.match(route,/"legacy" in hostingPage && hostingPage\.legacy/);assert.match(route,/const workspaceId = hostedId \|\|/);
});
test('a link damaged in copying (a line break inside one ID) is refused with a plain explanation',()=>{
 const r=page('token=t&studioTabState=tab_abc%0Adef&hostedWorkspace=tab_abcdef');
 assert.equal(r.ok,false);assert.match(r.message,/link looks damaged/);assert.match(r.message,/nothing was changed/);
});
