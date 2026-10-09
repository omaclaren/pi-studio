// Bounded actual-helper/VM characterizations of media34 M1/M2. No SDK/browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildStudioReadOnlyMediaUrl} from '../shared/studio-read-only-media.js';
const index=fs.readFileSync(new URL('../index.ts',import.meta.url),'utf8');
const client=fs.readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);}
const grantSource=fs.readFileSync(new URL('../shared/studio-resource-grants.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
const parser=fs.readFileSync(new URL('../shared/studio-local-preview-path.js',import.meta.url),'utf8').replace(/export \{[\s\S]*?\};/g,'');
const decoders=section(index,'function stripStudioHtmlPreviewResourceUrlSuffix(','function getStudioLocalPreviewResourceKind(').replaceAll('(resourcePath: string): string','(resourcePath)');
const pdf=section(index,'function resolveStudioPdfResourcePath(','function stripStudioHtmlPreviewResourceUrlSuffix(').replace(/^function resolveStudioPdfResourcePath\([\s\S]*?\): string \{/, 'function resolveStudioPdfResourcePath(pdfPath,sourcePath,resourceDir,fallbackCwd,resourceGrants) {');
const image=section(index,'function resolveStudioHtmlPreviewResourcePath(','function resolveStudioAuthorizedPreviewRenderContext(').replace(/^function resolveStudioHtmlPreviewResourcePath\([\s\S]*?\): \{ filePath: string; mimeType: string \} \{/, 'function resolveStudioHtmlPreviewResourcePath(resourcePath,sourcePath,resourceDir,fallbackCwd,resourceGrants) {').replace('const kind: StudioLocalPreviewResourceKind','const kind');
function resolverContext(){
 const files=new Set(),aliases=new Map();
 const context={URL,URLSearchParams,fileURLToPath,...path,
 resolveStudioPreviewResourceContext:()=>({baseDir:'/allowed',boundaryDir:'/allowed'}),expandHome:x=>x,recoverLikelyDroppedLeadingSlashPath:x=>x,
 realpathSync:p=>{if(aliases.has(p))return aliases.get(p);if(!files.has(p))throw Error('Absent: '+p);return p;},statSync:()=>({isFile:()=>true,size:100}),
 StudioResourceGrantRequiredError:class extends Error{},STUDIO_HTML_PREVIEW_RESOURCE_MAX_BYTES:25*1024*1024,STUDIO_HTML_PREVIEW_MEDIA_MIME_BY_EXT:new Map([['.svg','image/svg+xml']])};
 vm.createContext(context);vm.runInContext(decoders+pdf+image,context);return {context,files,aliases};
}
for(const kind of ['pdf','image']) test('M1 '+kind+' canonical URI hop preserves reserved filename bytes, exact/directory permissions and independent page fragment',()=>{
 const {context:c,files,aliases}=resolverContext(),ext=kind==='pdf'?'pdf':'svg';
 for(const name of ['plain','with spaces','literal%20space','literal%2520space','percent%','bad%FF','Unicode λ','first.EXT#second','first.EXT?second']){
  const canonical='/allowed/'+name.replace('EXT',ext)+'.'+ext;const mistaken=c.decodeStudioLocalPreviewResourceReference(canonical);files.add(canonical);files.add(mistaken);
  assert.equal(c.decodeStudioLocalPreviewResourceReference(encodeURIComponent(canonical)),canonical,'initial link resolution');
  const target=new URL(buildStudioReadOnlyMediaUrl({token:'owned',kind,path:canonical,resourceDir:'/allowed',page:3}),'http://local');
  const resolve=grant=>kind==='pdf'?c.resolveStudioPdfResourcePath(target.searchParams.get('path'),undefined,target.searchParams.get('resourceDir'),'/allowed',grant):c.resolveStudioHtmlPreviewResourcePath(target.searchParams.get('path'),undefined,target.searchParams.get('resourceDir'),'/allowed',grant).filePath;
  assert.equal(resolve({allows:p=>p.startsWith('/allowed/')}),canonical,'directory grant must not silently select authorized sibling');
  assert.equal(resolve({allows:p=>p===canonical}),canonical,'exact file must succeed for intended target');
  assert.throws(()=>resolve({allows:()=>false}),'transport never grants');
  if(canonical!==mistaken)assert.throws(()=>resolve({allows:p=>p===mistaken}),'alternate file grant is not intended file approval');
  assert.equal(target.hash,kind==='pdf'?'#page=3':'','PDF page is separate from literal filename');
  aliases.set(canonical,'/outside/replaced.'+ext);assert.throws(()=>resolve({allows:p=>p===canonical}),'canonical substitution remains denied');aliases.delete(canonical);
 }
});
test('M1 terminal producer preserves canonical grant.path before resolver and viewer hops, with exact/directory grants',async()=>{
 const command=section(index,'const target = parseStudioPdfLaunchTarget(normalizePathInput(parsedLaunchPath!));','const automatic = shouldAutoOpenStudioBrowser').replace('parsedLaunchPath!','parsedLaunchPath');
 for(const name of ['plain','literal%20space','literal%2520space','percent%','first.pdf#last','first.pdf?last'])for(const directoryGrant of [false,true]){
  const canonical='/allowed/'+name+'.pdf';let alternate;try{alternate=decodeURIComponent(canonical.split('#')[0].split('?')[0]);}catch{alternate=canonical;}
  const files=new Set(['/allowed',canonical,alternate]);const c={URL,URLSearchParams,fileURLToPath,...path,homedir:()=>'/home/fixture',realpathSync:p=>{assert(files.has(p));return p;},statSync:p=>({isFile:()=>p!=='/allowed',isDirectory:()=>p==='/allowed'}),resolveStudioPreviewResourceContext:()=>({baseDir:'/allowed',boundaryDir:'/allowed'}),recoverLikelyDroppedLeadingSlashPath:x=>x,StudioResourceGrantRequiredError:class extends Error{},normalizePathInput:x=>x,ctx:{cwd:'/allowed'},launchOpenFlags:{port:12345,listenAll:false},ensureServer:async()=>({port:12345,token:'owned'}),buildStudioReadOnlyMediaUrl};
  vm.createContext(c);vm.runInContext(grantSource+parser+decoders+pdf+'\nasync function producer(parsedLaunchPath){'+command+'\nreturn {grantPath:grant.path,resolvedPdf:pdf,url};}',c);
  c.studioResourceGrantRegistry=c.createStudioResourceGrantRegistry({cwd:'/allowed'});if(directoryGrant)c.studioResourceGrantRegistry.grantDirectory('/allowed');
  const result=await c.producer(encodeURIComponent(canonical)+'#page=2'),url=new URL(result.url);assert.equal(result.grantPath,canonical);assert.equal(result.resolvedPdf,canonical);assert.equal(url.hash,'#page=2');assert.equal(c.resolveStudioPdfResourcePath(url.searchParams.get('path'),undefined,undefined,'/allowed',c.studioResourceGrantRegistry),canonical);
  if(!directoryGrant&&canonical!==alternate)assert.equal(c.studioResourceGrantRegistry.allows(alternate),false);
 }
});
const owners=section(client,'function captureStudioPreviewOwner(','function getStudioPreviewPaneForElement(');
const refuse=section(client,'function refuseStudioReaderExport(','async function exportRightPanePdf(');
const exportPdf=section(client,'async function exportRightPanePdf(','async function exportRightPaneHtml(');
async function exportCase(departure){
 let release,started;const gate=new Promise(r=>release=r),dispatched=new Promise(r=>started=r),events=[];
 const response={id:'response-A'},resource={sourcePath:'/allowed/source.md',resourceDir:'/allowed'};
 const s={rightView:'preview',editorView:'markdown',documentHostingEnabled:true,bufferRecoveryEnabled:true,bufferPageClosed:false,
 sourcePreviewRenderNonce:1,responsePreviewRenderNonce:10,studioLinkedReaderRenderNonce:0,annotationsEnabled:true,readerActive:false,
 sourceTextEl:{value:'retained editor'},latestResponseMarkdown:'# Response A',editorLanguage:'markdown',sourceState:{path:'/allowed/source.md'},resourceDirInput:{},
 uiBusy:false,previewExportInProgress:false,sideQuestionMarkdownExportRequest:null,PDF_EXPORT_FETCH_TIMEOUT_MS:1000,
 studioLinkedReaderIsActive:()=>s.readerActive,studioLinkedReaderUi:{snapshot:()=>({active:s.readerActive,current:{path:'/allowed/other.md'}})},
 getSelectedHistoryItem:()=>response,getHtmlPreviewResourceContextOptions:()=>({...resource}),previewResourceHelpers:{areStudioPreviewResourceContextsEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
 getToken:()=> 'owned',getRightPaneHtmlArtifactSource:()=>'',getEffectiveSavePath:()=>'/allowed/source.md',getCurrentResourceDirValue:()=>'/allowed',prepareEditorTextForPreview:x=>x,formatStudioExportTimestamp:()=> 'fixture',
 updateResultActionButtons(){},closeExportPreviewMenu(){},setStatus:(message,kind)=>events.push({type:'status',message,kind}),
 openPendingStudioTab:()=>({id:'fixture-pending'}),cancelPendingStudioTab:(_l,message)=>events.push({type:'cancel',message}),failPendingStudioTab:(_l,message)=>events.push({type:'fail',message}),navigatePendingStudioReadOnlyTab:(_l,target)=>events.push({type:'navigate',target}),
 fetchWithTimeout:async(_url,options)=>{events.push({type:'request',body:JSON.parse(options.body)});started();return gate;}};
 vm.createContext(s);vm.runInContext(owners+refuse+exportPdf,s);const owner=s.captureStudioPreviewOwner('response'),work=s.exportRightPanePdf({openTarget:'studio'});await dispatched;
 if(departure==='reader'){s.readerActive=true;s.studioLinkedReaderRenderNonce++;assert.equal(s.studioPreviewOwnerIsCurrent(owner),true,'underlying committed rendering must remain valid below reader');}else if(departure==='files')s.rightView='files';
 const payload={filename:'a.pdf',path:null,writeError:'fixture write refusal',readOnly:true,downloadUrl:'/export-pdf?token=owned&id=fixture',relativeUrl:'/export-pdf?token=owned&id=fixture'};
 release({ok:true,headers:{get:()=> 'application/json'},json:async()=>payload});await work;
 assert(!events.some(e=>e.type==='fail'));assert.equal(s.sourceTextEl.value,'retained editor');assert.equal(s.latestResponseMarkdown,'# Response A');assert.equal(s.previewExportInProgress,false);
 return {events,payload};
}
for(const departure of ['none','reader','files'])test('M2 held successful PDF export '+departure+' uses visible-origin fence and keeps generated output',async()=>{
 const {events,payload}=await exportCase(departure);
 assert.equal(events.some(e=>e.type==='navigate'),departure==='none');assert.equal(events.some(e=>e.type==='cancel'),departure!=='none');
 assert.equal(events.find(e=>e.type==='request').body.markdown,'# Response A','never exports reader content');
 assert.equal(payload.relativeUrl,'/export-pdf?token=owned&id=fixture');
 if(departure!=='none')assert(events.some(e=>e.type==='status'&&e.message.includes('Output was kept')));
});
