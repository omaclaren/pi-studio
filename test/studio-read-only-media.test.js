import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const media=await import('../shared/studio-read-only-media.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const server=readFileSync(new URL('../index.ts',import.meta.url),'utf8'),client=readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'missing '+start);return source.slice(a,b);}
await import('../client/studio-navigation-helpers.js');
const nav=globalThis.PiStudioNavigationHelpers;
const nonce='a'.repeat(48),svg='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>parent.bad=true</script></svg>').toString('base64');
test('separate media URLs are authenticated canonical resources, never editor/workspace registrations',()=>{
 assert.equal(typeof media.buildStudioReadOnlyMediaUrl,'function');
 for(const kind of ['pdf','image']){const url=new URL(media.buildStudioReadOnlyMediaUrl({token:'owned',kind,path:'/allowed space/a.'+(kind==='pdf'?'pdf':'svg'),resourceDir:'/allowed space',page:3}),'http://local');assert.equal(url.pathname,kind==='pdf'?'/pdf-resource':'/image-viewer');assert.equal(url.searchParams.get('token'),'owned');assert.match(decodeURIComponent(url.searchParams.get('path')),/^\/allowed space\/a\./);assert.equal(url.searchParams.get('resourceDir'),'/allowed space');assert.equal(url.searchParams.has('docId'),false);assert.equal(url.searchParams.has('hostedWorkspace'),false);assert.equal(url.hash,kind==='pdf'?'#page=3':'');}
 for(const kind of ['text','office','html','svg'])assert.throws(()=>media.buildStudioReadOnlyMediaUrl({token:'t',kind,path:'/f'}));
 for(const path of ['', 'relative.png','https://other/image.png','/bad\0.png'])assert.throws(()=>media.buildStudioReadOnlyMediaUrl({token:'t',kind:'image',path}));
});
test('read-only pending targets are a separate strict allowlist; existing root-editor validation stays unchanged',()=>{
 assert.equal(typeof nav.normalizeStudioReadOnlyTarget,'function');const location={href:'http://local/?token=owned'};
 for(const target of ['/image-viewer?token=owned&path=%2Ff.svg','/pdf-resource?token=owned&path=%2Ff.pdf#page=2','/export-pdf?token=owned&id=12345678-1234-4234-9234-123456789abc']){assert.equal(nav.normalizeStudioReadOnlyTarget(target,location,'owned'),target);assert.throws(()=>nav.normalizeStudioRelativeTarget(target,location,'owned'));}
 for(const target of ['/?token=owned','//other/image-viewer?token=owned&path=x','http://local/image-viewer?token=owned&path=x','/export-html?token=owned&id=x','/image-viewer?token=other&path=x','/image-viewer?token=owned&token=owned&path=x','/image-viewer?token=owned&path=x&hostedWorkspace=abc','/image-viewer?token=owned&path=x&path=y','/image-viewer?token=owned&path=x#javascript:bad','/image-viewer/../?token=owned','/image-viewer?token=owned&path=x\n','/export-pdf?token=owned&id=x&resourceDir=%2F'])assert.throws(()=>nav.normalizeStudioReadOnlyTarget(target,location,'owned'),target);
 assert.equal(nav.normalizeStudioRelativeTarget('/?token=owned',location,'owned'),'/?token=owned');
});
function pendingPair(kind='preview'){
 const channels=new Set(),timers=new Map();let serial=0;const replaced=[];
 class Channel{constructor(name){this.name=name;this.listeners=new Set();channels.add(this);}addEventListener(_type,fn){this.listeners.add(fn);}removeEventListener(_type,fn){this.listeners.delete(fn);}postMessage(data){for(const c of [...channels])if(c!==this&&c.name===this.name)for(const fn of [...c.listeners])fn({data});}close(){channels.delete(this);}}
 const w={location:{href:'http://local/studio-open-pending?token=owned',replace:url=>replaced.push(url)},crypto:{randomUUID:()=> '12345678-1234-4234-9234-123456789abc'},BroadcastChannel:Channel,open(){return null;},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener(){}};
 const parent=nav.createPendingStudioLaunch({window:w,token:'owned',kind}),elements={};for(const id of ['pendingTitle','pendingDetail','pendingCloseBtn'])elements[id]={textContent:'',hidden:false,addEventListener(){}};
 const child=nav.startStudioPendingPage(w,{getElementById:id=>elements[id]},{token:'owned',launchId:parent.launchId,kind});
 const flush=()=>{for(const [id,t] of [...timers].sort((a,b)=>a[1].ms-b[1].ms)){if(t.ms<100&&timers.has(id)){timers.delete(id);t.fn();}}};return {parent,child,w,elements,replaced,flush,Channel};
}
test('parent and actual pending receiver deliver a distinct read-only terminal, not an editable navigation; cancellation stays separate',()=>{
 for(const path of ['/image-viewer?token=owned&path=%2Ff.svg','/pdf-resource?token=owned&path=%2Ff.pdf','/export-pdf?token=owned&id=valid']){const p=pendingPair();assert.equal(typeof p.parent.navigateReadOnly,'function');assert.equal(p.parent.navigateReadOnly(path),true);assert.equal(p.parent.getSnapshot().terminalType,'navigate-read-only');p.flush();assert.deepEqual(p.replaced,[path]);}
 const cancelled=pendingPair();cancelled.parent.cancel('Origin changed');cancelled.flush();assert.deepEqual(cancelled.replaced,[]);
 const document=pendingPair('document');assert.throws(()=>document.parent.navigateReadOnly('/image-viewer?token=owned&path=x'));const attacker=new document.Channel(nav.studioLaunchChannelName(document.parent.launchId));attacker.postMessage({protocol:nav.STUDIO_LAUNCH_PROTOCOL_VERSION,type:'navigate-read-only',launchId:document.parent.launchId,target:'/image-viewer?token=owned&path=x'});document.flush();assert.deepEqual(document.replaced,[]);assert.match(document.elements.pendingDetail.textContent,/rejected/);
});
test('image viewer contains an image, not executable SVG markup, and escapes all displayed labels',()=>{
 assert.equal(typeof media.buildStudioReadOnlyImagePage,'function');const html=media.buildStudioReadOnlyImagePage({label:'<script>bad</script>"',dataUrl:svg,nonce});
 assert.match(html,/<img /);assert(!html.includes('<svg'));assert(!html.includes('parent.bad=true'));assert(!html.includes('<script>bad</script>'));assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(html,/Read-only image/);assert(!/textarea|sourceText|Run Prompt|document-hosting|studioTabState/.test(html));
 for(const src of ['javascript:bad','https://other/image.svg','data:text/html;base64,WA==','data:image/svg+xml,<svg/>','data:image/png;base64,WA==" onload="bad'])assert.throws(()=>media.buildStudioReadOnlyImagePage({label:'x',dataUrl:src,nonce}));
 for(const bad of ['', '" bad="x', 'abc'])assert.throws(()=>media.buildStudioReadOnlyImagePage({label:'x',dataUrl:svg,nonce:bad}));
});
test('Fit/Actual toggles are view-only and preserve image identity without additional resource access',()=>{
 const html=media.buildStudioReadOnlyImagePage({label:'x',dataUrl:svg,nonce});assert.match(html,/id="mediaFit"/);assert.match(html,/id="mediaActual"/);assert.match(html,/aria-pressed="true"/);
 const script=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1],buttons={};for(const id of ['mediaFit','mediaActual'])buttons[id]={attrs:{},addEventListener(_t,fn){this.click=fn;},setAttribute(k,v){this.attrs[k]=v;}};
 const document={body:{dataset:{}},getElementById:id=>buttons[id]};vm.runInNewContext(script,{document});assert.equal(document.body.dataset.scale,'fit');buttons.mediaActual.click();assert.equal(document.body.dataset.scale,'actual');assert.equal(buttons.mediaActual.attrs['aria-pressed'],'true');buttons.mediaFit.click();assert.equal(document.body.dataset.scale,'fit');assert(!/fetch\(|localStorage|sessionStorage|innerHTML|window\.opener/.test(script));
});
test('standalone image responder skips bytes on HEAD and supplies nonce CSP/no-referrer/no-store',()=>{
 const source=section(server,'function respondStudioReadOnlyImage(','function formatStudioMarkdownAngleTarget(');
 assert.match(source,/method === "HEAD"/);assert(source.indexOf('method === "HEAD"')<source.indexOf('readFileSync('));assert.match(source,/"Referrer-Policy": "no-referrer"/);assert.match(source,/"Cache-Control": "no-store"/);assert.match(source,/"Content-Security-Policy"/);assert.match(source,/sandbox allow-scripts/);assert.match(source,/img-src data:/);assert.match(source,/frame-ancestors 'none'/);assert.doesNotMatch(source,/storeTransient|grantDocument/);
});
test('actual responder executes HEAD/GET with the declared crypto import and no HEAD file read',()=>{
 assert.match(server,/import \{[^\n]*randomBytes[^\n]*\} from "node:crypto"/);
 const source=section(server,'function respondStudioReadOnlyImage(','function formatStudioMarkdownAngleTarget(').replace(/function respondStudioReadOnlyImage\([^)]*\): void/, 'function respondStudioReadOnlyImage(req,res,filePath,mimeType)');
 let reads=0;const context={randomBytes:()=>Buffer.from('ab'.repeat(24),'hex'),readFileSync:()=>{reads++;return Buffer.from('<svg/>');},basename:()=>'<image>.svg',buildStudioReadOnlyImagePage:media.buildStudioReadOnlyImagePage,respondText(){throw Error('unexpected refusal');}};vm.runInNewContext(source,context);
 const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
 context.respondStudioReadOnlyImage({method:'HEAD'},res,'/image.svg','image/svg+xml');assert.equal(reads,0);assert.equal(res.status,200);assert.equal(res.body,undefined);
 context.respondStudioReadOnlyImage({method:'GET'},res,'/image.svg','image/svg+xml');assert.equal(reads,1);assert.equal(res.status,200);assert.match(res.body,/data:image\/svg\+xml;base64/);assert(!res.body.includes('<svg/>'));assert.equal(res.headers['Referrer-Policy'],'no-referrer');
});
test('image-viewer route reuses the authenticated media resolver and exact grants, not URL editing authority',()=>{
 const route=section(server,'if (requestUrl.pathname === "/image-viewer")','if (requestUrl.pathname !== "/")');assert(route.indexOf('token !== serverState.token')<route.indexOf('resolveStudioHtmlPreviewResourcePath('));assert.match(route,/studioResourceGrantRegistry/);assert.match(route,/!resource\.mimeType\.startsWith\("image\/"\)/);assert.match(route,/respondStudioResourceGrantRequiredJson/);assert.doesNotMatch(route,/grantDocument|grantDirectory|storeTransient|hostingBootstrap|hostingLaunch/);
});
test('viewer-url accepts only PDF/images and creates no transient editor or resource grant',()=>{
 const route=section(server,'if (action === "viewer-url")','if (action === "preview-url")');assert.match(route,/resource\.kind !== "pdf" && resource\.kind !== "image"/);assert.match(route,/buildStudioReadOnlyMediaUrl/);assert.match(route,/readOnly: true/);assert.doesNotMatch(route,/storeTransient|grantDocument|grantDirectory|hostingLaunch/);
});
test('hosted separate opening retains preview-currentness, cancellation and popup guards; classic route unchanged',()=>{
 const action=section(client,'async function openPreviewResourceInNewEditor(','async function copyPreviewLocalLinkPath(');assert.match(action,/documentHostingEnabled \? "viewer-url" : "preview-url"/);assert.match(action,/openPendingStudioTab\("preview"\)/);assert.match(action,/if \(!isCurrent\(\)\)/);assert.match(action,/cancelPendingStudioTab/);assert.match(action,/navigatePendingStudioTab/);assert.match(action,/Requested a separate read-only preview/);
});
test('hosted PDF export returns prepared resident bytes with no editing URL, even if disk writing fails',()=>{
 const block=section(server,'if (openTarget === "studio" && STUDIO_DOCUMENT_HOSTING_ENABLED)','if (openTarget === "studio" && serverState && writeResult.filePath)');assert.match(block,/relativeUrl: .*\/export-pdf/);assert.match(block,/openedStudio: false/);assert.match(block,/readOnly: true/);assert.doesNotMatch(block,/storeTransient|grantDocument|hostingLaunch/);
 const action=section(client,'async function exportRightPanePdf(','async function exportRightPaneHtml(');assert.match(action,/captureStudioPreviewOwner\("response"\)/);assert.match(action,/studioPreviewOwnerIsCurrent/);assert.match(action,/Exported PDF; its originating preview changed/);assert.match(action,/Requested exported PDF in a separate read-only viewer/);
});
test('terminal PDF command is a trusted exact-file grant and no editable bootstrap; watch is not silently discarded',()=>{
 const branch=section(server,'if (STUDIO_DOCUMENT_HOSTING_ENABLED && launchesPdfPreview','const hostingError = studioHostingCommandError(');assert.match(branch,/!launchOpenFlags\.watchPdf/);assert.match(branch,/!options\?\.replaceExistingFull/);assert.match(branch,/studioResourceGrantRegistry\.grantFile/);assert.match(branch,/buildStudioReadOnlyMediaUrl/);assert.doesNotMatch(branch,/grantDocument|grantDirectory|hostingBootstrap|initialStudioDocument =/);
});
test('hosted HTML export requires current owning authority before rendering, not a transient editing URL',()=>{
 const handler=section(server,'const handleExportHtmlRequest = async','const handleHttpRequest =');assert.match(handler,/const hostedDocumentExport = openTarget === "studio" && STUDIO_DOCUMENT_HOSTING_ENABLED/);assert(handler.indexOf('hostingExportAuthority(')<handler.indexOf('renderStudioStandaloneHtmlWithPandoc('));
 const bridge=section(handler,'if (hostedDocumentExport && exportAuthority?.ok','if (STUDIO_DOCUMENT_HOSTING_ENABLED) await studioPersistentStateQueue');assert.match(bridge,/preparedDocument/);assert.match(bridge,/openedStudio: false/);assert.doesNotMatch(bridge,/storeTransient|grantDocument|grantDirectory/);
 const buttons=section(client,'function updateResultActionButtons(','function refreshResponseUi(');assert.match(buttons,/exportPreviewHtmlStudioBtn\.disabled = exportBusy/);
});
