import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioBuffer as buffer} from '../shared/studio-buffer-store.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
const workspaceId='transfer_'+'a'.repeat(24),operationId='b'.repeat(48);
const note={id:'note',text:'Keep comment',createdAt:1,updatedAt:2,selectionStart:1,selectionEnd:4,lineStart:1,lineEnd:1,selectedText:'old',anchorKind:'html-element',htmlSelector:'#figure',htmlLabel:'Figure'};
function fixture(){
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true}}),cap=server.issue({workspaceId,mode:'full'}).capability,handle={};
 const lease=server.bindHostingView(cap,'full',handle);
 const doc=buffer({id:'doc',role:'document',text:'saved text',sourceState:{source:'file',path:'/old.md',label:'old'},resourceDir:'/',metadata:{scratchpadKey:'file:/old.md',reviewNotesKey:'file:/old.md'}});
 const state={version:2,workspaceId,mode:'full',revision:1,savedAt:1,selectedBufferId:'doc',activePromptId:'prompt',order:['prompt','doc'],buffers:[buffer({id:'prompt',role:'prompt',text:'Prompt'}),doc]};
 assert(server.write(cap,null,state,lease.generation).ok);
 const proof=()=>({generation:lease.generation,bufferId:'doc',documentEpoch:server.read(cap).documents.doc,expectedRevision:server.read(cap).revision,operationId});
 assert(server.hostingSave(cap,{...proof(),kind:'save-as',path:'/new.md',content:'saved text'},authorize=>{assert(authorize('/new.md').ok);return{ok:true,path:'/new.md'};}).ok);
 let persisted=0,db={scratchpadsByDocument:{'file:/old.md':'Keep scratchpad'},reviewNotesByDocument:{'file:/old.md':[note]},scratchpadMetadataByDocument:{'file:/old.md':{label:'old',updatedAt:5}}};
 const transaction=async resolve=>{const draft=structuredClone(db),step=resolve(draft);if(step.persist){db=draft;persisted++;}step.committed?.();return step.result;};
 const resolve=(fields={},writer=transaction)=>server.hostingSaveMetadata(cap,{...proof(),operation:'save-metadata',...fields},writer);
 return{server,cap,handle,lease,proof,resolve,transaction,db:()=>db,persisted:()=>persisted};
}
function attach(f){const current=f.server.read(f.cap),claim=current.pendingSaves[0],state=structuredClone(current.state);state.revision++;state.savedAt++;const doc=state.buffers.find(b=>b.id==='doc');Object.assign(doc,{sourceState:{source:'file',path:claim.path,label:'new.md',draftId:null},baselineText:claim.savedText,diskRevision:claim.diskRevision,resourceDir:'/'});doc.metadata.scratchpadKey=doc.metadata.reviewNotesKey='file:/new.md';return f.server.write(f.cap,current.revision,state,f.lease.generation,current.documents);}
const gate=()=>{let release;const promise=new Promise(r=>release=r);return{promise,release};};

test('Save As copies scratchpad and anchored comments together without deleting original metadata',async()=>{
 const f=fixture(),original=structuredClone(f.db());const preview=await f.resolve();assert(preview.ok);assert.equal(preview.conflict,false);assert.equal(f.persisted(),0);
 const result=await f.resolve({choice:'carry',metadataRevision:preview.metadataRevision});assert(result.ok);assert.equal(f.persisted(),1);
 assert.equal(f.db().scratchpadsByDocument['file:/new.md'],'Keep scratchpad');assert.deepEqual(f.db().reviewNotesByDocument['file:/new.md'],[note]);
 assert.deepEqual(f.db().reviewNotesByDocument['file:/old.md'],original.reviewNotesByDocument['file:/old.md']);assert.equal(f.db().scratchpadsByDocument['file:/old.md'],'Keep scratchpad');
 const receipt=f.server.read(f.cap).pendingSaves[0].metadataTransfer;assert.equal(receipt.destinationKey,'file:/new.md');assert.equal(receipt.choice,'carry');assert(attach(f).ok);assert.deepEqual(f.server.read(f.cap).pendingSaves,[]);
});
test('destination conflicts require explicit use-destination choice, never overwrite either copy',async()=>{
 const f=fixture();f.db().scratchpadsByDocument['file:/new.md']='Destination notes';const before=structuredClone(f.db());
 const preview=await f.resolve();assert(preview.ok&&preview.conflict);assert.equal((await f.resolve({choice:'carry',metadataRevision:preview.metadataRevision})).reason,'metadata-conflict');assert.deepEqual(f.db(),before);
 assert((await f.resolve({choice:'destination',metadataRevision:preview.metadataRevision})).ok);assert.deepEqual(f.db(),before);assert.equal(f.persisted(),0);
});
test('preview consent is revoked when either metadata copy changes',async()=>{
 for(const key of ['file:/old.md','file:/new.md']){const f=fixture(),preview=await f.resolve();f.db().scratchpadsByDocument[key]='Changed';const before=structuredClone(f.db());
 assert.equal((await f.resolve({choice:'carry',metadataRevision:preview.metadataRevision})).reason,'metadata-changed');assert.deepEqual(f.db(),before);assert.equal(f.persisted(),0);}
});
test('pending save reserves destination metadata and blocks new source writes while Prompt metadata can drain',async()=>{
 const f=fixture();let writes=0;assert(f.server.ownsMetadataKey('scratchpad','file:/new.md'));
 const result=await f.server.hostingMetadata(f.cap,f.proof(),'scratchpad','file:/old.md',async check=>{check();writes++;});assert.equal(result.reason,'save-ack-pending');assert.equal(writes,0);
 const p={...f.proof(),bufferId:'prompt',documentEpoch:f.server.read(f.cap).documents.prompt};assert((await f.server.hostingMetadata(f.cap,p,'scratchpad','draft:prompt',async check=>{check();writes++;})).ok);assert.equal(writes,1);
});
test('pending transfer cannot be discarded or attached before persistence completes',async()=>{
 const f=fixture(),preview=await f.resolve(),g=gate();
 const pending=f.resolve({choice:'carry',metadataRevision:preview.metadataRevision},async resolve=>{await g.promise;return f.transaction(resolve);});
 assert.equal(f.server.discardHostingSave(f.cap,{...f.proof(),confirmed:true}).reason,'metadata-pending');assert.equal(attach(f).ok,false);
 g.release();assert((await pending).ok);
});
test('retired connection is checked inside the persistent mutation, not just before queuing',async()=>{
 const f=fixture(),preview=await f.resolve(),g=gate();const pending=f.resolve({choice:'carry',metadataRevision:preview.metadataRevision},async resolve=>{await g.promise;return f.transaction(resolve);});
 f.server.releaseHostingView(f.cap,f.handle);f.server.bindHostingView(f.cap,'full',{});g.release();assert.equal((await pending).reason,'lease-stale');assert.equal(f.persisted(),0);
});
test('lost transfer acknowledgement reuses immutable receipt on the new owning connection without another write',async()=>{
 const f=fixture(),preview=await f.resolve(),fields={choice:'carry',metadataRevision:preview.metadataRevision};assert((await f.resolve(fields)).ok);
 f.server.releaseHostingView(f.cap,f.handle);f.lease.generation=f.server.bindHostingView(f.cap,'full',{}).generation;
 assert((await f.resolve(fields)).ok);assert((await f.resolve()).prepared);assert.equal(f.persisted(),1);
 assert.equal((await f.resolve({...fields,choice:'destination'})).reason,'invalid-request');
});
test('failed metadata persistence retains claim and originals and can be retried',async()=>{
 const f=fixture(),preview=await f.resolve(),before=structuredClone(f.db()),fields={choice:'carry',metadataRevision:preview.metadataRevision};
 const result=await f.resolve(fields,async resolve=>{resolve(structuredClone(f.db()));throw Error('disk full');});assert.equal(result.ok,false);assert.deepEqual(f.db(),before);assert(!f.server.read(f.cap).pendingSaves[0].metadataTransfer);
 assert((await f.resolve(fields)).ok);assert.equal(f.persisted(),1);
});
