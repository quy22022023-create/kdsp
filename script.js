(() => {
  'use strict';

  const state = {
    files: new Map(), // path -> {bytes, text|null, binary}
    detections: [],
    manualRules: [],
    originalValues: {},
    projectName: 'web-app',
    frozenBuildId: '',
    visualEdits: new Map(), // entryPath + selector -> edit
    visualHistory: [],
    preview: {
      entryPath: '',
      mode: 'run',
      viewport: 'desktop',
      urls: [],
      urlMap: new Map(),
      selected: null,
      lastSelector: '',
      opened: false,
    },
  };

  const TEXT_EXT = /\.(html?|css|js|mjs|cjs|json|txt|md|xml|svg|webmanifest|env|yml|yaml|toml|ini)$/i;
  const RUNTIME_TEXT_EXT = /\.(html?|js|mjs|cjs|json|webmanifest)$/i;
  const VISUAL_STYLE_START = '<!-- WAB VISUAL STYLES START -->';
  const VISUAL_STYLE_END = '<!-- WAB VISUAL STYLES END -->';
  const VISUAL_TEXT_START = '<!-- WAB VISUAL TEXT START -->';
  const VISUAL_TEXT_END = '<!-- WAB VISUAL TEXT END -->';
  const $ = (id) => document.getElementById(id);
  const fields = ['appName','shortName','version','buildId','supabaseUrl','supabaseKey'];

  const els = Object.fromEntries(fields.map(k => [k, $(k)]));
  const fileInput = $('fileInput'), folderInput = $('folderInput'), dropZone = $('dropZone');
  const detectionsEl = $('detections'), fileListEl = $('fileList'), summaryEl = $('projectSummary');
  const manualRulesEl = $('manualRules'), ruleTemplate = $('ruleTemplate');
  const previewFrame = $('previewFrame'), previewEntry = $('previewEntry'), previewStatus = $('previewStatus');
  const previewViewport = $('previewViewport'), inspectorEmpty = $('inspectorEmpty'), inspectorPanel = $('inspectorPanel');

  function isTextPath(path){ return TEXT_EXT.test(path) || !/\.[a-z0-9]{1,8}$/i.test(path); }
  function decode(bytes){ try{return new TextDecoder('utf-8',{fatal:false}).decode(bytes);}catch{return null;} }
  function encode(text){ return new TextEncoder().encode(text); }
  function basename(path){ return path.split('/').filter(Boolean).pop() || path; }
  function dirname(path){ const a=path.split('/');a.pop();return a.length?a.join('/')+'/':''; }
  function normalizePath(path){
    const out=[];
    String(path||'').replace(/\\/g,'/').split('/').forEach(part=>{
      if(!part||part==='.') return;
      if(part==='..') out.pop(); else out.push(part);
    });
    return out.join('/');
  }
  function safeName(s){ return (s || 'web-app').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') || 'web-app'; }
  function nowBuild(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }
  function cloneJson(v){ return v==null?v:JSON.parse(JSON.stringify(v)); }
  function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function countOccurrences(text,needle){ if(!needle) return 0; return text.split(needle).length-1; }
  function escapeHtmlText(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function looksBinary(bytes){
    const sample=bytes.slice(0,Math.min(bytes.length,4096));
    if(!sample.length) return false;
    let control=0;
    for(const b of sample){ if(b===0)return true; if((b<9)||(b>13&&b<32))control++; }
    if(control/sample.length>0.08) return true;
    try{ new TextDecoder('utf-8',{fatal:true}).decode(sample); return false; }catch{return true;}
  }
  function classifyBinary(path,bytes){
    if(TEXT_EXT.test(path)) return false;
    if(/\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|pdf|zip|gz|mp3|wav|ogg|mp4|webm|mov|wasm|bin|exe|dll)$/i.test(path)) return true;
    if(!isTextPath(path)) return true;
    return looksBinary(bytes);
  }

  async function sha256(text){
    if(!crypto?.subtle) return '';
    const data = encode(text);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return [...hash].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function markBuildDirty(){ state.frozenBuildId=''; }

  async function loadFiles(fileList){
    const files = Array.from(fileList || []);
    if(!files.length) return;
    closePreview();
    state.visualEdits.clear(); state.visualHistory=[]; state.preview.selected=null; state.preview.lastSelector=''; markBuildDirty();
    if(files.length===1 && /\.zip$/i.test(files[0].name)){
      try{
        const arr = new Uint8Array(await files[0].arrayBuffer());
        const entries = await readZip(arr);
        state.files.clear();
        for(const e of entries){ addVirtualFile(e.name, e.bytes); }
        state.projectName = files[0].name.replace(/\.zip$/i,'');
      }catch(err){
        alert('Không đọc được ZIP này. Hãy thử chọn các file/thư mục trực tiếp.\n\n' + err.message);
        return;
      }
    }else{
      state.files.clear();
      for(const f of files){
        const path = f.webkitRelativePath || f.name;
        addVirtualFile(path, new Uint8Array(await f.arrayBuffer()));
      }
      state.projectName = inferProjectName();
    }
    refreshProject();
  }

  function addVirtualFile(path, bytes){
    if(!path || path.endsWith('/')) return;
    path=normalizePath(path);
    const binary = classifyBinary(path,bytes);
    state.files.set(path, {bytes, binary, text: binary ? null : decode(bytes)});
  }

  function inferProjectName(){
    const titlePath=[...state.files.keys()].find(p=>/(^|\/)index\.html?$/i.test(p));
    return titlePath ? basename(dirname(titlePath).replace(/\/$/,'')) || 'web-app' : 'web-app';
  }

  function refreshProject(){
    renderFiles();
    scan();
    populateRuleFileOptions();
    refreshPreviewEntries();
    updateVisualButtons();
  }

  function renderFiles(){
    const paths=[...state.files.keys()];
    const textCount=[...state.files.values()].filter(f=>!f.binary).length;
    summaryEl.textContent = `${paths.length} file • ${textCount} file text có thể phân tích • ${paths.length-textCount} file nhị phân được giữ nguyên byte`;
    fileListEl.innerHTML='';
    paths.slice(0,30).forEach(p=>{const d=document.createElement('span');d.className='file-chip';d.title=p;d.textContent=p;fileListEl.appendChild(d);});
    if(paths.length>30){const d=document.createElement('span');d.className='file-chip';d.textContent=`+${paths.length-30} file`;fileListEl.appendChild(d);}
  }

  function addDetection(field, path, current, before='', after='', label='', confidence='high'){
    current = String(current ?? '');
    if(!current) return;
    const key=[field,path,before,current,after].join('\u0001');
    if(state.detections.some(d=>d.key===key)) return;
    state.detections.push({key,field,path,current,before,after,label,confidence,enabled:true});
  }

  function scan(){
    state.detections=[];
    state.originalValues={};
    for(const [path,file] of state.files){
      if(file.binary || file.text==null) continue;
      const t=file.text;
      let m;
      const htmlTitle=/<title([^>]*)>\s*([^<]+?)\s*<\/title>/ig;
      while((m=htmlTitle.exec(t))) addDetection('appName',path,m[2],`<title${m[1]}>`,'</title>','HTML title');
      const appMeta=/<meta\s+[^>]*name=["']application-name["'][^>]*content=["']([^"']+)["'][^>]*>/ig;
      while((m=appMeta.exec(t))) addDetection('appName',path,m[1],m[0].slice(0,m[0].indexOf(m[1])),m[0].slice(m[0].indexOf(m[1])+m[1].length),'application-name');
      const constRules=[
        ['appName',/(?:const|let|var)\s+(?:APP_NAME|APP_TITLE)\s*=\s*(["'])(.*?)\1/g],
        ['shortName',/(?:const|let|var)\s+(?:SHORT_NAME|APP_SHORT_NAME)\s*=\s*(["'])(.*?)\1/g],
        ['version',/(?:const|let|var)\s+(?:APP_VERSION|VERSION)\s*=\s*(["'])(.*?)\1/g],
        ['buildId',/(?:const|let|var)\s+(?:APP_BUILD|BUILD_ID|BUILD)\s*=\s*(["'])(.*?)\1/g],
      ];
      for(const [field,re] of constRules){
        re.lastIndex=0;
        while((m=re.exec(t))){
          const full=m[0], val=m[2], idx=full.indexOf(val);
          addDetection(field,path,val,full.slice(0,idx),full.slice(idx+val.length),`JS ${field}`);
        }
      }
      const urlRe=/https:\/\/[a-z0-9-]+\.supabase\.co\b/ig;
      while((m=urlRe.exec(t))) addDetection('supabaseUrl',path,m[0],'','','Supabase URL');
      const keyRe=/\bsb_publishable_[A-Za-z0-9._-]+\b/g;
      while((m=keyRe.exec(t))) addDetection('supabaseKey',path,m[0],'','','Publishable key');
      const anonAssign=/(?:SUPABASE_KEY|SB_KEY|ANON_KEY|SUPABASE_ANON_KEY)\s*=\s*(["'])(eyJ[A-Za-z0-9._-]{40,})\1/g;
      while((m=anonAssign.exec(t))){ const full=m[0],val=m[2],idx=full.indexOf(val); addDetection('supabaseKey',path,val,full.slice(0,idx),full.slice(idx+val.length),'Legacy anon key'); }
      if(/\.(json|webmanifest)$/i.test(path)){
        try{
          const obj=JSON.parse(t);
          if(typeof obj.name==='string') addJsonLiteralDetection('appName',path,t,'name',obj.name);
          if(typeof obj.short_name==='string') addJsonLiteralDetection('shortName',path,t,'short_name',obj.short_name);
          if(typeof obj.version==='string') addJsonLiteralDetection('version',path,t,'version',obj.version);
        }catch{}
      }
    }
    inferDefaults();
    renderDetections();
  }

  function addJsonLiteralDetection(field,path,text,key,value){
    const re=new RegExp(`(["']${escapeRegExp(key)}["']\\s*:\\s*["'])(${escapeRegExp(value)})(["'])`,'g');
    let m; while((m=re.exec(text))) addDetection(field,path,m[2],m[1],m[3],`JSON ${key}`);
  }

  function inferDefaults(){
    const priority=['appName','shortName','version','buildId','supabaseUrl','supabaseKey'];
    priority.forEach(field=>{
      const d=state.detections.find(x=>x.field===field);
      if(d){
        state.originalValues[field]=d.current;
        if(!els[field].value) els[field].value=d.current;
      }
    });
    if(!els.shortName.value && els.appName.value) els.shortName.value=els.appName.value.slice(0,12);
    state.projectName=safeName(els.appName.value || state.projectName);
  }

  function renderDetections(){
    if(!state.detections.length){detectionsEl.className='detections muted';detectionsEl.textContent='Không phát hiện tự động. Có thể thêm quy tắc thủ công.';return;}
    detectionsEl.className='detections';detectionsEl.innerHTML='';
    state.detections.forEach((d)=>{
      const row=document.createElement('div');row.className='detect-row';
      const cb=document.createElement('input');cb.type='checkbox';cb.checked=d.enabled;cb.addEventListener('change',()=>{d.enabled=cb.checked;markBuildDirty();});
      const f=document.createElement('div');f.className='detect-field';f.textContent=fieldLabel(d.field);f.title=d.label || d.field;
      const v=document.createElement('div');v.className='detect-value';v.title=d.current;v.textContent=d.current;
      const p=document.createElement('div');p.className='detect-file';p.title=d.path;p.textContent=d.path;
      row.append(cb,f,v,p);detectionsEl.appendChild(row);
    });
  }

  function fieldLabel(f){return ({appName:'Tên app',shortName:'Tên ngắn',version:'Phiên bản',buildId:'Build ID',supabaseUrl:'DB URL',supabaseKey:'Public key','appName-global':'Tên app (Legacy)','visual-style':'Visual CSS','visual-text':'Visual text','visual-runtime-text':'Runtime text'})[f]||f;}

  function currentConfig(prepareBuild=false){
    if($('autoBuild').checked && prepareBuild){
      if(!state.frozenBuildId) state.frozenBuildId=nowBuild();
      els.buildId.value=state.frozenBuildId;
    }
    const cfg={};fields.forEach(k=>cfg[k]=els[k].value.trim());
    if($('autoBuild').checked && state.frozenBuildId) cfg.buildId=state.frozenBuildId;
    return cfg;
  }

  function replaceExactAll(file,oldText,newText){
    const count=countOccurrences(file.text,oldText);
    if(count){file.text=file.text.split(oldText).join(newText);file.dirty=true;}
    return count;
  }

  function replaceExactOnce(file,oldText,newText){
    const idx=file.text.indexOf(oldText); if(idx<0)return 0;
    file.text=file.text.slice(0,idx)+newText+file.text.slice(idx+oldText.length);file.dirty=true;return 1;
  }

  function applyChanges(options={}){
    const cfg=currentConfig(Boolean(options.prepareBuild));
    const output=new Map();
    for(const [path,f] of state.files) output.set(path,{...f,bytes:new Uint8Array(f.bytes),text:f.text,dirty:false});
    const changes=[];

    for(const d of state.detections){
      if(!d.enabled) continue;
      const next=cfg[d.field]; if(next==null || next==='') continue;
      const f=output.get(d.path); if(!f || f.binary || f.text==null) continue;
      const oldFull=d.before+d.current+d.after, newFull=d.before+next+d.after;
      if(oldFull===newFull) continue;
      const count=replaceExactAll(f,oldFull,newFull);
      if(count) changes.push({path:d.path,field:d.field,old:d.current,new:next,count});
    }

    if($('globalNameSync').checked && state.originalValues.appName && cfg.appName && cfg.appName!==state.originalValues.appName){
      const oldName=state.originalValues.appName;
      for(const [path,f] of output){
        if(f.binary || f.text==null) continue;
        const count=replaceExactAll(f,oldName,cfg.appName);
        if(count) changes.push({path,field:'appName-global',old:oldName,new:cfg.appName,count});
      }
    }

    for(const r of state.manualRules){
      if(!r.file || !r.search) continue;
      const f=output.get(r.file); if(!f || f.binary || f.text==null) continue;
      const replacement=r.field==='custom'?r.custom:(cfg[r.field]||'');
      if(replacement==='') continue;
      const count=replaceExactAll(f,r.search,replacement);
      if(count) changes.push({path:r.file,field:'manual',old:r.search,new:replacement,count});
    }

    applyVisualEditsToOutput(output,changes);

    for(const [,f] of output){ if(f.dirty && !f.binary && f.text!=null) f.bytes=encode(f.text); }
    return {output,changes,cfg};
  }

  function addManualRule(data={}){
    const frag=ruleTemplate.content.cloneNode(true); const row=frag.querySelector('.rule-row');
    const fileSel=row.querySelector('.rule-file'), search=row.querySelector('.rule-search'), fieldSel=row.querySelector('.rule-field'), custom=row.querySelector('.rule-custom');
    fillFileSelect(fileSel,data.file);
    search.value=data.search||'';fieldSel.value=data.field||'appName';custom.value=data.custom||'';custom.hidden=fieldSel.value!=='custom';
    const obj={file:fileSel.value,search:search.value,field:fieldSel.value,custom:custom.value};
    state.manualRules.push(obj);
    fileSel.onchange=()=>{obj.file=fileSel.value;markBuildDirty();};
    search.oninput=()=>{obj.search=search.value;markBuildDirty();};
    fieldSel.onchange=()=>{obj.field=fieldSel.value;custom.hidden=fieldSel.value!=='custom';markBuildDirty();};
    custom.oninput=()=>{obj.custom=custom.value;markBuildDirty();};
    row.querySelector('.rule-remove').onclick=()=>{ const idx=state.manualRules.indexOf(obj);if(idx>=0)state.manualRules.splice(idx,1);row.remove();markBuildDirty(); };
    manualRulesEl.appendChild(frag);
  }

  function fillFileSelect(sel,chosen=''){
    sel.innerHTML=''; [...state.files.entries()].filter(([,f])=>!f.binary).forEach(([path])=>{const o=document.createElement('option');o.value=path;o.textContent=path;o.selected=path===chosen;sel.appendChild(o);});
  }
  function populateRuleFileOptions(){ manualRulesEl.querySelectorAll('.rule-file').forEach(sel=>{const v=sel.value;fillFileSelect(sel,v);}); }

  /* =========================
     Visual Editor data model
     ========================= */

  function visualKey(entryPath,selector){ return `${entryPath}\u0001${selector}`; }
  function getVisualEdits(entryPath){ return [...state.visualEdits.values()].filter(e=>e.entryPath===entryPath); }
  function visualChangeCount(){ return [...state.visualEdits.values()].filter(e=>Object.keys(e.styles||{}).length || (e.textNew!=null && e.textNew!==e.textOriginal)).length; }

  function resolveTextSource(text,entryPath,selection={}){
    const value=String(text||'');
    if(!value.trim()) return {safe:false,count:0,candidates:[],reason:'Thành phần không có text trực tiếp.'};

    // Ưu tiên locator theo id của element đang được chọn. Điều này cho phép sửa đúng
    // một nhãn HTML ngay cả khi cùng câu chữ xuất hiện ở title/nút khác.
    const entry=state.files.get(entryPath);
    if(selection.id && entry && !entry.binary && entry.text!=null && /\.html?$/i.test(entryPath)){
      const idRe=escapeRegExp(selection.id);
      const openRe=new RegExp(`<([a-z][a-z0-9:-]*)\\b[^>]*\\bid=["']${idRe}["'][^>]*>`,'ig');
      const opens=[...entry.text.matchAll(openRe)];
      if(opens.length===1){
        const om=opens[0],tag=om[1],contentStart=om.index+om[0].length,closeRe=new RegExp(`</${escapeRegExp(tag)}\\s*>`,'ig');
        closeRe.lastIndex=contentStart;const cm=closeRe.exec(entry.text);
        if(cm){
          const segment=entry.text.slice(contentStart,cm.index),rel=segment.indexOf(value);
          if(rel>=0 && segment.indexOf(value,rel+value.length)<0){
            const abs=contentStart+rel;
            if(isHtmlTextOccurrence(entry.text,abs,value.length)){
              const before=entry.text.slice(Math.max(0,abs-48),abs),after=entry.text.slice(abs+value.length,Math.min(entry.text.length,abs+value.length+48));
              const full=before+value+after;
              if(countOccurrences(entry.text,full)===1)return {safe:true,count:1,candidates:[{path:entryPath,count:1}],path:entryPath,old:value,before,after,kind:'html-text-context',via:'element-id'};
            }
          }
        }
      }
    }

    const candidates=[];
    let total=0;
    for(const [path,f] of state.files){
      if(f.binary||f.text==null||!RUNTIME_TEXT_EXT.test(path)) continue;
      const count=countOccurrences(f.text,value);
      if(count){candidates.push({path,count});total+=count;}
    }
    if(total===1){
      const c=candidates[0],f=state.files.get(c.path),idx=f.text.indexOf(value);
      const htmlText=/\.html?$/i.test(c.path) && isHtmlTextOccurrence(f.text,idx,value.length);
      if(htmlText){
        const before=f.text.slice(Math.max(0,idx-48),idx),after=f.text.slice(idx+value.length,Math.min(f.text.length,idx+value.length+48));
        return {safe:true,count:1,candidates,path:c.path,old:value,before,after,kind:'html-text-context',via:'unique-text'};
      }
      return {safe:false,count:1,candidates,reason:'Tìm thấy duy nhất nhưng không phải text node HTML an toàn; không replace mù trong JS/JSON.'};
    }
    if(total>1) return {safe:false,count:total,candidates,reason:`Giá trị xuất hiện ${total} vị trí trong source và element không có locator HTML đủ chắc chắn.`};
    return {safe:false,count:0,candidates,reason:'Không tìm thấy text này trong source; có thể được tạo động từ JavaScript/API/database.'};
  }

  function isHtmlTextOccurrence(text,idx,len){
    if(idx<0) return false;
    const before=text.slice(0,idx), after=text.slice(idx+len);
    const lastLt=before.lastIndexOf('<'), lastGt=before.lastIndexOf('>');
    const nextLt=after.indexOf('<');
    return lastGt>lastLt && nextLt>=0;
  }

  function ensureVisualEdit(selection=state.preview.selected){
    if(!selection || !state.preview.entryPath) return null;
    const key=visualKey(state.preview.entryPath,selection.selector);
    let edit=state.visualEdits.get(key);
    if(!edit){
      edit={
        key,entryPath:state.preview.entryPath,selector:selection.selector,label:selection.label,
        tag:selection.tag,textOriginal:selection.directText||'',textNew:null,textSource:resolveTextSource(selection.directText||'',state.preview.entryPath,selection),
        styles:{},originalStyles:cloneJson(selection.styles||{}),blockAlign:'',nudge:{x:0,y:0}
      };
      state.visualEdits.set(key,edit);
    }
    return edit;
  }

  function commitVisualEdit(edit,before){
    const after=cloneJson(edit);
    if(JSON.stringify(before)===JSON.stringify(after)) return;
    state.visualHistory.push({key:edit.key,before,after});
    state.visualEdits.set(edit.key,edit);
    markBuildDirty();
    updateVisualButtons();
    updateVisualStatus();
  }

  function applyStylePatch(patch,metaPatch={}){
    const edit=ensureVisualEdit(); if(!edit)return;
    const before=cloneJson(edit);
    for(const [prop,val] of Object.entries(patch)){
      if(val==null || val==='') delete edit.styles[prop]; else edit.styles[prop]=String(val);
    }
    Object.assign(edit,metaPatch);
    commitVisualEdit(edit,before);
    for(const [prop,val] of Object.entries(patch)) sendToPreview({type:'wab:apply-style',selector:edit.selector,prop,value:val==null?'':String(val)});
    populateInspector(state.preview.selected);
  }

  function applyVisualText(){
    const sel=state.preview.selected;if(!sel)return;
    const edit=ensureVisualEdit(sel);if(!edit)return;
    const next=$('visualText').value;
    const before=cloneJson(edit);
    edit.textNew=next;
    commitVisualEdit(edit,before);
    sendToPreview({type:'wab:apply-text',selector:edit.selector,text:next});
    populateInspector(sel);
  }

  function setNudge(dx,dy,reset=false){
    const sel=state.preview.selected;if(!sel)return;
    const pos=(sel.styles?.position||'static').toLowerCase();
    if(!['static','relative'].includes(pos)){
      previewStatus.textContent=`Không dịch chuyển tự động: phần tử đang dùng position:${pos}. Có thể chỉnh source/Manual Mapping nếu cần.`;
      previewStatus.classList.add('visual-dirty');
      return;
    }
    const edit=ensureVisualEdit(sel);if(!edit)return;
    const before=cloneJson(edit);
    if(reset){edit.nudge={x:0,y:0};delete edit.styles.left;delete edit.styles.top;if((edit.originalStyles?.position||'static')==='static')delete edit.styles.position;}
    else{
      edit.nudge={x:(edit.nudge?.x||0)+dx,y:(edit.nudge?.y||0)+dy};
      if((edit.originalStyles?.position||'static')==='static')edit.styles.position='relative';
      edit.styles.left=`${edit.nudge.x}px`;edit.styles.top=`${edit.nudge.y}px`;
    }
    commitVisualEdit(edit,before);
    const patch={left:edit.styles.left||'',top:edit.styles.top||'',position:edit.styles.position||''};
    for(const [prop,value] of Object.entries(patch)) sendToPreview({type:'wab:apply-style',selector:edit.selector,prop,value});
    populateInspector(sel);
  }

  function resetSelectedVisual(){
    const sel=state.preview.selected;if(!sel)return;
    const key=visualKey(state.preview.entryPath,sel.selector), old=state.visualEdits.get(key);
    if(!old)return;
    state.visualHistory.push({key,before:cloneJson(old),after:null});
    state.visualEdits.delete(key);markBuildDirty();updateVisualButtons();
    openPreview(sel.selector);
  }

  function undoVisual(){
    const h=state.visualHistory.pop();if(!h)return;
    if(h.before==null)state.visualEdits.delete(h.key);else state.visualEdits.set(h.key,cloneJson(h.before));
    markBuildDirty();updateVisualButtons();
    const selector=state.preview.selected?.selector||state.preview.lastSelector||'';
    openPreview(selector);
  }

  function clearVisual(){
    if(!state.visualEdits.size)return;
    if(!confirm('Xóa toàn bộ chỉnh sửa giao diện của project hiện tại?'))return;
    state.visualEdits.clear();state.visualHistory=[];state.preview.selected=null;state.preview.lastSelector='';markBuildDirty();
    updateVisualButtons();openPreview();
  }

  function updateVisualButtons(){
    $('undoVisualBtn').disabled=!state.visualHistory.length;
    $('clearVisualBtn').disabled=!state.visualEdits.size;
  }

  function updateVisualStatus(){
    if(!state.preview.opened){previewStatus.textContent='Nạp source rồi bấm “Mở app”.';previewStatus.classList.remove('visual-dirty');return;}
    const n=visualChangeCount();
    previewStatus.textContent=`${state.preview.mode==='edit'?'Chế độ chỉnh sửa':'App đang chạy'} • ${state.preview.entryPath}${n?` • ${n} thành phần đã chỉnh`:''}`;
    previewStatus.classList.toggle('visual-dirty',Boolean(n));
  }

  function buildVisualCss(entryPath){
    const edits=getVisualEdits(entryPath).filter(e=>Object.keys(e.styles||{}).length);
    if(!edits.length)return '';
    const lines=['/* Web App Builder Generic v1.1 - visual overrides */'];
    for(const e of edits){
      lines.push(`${e.selector} {`);
      for(const [prop,val] of Object.entries(e.styles)) lines.push(`  ${prop}: ${val} !important;`);
      lines.push('}');
    }
    return lines.join('\n');
  }

  function buildRuntimeTextJs(entryPath){
    if(!$('allowRuntimeText').checked)return '';
    const edits=getVisualEdits(entryPath).filter(e=>e.textNew!=null&&e.textNew!==e.textOriginal&&!e.textSource?.safe);
    if(!edits.length)return '';
    const data=edits.map(e=>({selector:e.selector,text:e.textNew}));
    return `(function(){const edits=${JSON.stringify(data)};function setDirect(el,text){if(!el)return;const nodes=[...el.childNodes].filter(n=>n.nodeType===3);const n=nodes.find(n=>n.nodeValue.trim())||nodes[0];if(n)n.nodeValue=text;else if(!el.children.length)el.textContent=text;else el.insertBefore(document.createTextNode(text),el.firstChild);}function apply(){for(const e of edits){try{setDirect(document.querySelector(e.selector),e.text);}catch{}}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();})();`;
  }

  function appendMarkerBlock(html,start,end,inner,placement){
    if(!inner)return html;
    const session=`\n/* WAB v1.1 session */\n${inner}\n`;
    const s=html.indexOf(start), e=html.indexOf(end);
    if(s>=0&&e>s){
      const segment=html.slice(s,e), closeTag=placement==='head'?'</style>':'</script>';
      const closeRel=segment.toLowerCase().lastIndexOf(closeTag);
      if(closeRel>=0){const insertAt=s+closeRel;return html.slice(0,insertAt)+session+html.slice(insertAt);}
      return html.slice(0,e)+session+html.slice(e);
    }
    const block=placement==='head'
      ? `${start}\n<style id="wab-visual-overrides">\n${inner}\n</style>\n${end}`
      : `${start}\n<script id="wab-visual-text-overrides">\n${inner.replace(/<\/script/gi,'<\\/script')}\n</script>\n${end}`;
    const needle=placement==='head'?'</head>':'</body>';
    const idx=html.toLowerCase().lastIndexOf(needle);
    if(idx>=0)return html.slice(0,idx)+block+'\n'+html.slice(idx);
    return (placement==='head'?block+'\n'+html:html+'\n'+block);
  }

  function applyVisualEditsToOutput(output,changes){
    const entries=[...new Set([...state.visualEdits.values()].map(e=>e.entryPath))];
    for(const edit of state.visualEdits.values()){
      if(edit.textNew==null||edit.textNew===edit.textOriginal)continue;
      if(edit.textSource?.safe){
        const f=output.get(edit.textSource.path);
        if(f&&!f.binary&&f.text!=null){
          const oldFull=(edit.textSource.before||'')+edit.textSource.old+(edit.textSource.after||'');
          const newFull=(edit.textSource.before||'')+escapeHtmlText(edit.textNew)+(edit.textSource.after||'');
          if(countOccurrences(f.text,oldFull)===1){
            replaceExactOnce(f,oldFull,newFull);
            changes.push({path:edit.textSource.path,field:'visual-text',old:edit.textOriginal,new:edit.textNew,count:1,selector:edit.selector});
          }
        }
      }
    }
    for(const entryPath of entries){
      const f=output.get(entryPath);if(!f||f.binary||f.text==null)continue;
      const css=buildVisualCss(entryPath);
      if(css){f.text=appendMarkerBlock(f.text,VISUAL_STYLE_START,VISUAL_STYLE_END,css,'head');f.dirty=true;changes.push({path:entryPath,field:'visual-style',old:'Không có override của phiên chỉnh sửa này',new:`${getVisualEdits(entryPath).filter(e=>Object.keys(e.styles||{}).length).length} thành phần có CSS override`,count:1});}
      const js=buildRuntimeTextJs(entryPath);
      if(js){f.text=appendMarkerBlock(f.text,VISUAL_TEXT_START,VISUAL_TEXT_END,js,'body');f.dirty=true;changes.push({path:entryPath,field:'visual-runtime-text',old:'Không có runtime text override của phiên chỉnh sửa này',new:`${getVisualEdits(entryPath).filter(e=>e.textNew!=null&&e.textNew!==e.textOriginal&&!e.textSource?.safe).length} text runtime`,count:1});}
    }
  }

  /* =========================
     Live Preview Runtime
     ========================= */

  function refreshPreviewEntries(){
    const htmlPaths=[...state.files.keys()].filter(p=>/\.html?$/i.test(p));
    htmlPaths.sort((a,b)=>{const ai=/(^|\/)index\.html?$/i.test(a)?-1:0,bi=/(^|\/)index\.html?$/i.test(b)?-1:0;return ai-bi||a.localeCompare(b);});
    const previous=previewEntry.value||state.preview.entryPath;
    previewEntry.innerHTML='';
    for(const p of htmlPaths){const o=document.createElement('option');o.value=p;o.textContent=p;previewEntry.appendChild(o);}
    if(htmlPaths.includes(previous))previewEntry.value=previous;
    state.preview.entryPath=previewEntry.value||htmlPaths[0]||'';
    $('openPreviewBtn').disabled=!htmlPaths.length;
    $('reloadPreviewBtn').disabled=!htmlPaths.length;
    if(!htmlPaths.length)previewStatus.textContent='Không tìm thấy file HTML để mở.';
  }

  function mimeForPath(path){
    const ext=(path.split('.').pop()||'').toLowerCase();
    return ({html:'text/html;charset=utf-8',htm:'text/html;charset=utf-8',css:'text/css;charset=utf-8',js:'text/javascript;charset=utf-8',mjs:'text/javascript;charset=utf-8',cjs:'text/javascript;charset=utf-8',json:'application/json;charset=utf-8',webmanifest:'application/manifest+json;charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',ico:'image/x-icon',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',wasm:'application/wasm',pdf:'application/pdf'})[ext]||'application/octet-stream';
  }

  function disposePreviewUrls(){ for(const u of state.preview.urls){try{URL.revokeObjectURL(u);}catch{}} state.preview.urls=[];state.preview.urlMap=new Map(); }

  function makeObjectUrl(bytes,type){const u=URL.createObjectURL(new Blob([bytes],{type}));state.preview.urls.push(u);return u;}

  function resolveVirtualPath(basePath,ref,rootDir=dirname(basePath)){
    if(!ref)return null;
    const raw=String(ref).trim();
    if(/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(raw))return null;
    const clean=raw.split('#')[0].split('?')[0]; if(!clean)return null;
    if(clean.startsWith('/')) return normalizePath(rootDir+clean.replace(/^\/+/,''));
    return normalizePath(dirname(basePath)+clean);
  }

  function rewriteCssUrls(css,cssPath,urlMap,rootDir){
    let out=css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(m,q,ref)=>{
      const p=resolveVirtualPath(cssPath,ref,rootDir);const u=p&&urlMap.get(p);return u?`url("${u}")`:m;
    });
    out=out.replace(/@import\s+(["'])([^"']+)\1/gi,(m,q,ref)=>{const p=resolveVirtualPath(cssPath,ref,rootDir);const u=p&&urlMap.get(p);return u?`@import "${u}"`:m;});
    return out;
  }

  function createPreviewUrlMap(filesMap,entryPath){
    disposePreviewUrls();
    const map=new Map(),rootDir=dirname(entryPath);
    for(const [path,f] of filesMap) map.set(path,makeObjectUrl(f.bytes,mimeForPath(path)));
    for(const [path,f] of filesMap){
      if(!/\.css$/i.test(path)||f.binary||f.text==null)continue;
      const rewritten=rewriteCssUrls(f.text,path,map,rootDir);
      map.set(path,makeObjectUrl(encode(rewritten),'text/css;charset=utf-8'));
    }
    state.preview.urlMap=map;
    return map;
  }

  function rewriteSrcset(value,basePath,urlMap,rootDir){
    return String(value).split(',').map(part=>{
      const bits=part.trim().split(/\s+/),ref=bits.shift();const p=resolveVirtualPath(basePath,ref,rootDir),u=p&&urlMap.get(p);return [u||ref,...bits].join(' ');
    }).join(', ');
  }

  function setDirectTextDom(el,text){
    if(!el)return;
    const nodes=[...el.childNodes].filter(n=>n.nodeType===3), node=nodes.find(n=>n.nodeValue.trim())||nodes[0];
    if(node)node.nodeValue=text;else if(!el.children.length)el.textContent=text;else el.insertBefore(document.createTextNode(text),el.firstChild);
  }

  function previewBridgeCode(entryPath,urlMap){
    const assets={};for(const [k,v] of urlMap)assets[k]=v;
    const cfg={entryPath,rootDir:dirname(entryPath),assets,mode:state.preview.mode};
    return `(function(cfg){
'use strict';
const parentWin=window.parent;let mode=cfg.mode||'run',selected=null,hovered=null;
function norm(path){const out=[];String(path||'').replace(/\\\\/g,'/').split('/').forEach(p=>{if(!p||p==='.')return;if(p==='..')out.pop();else out.push(p)});return out.join('/')}
function dir(path){const a=path.split('/');a.pop();return a.length?a.join('/')+'/':''}
function resolve(ref,base=cfg.entryPath){if(!ref||typeof ref!=='string'||/^(?:[a-z][a-z0-9+.-]*:|#|\\/\\/)/i.test(ref))return null;const c=ref.split('#')[0].split('?')[0];if(!c)return null;if(c.startsWith('/'))return norm(cfg.rootDir+c.replace(/^\\/+/,''));return norm(dir(base)+c)}
const nativeFetch=window.fetch&&window.fetch.bind(window);if(nativeFetch){window.fetch=function(input,init){try{const ref=typeof input==='string'?input:(input&&input.url);const p=resolve(ref);if(p&&cfg.assets[p]){if(typeof input==='string')return nativeFetch(cfg.assets[p],init);return nativeFetch(new Request(cfg.assets[p],input),init)}}catch{}return nativeFetch(input,init)}}
try{const xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){const p=typeof url==='string'?resolve(url):null;return xo.call(this,method,(p&&cfg.assets[p])||url,...rest)}}catch{}
const hoverBox=document.createElement('div'),selectBox=document.createElement('div');for(const b of [hoverBox,selectBox]){Object.assign(b.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483647',display:'none',boxSizing:'border-box'})}Object.assign(hoverBox.style,{border:'1px dashed #1f6feb',background:'rgba(31,111,235,.05)'});Object.assign(selectBox.style,{border:'2px solid #1f6feb',boxShadow:'0 0 0 1px rgba(255,255,255,.75)'});document.documentElement.append(hoverBox,selectBox);
function rectBox(box,el){if(!el||!document.documentElement.contains(el)){box.style.display='none';return}const r=el.getBoundingClientRect();Object.assign(box.style,{display:'block',left:r.left+'px',top:r.top+'px',width:Math.max(0,r.width)+'px',height:Math.max(0,r.height)+'px'})}
function esc(s){return window.CSS&&CSS.escape?CSS.escape(s):String(s).replace(/[^a-zA-Z0-9_-]/g,c=>'\\\\'+c)}
function selectorFor(el){if(el.id){const s='#'+esc(el.id);try{if(document.querySelectorAll(s).length===1)return s}catch{}}const parts=[];let cur=el;while(cur&&cur.nodeType===1&&cur!==document.documentElement){let part=cur.tagName.toLowerCase();const cls=[...cur.classList].filter(c=>!c.startsWith('wab-')).slice(0,2);if(cls.length)part+='.'+cls.map(esc).join('.');const par=cur.parentElement;if(par){const same=[...par.children].filter(x=>x.tagName===cur.tagName);if(same.length>1)part+=':nth-of-type('+(same.indexOf(cur)+1)+')'}parts.unshift(part);const candidate=parts.join(' > ');try{if(document.querySelectorAll(candidate).length===1)return candidate}catch{}cur=par}return parts.join(' > ')}
function directText(el){const nodes=[...el.childNodes].filter(n=>n.nodeType===3&&n.nodeValue.trim());if(nodes.length)return nodes.map(n=>n.nodeValue.trim()).join(' ');if(!el.children.length)return (el.textContent||'').trim();return ''}
function info(el){const cs=getComputedStyle(el),r=el.getBoundingClientRect(),selector=selectorFor(el);return {selector,id:el.id||'',tag:el.tagName.toLowerCase(),label:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+([...el.classList].length?'.'+[...el.classList].slice(0,2).join('.'):''),directText:directText(el),styles:{color:cs.color,'background-color':cs.backgroundColor,'font-size':cs.fontSize,'font-weight':cs.fontWeight,'text-align':cs.textAlign,'border-radius':cs.borderRadius,'border-color':cs.borderColor,'border-width':cs.borderWidth,'margin-top':cs.marginTop,'margin-right':cs.marginRight,'margin-bottom':cs.marginBottom,'margin-left':cs.marginLeft,'padding-top':cs.paddingTop,'padding-right':cs.paddingRight,'padding-bottom':cs.paddingBottom,'padding-left':cs.paddingLeft,position:cs.position,left:cs.left,top:cs.top,display:cs.display},rect:{x:r.x,y:r.y,width:r.width,height:r.height},parent:{tag:el.parentElement?.tagName?.toLowerCase()||'',display:el.parentElement?getComputedStyle(el.parentElement).display:''}}}
function select(el){selected=el;rectBox(selectBox,selected);parentWin.postMessage({type:'wab:selected',payload:info(el)},'*')}
function setDirect(el,text){if(!el)return;const nodes=[...el.childNodes].filter(n=>n.nodeType===3);const n=nodes.find(n=>n.nodeValue.trim())||nodes[0];if(n)n.nodeValue=text;else if(!el.children.length)el.textContent=text;else el.insertBefore(document.createTextNode(text),el.firstChild)}
document.addEventListener('mouseover',e=>{if(mode!=='edit'||e.target===hoverBox||e.target===selectBox)return;hovered=e.target;rectBox(hoverBox,hovered)},true);document.addEventListener('mouseout',()=>{if(mode==='edit')hoverBox.style.display='none'},true);document.addEventListener('click',e=>{const route=e.target.closest&&e.target.closest('[data-wab-route]');if(mode==='run'&&route){e.preventDefault();parentWin.postMessage({type:'wab:navigate',path:route.dataset.wabRoute},'*');return}if(mode!=='edit')return;if(e.target===hoverBox||e.target===selectBox)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();select(e.target)},true);
window.addEventListener('scroll',()=>{rectBox(selectBox,selected);rectBox(hoverBox,hovered)},true);window.addEventListener('resize',()=>{rectBox(selectBox,selected);rectBox(hoverBox,hovered)});
window.addEventListener('message',e=>{const d=e.data||{};if(d.type==='wab:set-mode'){mode=d.mode||'run';document.documentElement.style.cursor=mode==='edit'?'crosshair':'';hoverBox.style.display='none'}else if(d.type==='wab:apply-style'){try{const el=document.querySelector(d.selector);if(el){if(d.value)el.style.setProperty(d.prop,d.value,'important');else el.style.removeProperty(d.prop);if(el===selected)rectBox(selectBox,el)}}catch{}}else if(d.type==='wab:apply-text'){try{setDirect(document.querySelector(d.selector),d.text)}catch{}}else if(d.type==='wab:select-selector'){try{const el=document.querySelector(d.selector);if(el)select(el)}catch{}}});
parentWin.postMessage({type:'wab:ready'},'*');
})(${JSON.stringify(cfg)});`;
  }

  function buildPreviewHtml(entryPath,filesMap,urlMap){
    const f=filesMap.get(entryPath);if(!f||f.binary||f.text==null)throw new Error('File HTML preview không hợp lệ.');
    const parser=new DOMParser(),doc=parser.parseFromString(f.text,'text/html'),rootDir=dirname(entryPath);
    doc.querySelectorAll('meta[http-equiv]').forEach(m=>{if((m.getAttribute('http-equiv')||'').toLowerCase()==='content-security-policy')m.remove();});

    doc.querySelectorAll('link[href]').forEach(el=>{const ref=el.getAttribute('href'),p=resolveVirtualPath(entryPath,ref,rootDir);if(p&&urlMap.get(p))el.setAttribute('href',urlMap.get(p));});
    doc.querySelectorAll('script[src]').forEach(el=>{const ref=el.getAttribute('src'),p=resolveVirtualPath(entryPath,ref,rootDir);if(p&&urlMap.get(p))el.setAttribute('src',urlMap.get(p));});
    doc.querySelectorAll('[src]').forEach(el=>{if(el.tagName==='SCRIPT')return;const ref=el.getAttribute('src'),p=resolveVirtualPath(entryPath,ref,rootDir);if(p&&urlMap.get(p))el.setAttribute('src',urlMap.get(p));});
    doc.querySelectorAll('[srcset]').forEach(el=>el.setAttribute('srcset',rewriteSrcset(el.getAttribute('srcset'),entryPath,urlMap,rootDir)));
    doc.querySelectorAll('[poster]').forEach(el=>{const ref=el.getAttribute('poster'),p=resolveVirtualPath(entryPath,ref,rootDir);if(p&&urlMap.get(p))el.setAttribute('poster',urlMap.get(p));});
    doc.querySelectorAll('[style]').forEach(el=>el.setAttribute('style',rewriteCssUrls(el.getAttribute('style'),entryPath,urlMap,rootDir)));
    doc.querySelectorAll('style').forEach(el=>{el.textContent=rewriteCssUrls(el.textContent,entryPath,urlMap,rootDir);});
    doc.querySelectorAll('a[href]').forEach(el=>{const ref=el.getAttribute('href'),p=resolveVirtualPath(entryPath,ref,rootDir);if(p&&/\.html?$/i.test(p)&&filesMap.has(p)){el.dataset.wabRoute=p;el.setAttribute('href','#');}});

    for(const edit of getVisualEdits(entryPath)){
      if(edit.textNew==null||edit.textNew===edit.textOriginal)continue;
      try{setDirectTextDom(doc.querySelector(edit.selector),edit.textNew);}catch{}
    }

    const bridge=doc.createElement('script');bridge.id='wab-preview-bridge';bridge.textContent=previewBridgeCode(entryPath,urlMap).replace(/<\/script/gi,'<\\/script');
    (doc.head||doc.documentElement).insertBefore(bridge,(doc.head||doc.documentElement).firstChild);
    return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }

  function openPreview(reselectSelector=''){
    if(!state.files.size){alert('Hãy nạp source trước.');return;}
    const entry=previewEntry.value||state.preview.entryPath;
    if(!entry||!state.files.has(entry)){alert('Không tìm thấy file HTML để mở.');return;}
    state.preview.entryPath=entry;state.preview.opened=true;state.preview.selected=null;
    const {output}=applyChanges({prepareBuild:false});
    try{
      const map=createPreviewUrlMap(output,entry),html=buildPreviewHtml(entry,output,map);
      $('previewEmpty').hidden=true;
      previewFrame.onload=()=>{
        sendToPreview({type:'wab:set-mode',mode:state.preview.mode});
        const target=reselectSelector||state.preview.lastSelector;
        if(target)setTimeout(()=>sendToPreview({type:'wab:select-selector',selector:target}),60);
      };
      previewFrame.srcdoc=html;
      updateVisualStatus();
    }catch(err){previewStatus.textContent='Không mở được preview: '+err.message;previewStatus.classList.add('visual-dirty');}
  }

  function closePreview(){
    disposePreviewUrls();state.preview.opened=false;state.preview.selected=null;state.preview.lastSelector='';
    if(previewFrame)previewFrame.srcdoc='';
    if($('previewEmpty'))$('previewEmpty').hidden=false;
    showInspector(null);updateVisualStatus();
  }

  function sendToPreview(message){try{previewFrame.contentWindow?.postMessage(message,'*');}catch{}}

  function setPreviewMode(mode){
    state.preview.mode=mode;
    $('runModeBtn').classList.toggle('active',mode==='run');$('editModeBtn').classList.toggle('active',mode==='edit');
    sendToPreview({type:'wab:set-mode',mode});updateVisualStatus();
  }

  function setViewport(viewport){
    state.preview.viewport=viewport;previewViewport.className='preview-viewport '+viewport;
    document.querySelectorAll('.viewport-btn').forEach(b=>b.classList.toggle('active',b.dataset.viewport===viewport));
  }

  function handlePreviewMessage(e){
    if(e.source!==previewFrame.contentWindow)return;
    const d=e.data||{};
    if(d.type==='wab:selected'){
      state.preview.selected=d.payload;state.preview.lastSelector=d.payload?.selector||'';showInspector(d.payload);
    }else if(d.type==='wab:navigate'&&d.path&&state.files.has(d.path)){
      previewEntry.value=d.path;state.preview.entryPath=d.path;openPreview();
    }
  }

  function showInspector(selection){
    if(!selection){inspectorEmpty.hidden=false;inspectorPanel.hidden=true;return;}
    inspectorEmpty.hidden=true;inspectorPanel.hidden=false;populateInspector(selection);
  }

  function cssColorToHex(value,fallback='#000000'){
    const m=String(value||'').match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/i);
    if(!m)return /^#[0-9a-f]{6}$/i.test(value)?value:fallback;
    if(m[4]!=null&&Number(m[4])===0)return fallback;
    return '#'+[m[1],m[2],m[3]].map(n=>Math.max(0,Math.min(255,Number(n))).toString(16).padStart(2,'0')).join('');
  }
  function normalizeHex(v){
    let s=String(v||'').trim();if(/^#[0-9a-f]{3}$/i.test(s))s='#'+s.slice(1).split('').map(c=>c+c).join('');return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():null;
  }
  function numberFromCss(v){const n=parseFloat(v);return Number.isFinite(n)?String(Math.round(n*100)/100):'';}

  function populateInspector(selection){
    if(!selection)return;
    const edit=ensureVisualEdit(selection),styles=edit?.styles||{},orig=selection.styles||{};
    const eff=p=>styles[p]??orig[p]??'';
    $('selectedLabel').textContent=selection.label||selection.tag||'Element';$('selectedSelector').textContent=selection.selector||'';
    $('visualText').value=edit?.textNew!=null?edit.textNew:(edit?.textOriginal||selection.directText||'');
    const src=edit?.textSource;
    $('textSourceInfo').textContent=src?.safe?`Nguồn text an toàn: ${src.path} • 1 vị trí HTML`:(src?.reason||'Chưa xác định nguồn text.');
    $('applyTextBtn').disabled=!(edit?.textOriginal||selection.directText);

    const tc=cssColorToHex(eff('color'),'#000000'),bg=cssColorToHex(eff('background-color'),'#ffffff'),bc=cssColorToHex(eff('border-color'),'#000000');
    $('textColor').value=tc;$('textColorHex').value=tc;$('bgColor').value=bg;$('bgColorHex').value=bg;$('borderColor').value=bc;$('borderColorHex').value=bc;
    $('fontSize').value=numberFromCss(eff('font-size'));$('fontWeight').value=['400','500','600','700','800','900'].includes(String(eff('font-weight')))?String(eff('font-weight')):'';$('borderRadius').value=numberFromCss(eff('border-radius'));

    const spacing={marginTop:'margin-top',marginRight:'margin-right',marginBottom:'margin-bottom',marginLeft:'margin-left',paddingTop:'padding-top',paddingRight:'padding-right',paddingBottom:'padding-bottom',paddingLeft:'padding-left'};
    for(const [id,prop] of Object.entries(spacing))$(id).value=numberFromCss(eff(prop));
    document.querySelectorAll('.style-btn[data-prop="text-align"]').forEach(b=>b.classList.toggle('active',b.dataset.value===eff('text-align')));
    document.querySelectorAll('.block-align-btn').forEach(b=>b.classList.toggle('active',b.dataset.align===edit?.blockAlign));
    $('nudgeValue').textContent=`X: ${edit?.nudge?.x||0} px · Y: ${edit?.nudge?.y||0} px`;
    const canNudge=['static','relative'].includes(String(orig.position||'static').toLowerCase());document.querySelectorAll('.nudge-btn').forEach(b=>b.disabled=!canNudge);
    $('elementMeta').textContent=`selector: ${selection.selector}\ntag: ${selection.tag}\nsize: ${Math.round(selection.rect?.width||0)} × ${Math.round(selection.rect?.height||0)} px\nposition: ${orig.position||''}\nparent: ${selection.parent?.tag||'-'} (${selection.parent?.display||'-'})`;
  }

  function bindColorPair(colorId,hexId,prop){
    $(colorId).addEventListener('change',()=>{$(hexId).value=$(colorId).value;applyStylePatch({[prop]:$(colorId).value});});
    $(hexId).addEventListener('change',()=>{const h=normalizeHex($(hexId).value);if(!h){populateInspector(state.preview.selected);return;}$(colorId).value=h;$(hexId).value=h;applyStylePatch({[prop]:h});});
  }

  /* =========================
     Validator / Diff / Export
     ========================= */

  function validate(){
    const {output,cfg}=applyChanges({prepareBuild:true}); const checks=[];
    const bad=[];
    checks.push(cfg.appName?['ok','Có tên app.']:['warn','Chưa nhập tên app.']);
    checks.push(cfg.version?['ok','Có phiên bản.']:['warn','Chưa nhập phiên bản.']);
    const indexPaths=[...output.keys()].filter(p=>/(^|\/)index\.html?$/i.test(p));
    if(indexPaths.length)checks.push(['ok',`Tìm thấy ${indexPaths.length} file index.html.`]);else{checks.push(['bad','Không tìm thấy index.html. Builder vẫn có thể preview HTML khác nhưng app static thường cần entry index.html.']);bad.push('missing-index');}
    if(cfg.supabaseUrl){ const c=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl)?['ok','Supabase URL đúng định dạng.']:['bad','Supabase URL có vẻ không đúng định dạng.'];checks.push(c);if(c[0]==='bad')bad.push('supabase-url'); }
    if(cfg.supabaseKey){ checks.push((/^sb_publishable_/i.test(cfg.supabaseKey)||/^eyJ[A-Za-z0-9._-]+$/.test(cfg.supabaseKey))?['ok','Public/anon key có định dạng hợp lý.']:['warn','Key không giống Supabase publishable/anon key thông thường.']); }

    for(const [path,f] of output){
      if(f.binary||f.text==null)continue;
      if(/\.(json|webmanifest)$/i.test(path)){try{JSON.parse(f.text);checks.push(['ok',`${path}: JSON hợp lệ.`]);}catch(err){checks.push(['bad',`${path}: JSON lỗi sau thay đổi (${err.message}).`]);bad.push('json:'+path);}}
    }

    const danger=[];
    for(const [path,f] of output){
      if(f.binary||f.text==null)continue; const t=f.text;
      if(/\bsb_secret_[A-Za-z0-9._-]{10,}\b/.test(t)) danger.push(`${path}: phát hiện sb_secret_ key`);
      if(/\b(?:SUPABASE_SERVICE_ROLE|SERVICE_ROLE)\b[^\n]{0,160}\beyJ[A-Za-z0-9._-]{40,}/i.test(t)) danger.push(`${path}: có thể chứa service_role JWT`);
      if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(t)) danger.push(`${path}: phát hiện private key PEM`);
      const secretAssign=/\b(VAPID_PRIVATE_KEY|PRIVATE_KEY|CRON_SECRET|[A-Z0-9_]+_CRON_SECRET|SECRET_KEY|[A-Z0-9_]+_SECRET_KEY)\b\s*[:=]\s*["'`](?!CHANGE_ME|YOUR_|<|\$\{)([^"'`\n]{20,})["'`]/ig;
      let sm;while((sm=secretAssign.exec(t)))danger.push(`${path}: có thể chứa ${sm[1]}`);
    }
    danger.forEach(x=>{checks.push(['bad',x]);bad.push('secret:'+x);});
    if(!danger.length) checks.push(['ok','Không phát hiện secret server phổ biến trong frontend.']);

    for(const edit of state.visualEdits.values()){
      if(edit.textNew==null||edit.textNew===edit.textOriginal)continue;
      if(edit.textSource?.safe)checks.push(['ok',`Visual text ${edit.selector}: xác định được nguồn HTML duy nhất.`]);
      else if($('allowRuntimeText').checked)checks.push(['warn',`Visual text ${edit.selector}: dùng runtime override vì source không duy nhất/dynamic.`]);
      else{checks.push(['bad',`Visual text ${edit.selector}: chưa có nguồn duy nhất. Bật Runtime text ở Nâng cao hoặc bỏ thay đổi text này.`]);bad.push('visual-text:'+edit.selector);}
    }

    const sw=[...output.keys()].filter(p=>/(^|\/)(?:service-worker|sw)\.js$/i.test(p));
    if(sw.length)checks.push(['warn',`Phát hiện Service Worker (${sw.join(', ')}). Live Preview không mô phỏng đầy đủ origin/cache production; cần test ZIP sau khi xuất.`]);
    const modules=[];for(const [p,f] of output){if(f.binary||f.text==null||!/\.html?$/i.test(p))continue;if(/<script\b[^>]*type=["']module["']/i.test(f.text))modules.push(p);}if(modules.length)checks.push(['warn',`Có ES module ở ${modules.join(', ')}. Live Preview hỗ trợ file module trực tiếp nhưng import tương đối lồng sâu có thể khác production.`]);

    checks.push(state.files.size?['ok',`${state.files.size} file sẵn sàng xuất; file không chỉnh sửa giữ nguyên bytes.`]:['bad','Chưa nạp source.']);
    if(!state.files.size)bad.push('no-source');
    renderValidation(checks); return {checks,bad,danger};
  }

  function renderValidation(checks){
    const box=$('validation');box.className='validation';box.innerHTML='';
    checks.forEach(([type,msg])=>{const d=document.createElement('div');d.className=`check ${type}`;d.textContent=(type==='ok'?'✓ ':type==='warn'?'⚠ ':'✕ ')+msg;box.appendChild(d);});
  }

  function previewDiff(){
    if(!state.files.size){alert('Hãy nạp source trước.');return;}
    const {changes}=applyChanges({prepareBuild:true});const box=$('previewContent');box.innerHTML='';
    if(!changes.length){box.textContent='Không có thay đổi.';}else{
      const by=new Map();changes.forEach(c=>{if(!by.has(c.path))by.set(c.path,[]);by.get(c.path).push(c);});
      for(const [path,arr] of by){const card=document.createElement('div');card.className='preview-file';const h=document.createElement('h4');h.textContent=path;card.appendChild(h);arr.forEach(c=>{const a=document.createElement('div');a.className='diff-line diff-old';a.textContent=`− ${fieldLabel(c.field)}: ${maskIfKey(c.field,c.old)}  (${c.count} vị trí)`;const b=document.createElement('div');b.className='diff-line diff-new';b.textContent=`+ ${fieldLabel(c.field)}: ${maskIfKey(c.field,c.new)}`;card.append(a,b);});box.appendChild(card);}
    }
    $('previewDialog').showModal();
  }
  function maskIfKey(field,val){ if(/key/i.test(field) && val && val.length>16)return val.slice(0,8)+'…'+val.slice(-5);return val; }

  async function exportZip(){
    if(!state.files.size){alert('Hãy nạp source trước.');return;}
    const {bad}=validate(); if(bad.length && !$('allowUnsafe').checked){alert('Đang có lỗi/cảnh báo nghiêm trọng. Kiểm tra mục 7 hoặc bật cho phép xuất nếu bạn đã hiểu rủi ro.');return;}
    const {output,cfg}=applyChanges({prepareBuild:true});
    const entries=[...output].map(([name,f])=>({name,bytes:f.bytes}));
    const zipBytes=makeZip(entries);
    const base=safeName(cfg.appName || state.projectName), ver=safeName(cfg.version || 'build');
    downloadBlob(new Blob([zipBytes],{type:'application/zip'}),`${base}-${ver}.zip`);
  }

  /* =========================
     Adapter / Profile
     ========================= */

  async function makeAdapter(){
    const signature=await projectSignature();
    return {
      format:'web-app-builder-adapter',version:1,builderVersion:'1.1',createdAt:new Date().toISOString(),signature,
      config:Object.fromEntries(fields.map(k=>[k,els[k].value.trim()])),
      options:{globalNameSync:$('globalNameSync').checked,autoBuild:$('autoBuild').checked,allowRuntimeText:$('allowRuntimeText').checked},
      detections:state.detections.map(d=>({field:d.field,path:d.path,current:d.current,before:d.before,after:d.after,label:d.label,enabled:d.enabled})),
      manualRules:state.manualRules.map(r=>({...r})),
      visualEdits:[...state.visualEdits.values()].map(e=>cloneJson(e))
    };
  }

  async function applyAdapter(adapter){
    if(!adapter || adapter.format!=='web-app-builder-adapter') throw new Error('Không đúng định dạng adapter.');
    for(const k of fields) if(adapter.config?.[k]!=null) els[k].value=adapter.config[k];
    if(adapter.options){$('globalNameSync').checked=adapter.options.globalNameSync===true;$('autoBuild').checked=adapter.options.autoBuild!==false;$('allowRuntimeText').checked=adapter.options.allowRuntimeText===true;}
    if(Array.isArray(adapter.detections) && state.files.size){
      state.detections=adapter.detections.filter(d=>state.files.has(d.path)).map((d,i)=>({...d,key:`adapter-${i}`}));renderDetections();
    }
    state.manualRules=[];manualRulesEl.innerHTML='';(adapter.manualRules||[]).forEach(addManualRule);
    state.visualEdits.clear();for(const e of (adapter.visualEdits||[])){if(e?.entryPath&&e?.selector&&state.files.has(e.entryPath)){e.key=visualKey(e.entryPath,e.selector);state.visualEdits.set(e.key,e);}}
    state.visualHistory=[];markBuildDirty();updateVisualButtons();
  }

  async function projectSignature(){
    const parts=[];for(const [p,f] of [...state.files.entries()].sort((a,b)=>a[0].localeCompare(b[0])))parts.push(`${p}:${f.bytes.length}:${crc32(f.bytes).toString(16)}`);
    return sha256(parts.join('|'));
  }
  async function legacyProjectSignature(){ return sha256([...state.files.keys()].sort().join('|')); }
  async function saveProfile(){ if(!state.files.size){alert('Nạp source trước.');return;} const a=await makeAdapter();localStorage.setItem('wab-profile-'+a.signature,JSON.stringify(a));alert('Đã lưu profile cho đúng fingerprint source này trên trình duyệt.'); }
  async function loadProfile(){
    if(!state.files.size){alert('Nạp source trước.');return;}
    const sig=await projectSignature();let raw=localStorage.getItem('wab-profile-'+sig);
    if(!raw){const legacy=await legacyProjectSignature();raw=localStorage.getItem('wab-profile-'+legacy);}
    if(!raw){alert('Chưa có profile đã lưu cho source này.');return;}
    await applyAdapter(JSON.parse(raw));alert('Đã nạp profile.');
  }
  async function exportAdapter(){ const a=await makeAdapter();downloadBlob(new Blob([JSON.stringify(a,null,2)],{type:'application/json'}),`${safeName(els.appName.value||state.projectName)}-builder.adapter.json`); }
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}

  /* =========================
     ZIP engine (local only)
     ========================= */

  const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function u16(n){return [n&255,(n>>>8)&255];} function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
  function concat(parts){let len=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(len),o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
  function dosDateTime(d=new Date()){let time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);let date=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);return {time,date};}
  function makeZip(entries){
    const locals=[],centrals=[];let offset=0;const dt=dosDateTime();
    for(const e of entries){const name=encode(e.name.replace(/^\/+/,'')),data=e.bytes instanceof Uint8Array?e.bytes:new Uint8Array(e.bytes),crc=crc32(data);const local=new Uint8Array([0x50,0x4b,0x03,0x04,...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);locals.push(local,data);const central=new Uint8Array([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);centrals.push(central);offset+=local.length+data.length;}
    const centralData=concat(centrals),localData=concat(locals);const end=new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralData.length),...u32(localData.length),...u16(0)]);return concat([localData,centralData,end]);
  }
  function get16(a,o){return a[o]|(a[o+1]<<8);} function get32(a,o){return (a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24))>>>0;}
  async function readZip(bytes){
    let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(get32(bytes,i)===0x06054b50){eocd=i;break;}}if(eocd<0)throw new Error('Không tìm thấy ZIP central directory.');
    const count=get16(bytes,eocd+10),cdOffset=get32(bytes,eocd+16);let pos=cdOffset;const out=[];
    for(let i=0;i<count;i++){
      if(get32(bytes,pos)!==0x02014b50)throw new Error('ZIP central directory không hợp lệ.');
      const flags=get16(bytes,pos+8),method=get16(bytes,pos+10),compSize=get32(bytes,pos+20),nameLen=get16(bytes,pos+28),extraLen=get16(bytes,pos+30),commentLen=get16(bytes,pos+32),localOffset=get32(bytes,pos+42);const nameBytes=bytes.slice(pos+46,pos+46+nameLen);const name=new TextDecoder((flags&0x0800)?'utf-8':'utf-8').decode(nameBytes);pos+=46+nameLen+extraLen+commentLen;if(name.endsWith('/'))continue;
      if(get32(bytes,localOffset)!==0x04034b50)throw new Error(`Local header lỗi: ${name}`);const ln=get16(bytes,localOffset+26),le=get16(bytes,localOffset+28),dataStart=localOffset+30+ln+le,comp=bytes.slice(dataStart,dataStart+compSize);let data;
      if(method===0)data=comp;else if(method===8)data=await inflateRaw(comp);else throw new Error(`ZIP dùng compression method ${method} chưa hỗ trợ (${name}).`);out.push({name,bytes:data});
    }
    return out;
  }
  async function inflateRaw(bytes){
    if(typeof DecompressionStream==='undefined') throw new Error('Trình duyệt này không hỗ trợ giải nén ZIP deflate. Hãy chọn các file trực tiếp.');
    let ds;try{ds=new DecompressionStream('deflate-raw');}catch{throw new Error('Trình duyệt không hỗ trợ deflate-raw. Hãy chọn file/thư mục trực tiếp.');}
    const stream=new Blob([bytes]).stream().pipeThrough(ds);return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* =========================
     Events
     ========================= */

  fileInput.addEventListener('change',e=>loadFiles(e.target.files));folderInput.addEventListener('change',e=>loadFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.remove('drag');}));
  dropZone.addEventListener('drop',e=>loadFiles(e.dataTransfer.files));

  $('clearBtn').onclick=()=>{
    closePreview();state.files.clear();state.detections=[];state.manualRules=[];state.visualEdits.clear();state.visualHistory=[];manualRulesEl.innerHTML='';fileListEl.innerHTML='';summaryEl.textContent='Chưa nạp source.';detectionsEl.textContent='Nạp source để bắt đầu quét.';fields.forEach(k=>els[k].value='');previewEntry.innerHTML='';markBuildDirty();updateVisualButtons();
  };
  $('scanBtn').onclick=scan;$('addRuleBtn').onclick=()=>addManualRule();$('validateBtn').onclick=validate;$('previewBtn').onclick=previewDiff;$('exportBtn').onclick=exportZip;$('closePreviewBtn').onclick=()=>$('previewDialog').close();
  $('saveProfileBtn').onclick=saveProfile;$('loadProfileBtn').onclick=loadProfile;$('exportAdapterBtn').onclick=exportAdapter;
  $('adapterInput').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;await applyAdapter(JSON.parse(await f.text()));alert('Đã nhập adapter.');}catch(err){alert('Adapter lỗi: '+err.message);}});

  fields.forEach(k=>els[k].addEventListener('input',()=>{if(k==='appName')state.projectName=safeName(els.appName.value||'web-app');markBuildDirty();}));
  $('autoBuild').addEventListener('change',markBuildDirty);$('globalNameSync').addEventListener('change',markBuildDirty);$('allowRuntimeText').addEventListener('change',()=>{markBuildDirty();updateVisualStatus();});

  $('openPreviewBtn').onclick=()=>openPreview();$('reloadPreviewBtn').onclick=()=>openPreview(state.preview.lastSelector);previewEntry.addEventListener('change',()=>{state.preview.entryPath=previewEntry.value;state.preview.lastSelector='';if(state.preview.opened)openPreview();});
  $('runModeBtn').onclick=()=>setPreviewMode('run');$('editModeBtn').onclick=()=>setPreviewMode('edit');document.querySelectorAll('.viewport-btn').forEach(b=>b.onclick=()=>setViewport(b.dataset.viewport));
  $('undoVisualBtn').onclick=undoVisual;$('clearVisualBtn').onclick=clearVisual;$('resetSelectedBtn').onclick=resetSelectedVisual;$('applyTextBtn').onclick=applyVisualText;

  bindColorPair('textColor','textColorHex','color');bindColorPair('bgColor','bgColorHex','background-color');bindColorPair('borderColor','borderColorHex','border-color');
  $('fontSize').addEventListener('change',()=>applyStylePatch({'font-size':$('fontSize').value?`${$('fontSize').value}px`:''}));
  $('fontWeight').addEventListener('change',()=>applyStylePatch({'font-weight':$('fontWeight').value}));
  $('borderRadius').addEventListener('change',()=>applyStylePatch({'border-radius':$('borderRadius').value?`${$('borderRadius').value}px`:''}));
  document.querySelectorAll('.style-btn').forEach(b=>b.onclick=()=>applyStylePatch({[b.dataset.prop]:b.dataset.value}));
  document.querySelectorAll('.block-align-btn').forEach(b=>b.onclick=()=>{
    const a=b.dataset.align,patch=a==='left'?{'margin-left':'0px','margin-right':'auto'}:a==='center'?{'margin-left':'auto','margin-right':'auto'}:{'margin-left':'auto','margin-right':'0px'};
    applyStylePatch(patch,{blockAlign:a});
  });
  document.querySelectorAll('.nudge-btn').forEach(b=>b.onclick=()=>{const dx=Number(b.dataset.dx),dy=Number(b.dataset.dy);setNudge(dx,dy,dx===0&&dy===0);});
  const spacing={marginTop:'margin-top',marginRight:'margin-right',marginBottom:'margin-bottom',marginLeft:'margin-left',paddingTop:'padding-top',paddingRight:'padding-right',paddingBottom:'padding-bottom',paddingLeft:'padding-left'};
  for(const [id,prop] of Object.entries(spacing))$(id).addEventListener('change',()=>applyStylePatch({[prop]:$(id).value===''?'':`${$(id).value}px`}));

  window.addEventListener('message',handlePreviewMessage);
  document.addEventListener('keydown',e=>{
    if(state.preview.mode!=='edit'||!state.preview.selected)return;
    const tag=(document.activeElement?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||document.activeElement?.isContentEditable)return;
    const step=e.shiftKey?10:1,dir={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(!dir)return;e.preventDefault();setNudge(dir[0],dir[1]);
  });

  setPreviewMode('run');setViewport('desktop');updateVisualButtons();showInspector(null);
})();
