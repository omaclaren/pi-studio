// Actual classic HTML sink, store/claim guard and disk helper. No service/provider/viewer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createStudioBuffer} from '../shared/studio-buffer-store.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
import {canonicalStudioDocumentPath,studioDocumentPathsReferToSameFile} from '../shared/studio-document-paths.js';
import {saveStudioDiskFileAs,readStudioDiskFileSnapshot} from '../shared/studio-disk-revisions.js';
const source=fs.readFileSync(new URL('../index.ts',import.meta.url),'utf8');
const id=n=>String(n).padStart(48,'0');
function fixture(t){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'studio-classic-html-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function store(dir,extra={}){
 const server=createStudioBufferServerStore({hosting:{requireView:true,canonicalPath:p=>canonicalStudioDocumentPath(p,dir),sameFile:studioDocumentPathsReferToSameFile,...extra}}),workspaceId='classic_guard_source_01';
 const cap=server.issue({workspaceId,mode:'full'}).capability,generation=server.bindHostingView(cap,'full',{}).generation;
 const p=createStudioBuffer({id:'prompt',role:'prompt',text:'Keep prompt'}),d=createStudioBuffer({id:'doc',role:'document',text:'Keep draft',resourceDir:dir});
 assert(server.write(cap,null,{version:2,workspaceId,mode:'full',revision:1,savedAt:1,selectedBufferId:d.id,activePromptId:p.id,order:[p.id,d.id],buffers:[p,d]},generation).ok);
 const proof=()=>({generation,bufferId:'doc',documentEpoch:server.read(cap).documents.doc,expectedRevision:server.read(cap).revision});
 return {server,cap,proof,dir};
}
function writer(){
 const a=source.indexOf('function writeStudioClassicHtmlExportFile('),b=source.indexOf('function writeStudioHostedHtmlDocumentExport(',a);assert(a>=0&&b>a,'classic guarded sink missing');
 const c=vm.createContext({saveStudioDiskFileAs,readStudioDiskFileSnapshot,resolve:path.resolve,dirname:path.dirname,mkdirSync:fs.mkdirSync,Buffer});
 vm.runInContext(ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);return c.writeStudioClassicHtmlExportFile;
}
function register(f,file){
 const r=f.server.hostingLaunch(f.cap,{...f.proof(),operationId:id(1),kind:'file',path:file,sourcePath:'',resourceDir:f.dir},p=>{const s=readStudioDiskFileSnapshot(p);return {ok:true,path:s.path,text:s.buffer.toString('utf8'),diskRevision:s.revision,label:path.basename(p),resourceDir:f.dir};});assert(r.ok);return r;
}
const html=Buffer.from('<h1>Generated λ %20#?</h1>');
test('browser-shared hosting helpers remain free of Node-only imports',()=>{
 const shared=fs.readFileSync(new URL('../shared/studio-document-hosting.js',import.meta.url),'utf8');assert.doesNotMatch(shared,/from\s+["']node:/);
});
test('classic guard blocks registered files and symlink/hard-link aliases without modifying bytes or recovery',t=>{
 const dir=fixture(t),f=store(dir),file=path.join(dir,'owned%20#?.html');fs.writeFileSync(file,'owned baseline');register(f,file);
 const before=f.server.read(f.cap),link=path.join(dir,'alias.html'),hard=path.join(dir,'hard.html');fs.symlinkSync(file,link);fs.linkSync(file,hard);
 for(const p of [file,link,hard]){const r=writer()(p,html,dir,p=>f.server.checkUnownedHostedFile(p));assert.equal(r.filePath,null);assert.match(r.error,/owned|claimed/i);assert.equal(fs.readFileSync(file,'utf8'),'owned baseline');}
 assert.deepEqual(f.server.read(f.cap),before);
});
test('a pending Save As claim blocks classic writes even before backing acknowledgement',t=>{
 const dir=fixture(t),f=store(dir),file=path.join(dir,'claimed.html');
 const saved=f.server.hostingSave(f.cap,{...f.proof(),operationId:id(2),kind:'save-as',path:file,content:'saved claim'},authorizeCommit=>saveStudioDiskFileAs({path:file,content:'saved claim',authorizeCommit}));assert(saved.ok);assert.equal(saved.claimStatus,'pending');
 const r=writer()(file,html,dir,p=>f.server.checkUnownedHostedFile(p));assert.equal(r.filePath,null);assert.match(r.error,/owned|claimed/i);assert.equal(fs.readFileSync(file,'utf8'),'saved claim');
});
test('unowned classic targets retain overwrite capability and literal filename identity',t=>{
 const dir=fixture(t),f=store(dir),file=path.join(dir,'unowned%20#?.html');fs.writeFileSync(file,'old');
 const r=writer()(file,html,dir,p=>f.server.checkUnownedHostedFile(p));assert.equal(r.error,null);assert.equal(r.filePath,file);assert.deepEqual(fs.readFileSync(file),html);
 const fresh=path.join(dir,'fresh.html');assert.equal(writer()(fresh,html,dir,p=>f.server.checkUnownedHostedFile(p)).filePath,fresh);
});
test('missing, asynchronous, malformed and throwing authorization refuses before directory creation or writing',t=>{
 const dir=fixture(t),file=path.join(dir,'missing','new.html');
 for(const check of [undefined,()=>Promise.resolve({ok:true}),()=>({ok:'yes'}),()=>({}),()=>{throw Error('unavailable');}]){const r=writer()(file,html,dir,check,true);assert.equal(r.filePath,null);assert(r.error);assert(!fs.existsSync(path.dirname(file)));}
 const disabled=createStudioBufferServerStore();assert.equal(disabled.checkUnownedHostedFile(path.join(dir,'new.html')).ok,false);
 const invalid=store(dir,{canonicalPath:()=>{throw Error('canonical unavailable');}});assert.equal(invalid.server.checkUnownedHostedFile(file).ok,false);
});
test('final synchronous owner/claim check refuses a race after staging and removes only its own temp file',t=>{
 const dir=fixture(t),f=store(dir),file=path.join(dir,'race.html');fs.writeFileSync(file,'old');let calls=0;
 const r=writer()(file,html,dir,p=>{if(++calls===3)register(f,file);return f.server.checkUnownedHostedFile(p);});assert.equal(r.filePath,null);assert.match(r.error,/owned|claimed/i);assert.equal(fs.readFileSync(file,'utf8'),'old');assert.deepEqual(fs.readdirSync(dir),['race.html']);
});
test('captured owned filename stays protected after an external symlink replacement',t=>{
 const dir=fixture(t),f=store(dir),owned=path.join(dir,'owned.html'),other=path.join(dir,'other.html');fs.writeFileSync(owned,'old');register(f,owned);fs.writeFileSync(other,'other');fs.unlinkSync(owned);fs.symlinkSync(other,owned);
 const r=writer()(owned,html,dir,p=>f.server.checkUnownedHostedFile(p));assert.equal(r.filePath,null);assert.equal(fs.readFileSync(other,'utf8'),'other');
});
test('flags-off command/tool writes retain their original async overwrite and hard-link behavior without consulting hosting',async t=>{
 const dir=fixture(t),file=path.join(dir,'classic.html'),alias=path.join(dir,'classic-link.html');fs.writeFileSync(file,'old');fs.linkSync(file,alias);
 const a=source.indexOf('const writeClassicStudioHtml ='),b=source.indexOf('const hostedConnections',a);assert(a>=0&&b>a);
 const c=vm.createContext({STUDIO_DOCUMENT_HOSTING_ENABLED:false,writeFile:fs.promises.writeFile,studioBufferStateStore:{checkUnownedHostedFile(){throw Error('must not inspect hosting in classic mode');}},writeStudioClassicHtmlExportFile(){throw Error('must not use new writer in classic mode');}});
 vm.runInContext(ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
 await vm.runInContext('writeClassicStudioHtml',c)(file,html,dir);assert.deepEqual(fs.readFileSync(file),html);assert.deepEqual(fs.readFileSync(alias),html);
});
test('browser-only recursive directory support stays explicit and unsafe targets are refused in hosting mode',t=>{
 const dir=fixture(t),f=store(dir),file=path.join(dir,'created','new.html');assert.equal(writer()(file,html,dir,p=>f.server.checkUnownedHostedFile(p),true).filePath,file);
 const nested=path.join(dir,'not-created','new.html');assert.equal(writer()(nested,html,dir,p=>f.server.checkUnownedHostedFile(p)).filePath,null);assert(!fs.existsSync(path.dirname(nested)));
 const hard=path.join(dir,'linked.html');fs.linkSync(file,hard);assert.equal(writer()(hard,Buffer.from('replacement'),dir,p=>f.server.checkUnownedHostedFile(p)).filePath,null);assert.deepEqual(fs.readFileSync(file),html);
});
test('browser HTML and both command paths plus model tool use the guarded sink only when hosting is enabled',()=>{
 assert.match(source,/STUDIO_DOCUMENT_HOSTING_ENABLED\s*\? writeStudioClassicHtmlExportFile\(targetPath, html/);
 assert(source.includes('await writeClassicStudioHtml(source.outputPath, html, ctx.cwd)'));
 assert.equal((source.match(/await writeClassicStudioHtml\(outputPath, html, ctx.cwd\)/g)||[]).length,2);
 const a=source.indexOf('const writeClassicStudioHtml ='),b=source.indexOf('const hostedConnections',a);assert(a>=0&&b>a);
 const body=source.slice(a,b);assert.match(body,/if \(!STUDIO_DOCUMENT_HOSTING_ENABLED\)\s*\{\s*await writeFile\(outputPath, html\);\s*return;/);
 assert.match(body,/checkUnownedHostedFile/);assert.match(body,/studioPersistentStateQueue/);
});
