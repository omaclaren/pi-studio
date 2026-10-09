import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,mkdirSync,writeFileSync,symlinkSync,linkSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalStudioDocumentPath as canonicalPath,studioDocumentPathsReferToSameFile as sameFile} from '../shared/studio-document-paths.js';
import {createStudioDocumentHostingStore,studioDocumentMetadataKey} from '../shared/studio-document-hosting.js';
import {createStudioBuffer} from '../shared/studio-buffer-store.js';
const workspaceId='main_'+'a'.repeat(24);
function fixture(fn){const dir=realpathSync(mkdtempSync(join(tmpdir(),'studio-document-path-')));try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
function workspace(path){const b=createStudioBuffer({id:'doc',role:'document',sourceState:{source:'file',path,label:'file'}});return {version:2,workspaceId,mode:'editor-only',revision:1,savedAt:1,selectedBufferId:b.id,activePromptId:null,order:[b.id],buffers:[b]};}

test('missing files and ancestors preserve a canonical recoverable path',()=>fixture(dir=>{
 mkdirSync(join(dir,'actual'));symlinkSync(join(dir,'actual'),join(dir,'alias'));
 assert.equal(canonicalPath(join(dir,'alias','missing','draft.md')),join(dir,'actual','missing','draft.md'));
}));
test('hard links and filesystem case aliases reuse existing logical owner',()=>fixture(dir=>{
 const path=join(dir,'Note.md'),link=join(dir,'linked.md');writeFileSync(path,'original');linkSync(path,link);
 const host=createStudioDocumentHostingStore({canonicalPath,sameFile,makeId:()=> 'new'});assert(host.checkpoint(workspace(path)).ok);
 assert.equal(host.findFile(link).bufferId,'doc');
 if(existsSync(join(dir,'note.md')))assert.equal(host.findFile(join(dir,'note.md')).bufferId,'doc');
 const second=workspace(link);second.workspaceId='other_'+'b'.repeat(24);second.buffers=[createStudioBuffer({...second.buffers[0],id:'other'})];second.order=['other'];second.selectedBufferId='other';
 assert.equal(host.checkpoint(second).reason,'already-open');
}));
test('retargeted captured path does not become the identity of another file',()=>fixture(dir=>{
 const old=join(dir,'old'),fresh=join(dir,'fresh');mkdirSync(old);mkdirSync(fresh);writeFileSync(join(old,'file'),'old');writeFileSync(join(fresh,'file'),'new');
 const host=createStudioDocumentHostingStore({canonicalPath,sameFile,makeId:()=> 'new'});assert(host.checkpoint(workspace(join(old,'file'))).ok);
 renameSync(old,join(dir,'retired'));symlinkSync(fresh,old);
 assert.equal(host.findFile(join(fresh,'file')),null);assert.equal(host.checkWrite(workspaceId,'doc',join(old,'file')).reason,'source-changed');
}));
test('metadata association ABA rotates authority; initializing the derived key does not',()=>{
 const host=createStudioDocumentHostingStore({canonicalPath:p=>p,makeId:()=> 'new'});let state=workspace('/file.md');assert(host.checkpoint(state).ok);
 const original=host.documentAuthorities(workspaceId).doc;
 const change=key=>{state={...state,revision:state.revision+1,savedAt:state.savedAt+1,buffers:state.buffers.map(b=>createStudioBuffer({...b,metadata:{...b.metadata,reviewNotesKey:key}}))};assert(host.checkpoint(state).ok);};
 change(studioDocumentMetadataKey(state.buffers[0],'reviewNotesKey'));assert.equal(host.documentAuthorities(workspaceId).doc,original);
 change('file:/different.md');change('file:/file.md');assert.equal(host.checkAuthority(workspaceId,'doc',original).reason,'document-stale');
});
