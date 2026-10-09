// Read-only transport/view chrome only. Neither helper grants resources,
// registers a workspace nor attaches a file to an editable buffer.
/** @param {{token: string, kind: string, path: string, resourceDir?: string, page?: number | null}} options */
export function buildStudioReadOnlyMediaUrl({ token, kind, path, resourceDir = "", page = null }) {
 if (!["pdf", "image"].includes(kind) || typeof token !== "string" || !token || token.length > 512
  || typeof path !== "string" || !/^(\/|[a-zA-Z]:[\\/])/.test(path) || path.length > 16384 || path.includes("\0")) throw Error("A resolved local PDF/image and authenticated token are required.");
 // The receiving media resolvers accept a URI reference AFTER query decoding.
 // Preserve this already-resolved literal filename through that second layer:
 // URLSearchParams must not expose literal #/? or percent escapes to its decoder.
 const params = new URLSearchParams({ token, path: encodeURIComponent(path), resourceDir });
 return (kind === "pdf" ? "/pdf-resource?" : "/image-viewer?") + params.toString()
  + (kind === "pdf" && Number.isSafeInteger(page) && page > 0 ? "#page=" + page : "");
}
export function buildStudioReadOnlyImagePage({ label, dataUrl, nonce }) {
 if (typeof nonce !== "string" || !/^[a-f0-9]{32,64}$/.test(nonce)) throw Error("A fresh image-page nonce is required.");
 if (typeof dataUrl !== "string" || !/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]*={0,2}$/.test(dataUrl)) throw Error("Only supported image data may be shown in the image viewer.");
 const escape = value => String(value || "Image").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
 const title = escape(label);
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style nonce="${nonce}">html,body{margin:0;background:#171717;color:#e7e7e7;font:14px system-ui,sans-serif}header{position:sticky;top:0;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px;background:#222;border-bottom:1px solid #444}h1{font-size:14px;font-weight:600;margin:0;overflow-wrap:anywhere}nav{display:flex;gap:6px}button{font:inherit;padding:5px 12px;background:transparent;color:inherit;border:1px solid #777;border-radius:5px;cursor:pointer}button[aria-pressed="true"]{background:#444}button:focus-visible{outline:2px solid #9bd;outline-offset:2px}.hint{color:#aaa;font-size:12px}main{padding:12px;overflow:auto}img{display:block;margin:auto}body[data-scale="fit"] img{max-width:100%;max-height:calc(100vh - 100px);width:auto;height:auto}body[data-scale="actual"] img{max-width:none;max-height:none}</style></head><body data-scale="fit">
<header><h1>${title}</h1><nav aria-label="Image size"><button id="mediaFit" type="button" aria-pressed="true">Fit</button><button id="mediaActual" type="button" aria-pressed="false">Actual size</button></nav><span class="hint">Read-only image</span></header>
<main><img src="${dataUrl}" alt="${title}"></main>
<script nonce="${nonce}">const fit=document.getElementById("mediaFit"),actual=document.getElementById("mediaActual");function scale(value){document.body.dataset.scale=value;fit.setAttribute("aria-pressed",String(value==="fit"));actual.setAttribute("aria-pressed",String(value==="actual"));}fit.addEventListener("click",()=>scale("fit"));actual.addEventListener("click",()=>scale("actual"));scale("fit");</script></body></html>`;
}
