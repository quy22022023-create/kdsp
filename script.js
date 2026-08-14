(() => {
  'use strict';

  const state = {
    files: new Map(), // path -> {bytes, text|null, binary}
    detections: [],
    manualRules: [],
    originalValues: {},
    projectName: 'web-app',
  };

  const TEXT_EXT = /\.(html?|css|js|mjs|cjs|json|txt|md|xml|svg|webmanifest|env|yml|yaml|toml|ini)$/i;
  const $ = (id) => document.getElementById(id);
  const fields = ['appName','shortName','version','buildId','supabaseUrl','supabaseKey'];

  const els = Object.fromEntries(fields.map(k => [k, $(k)]));
  const fileInput = $('fileInput'), folderInput = $('folderInput'), dropZone = $('dropZone');
  const detectionsEl = $('detections'), fileListEl = $('fileList'), summaryEl = $('projectSummary');
  const manualRulesEl = $('manualRules'), ruleTemplate = $('ruleTemplate');

  function isTextPath(path){ return TEXT_EXT.test(path) || !/\.[a-z0-9]{1,8}$/i.test(path); }
  function decode(bytes){ try{return new TextDecoder('utf-8',{fatal:false}).decode(bytes);}catch{return null;} }
  function encode(text){ return new TextEncoder().encode(text); }
  function basename(path){ return path.split('/').filter(Boolean).pop() || path; }
  function safeName(s){ return (s || 'web-app').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') || 'web-app'; }
  function nowBuild(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; }

  async function sha256(text){
    if(!crypto?.subtle) return '';
    const data = encode(text);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return [...hash].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function loadFiles(fileList){
    const files = Array.from(fileList || []);
    if(!files.length) return;
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
    const binary = !isTextPath(path);
    state.files.set(path, {bytes, binary, text: binary ? null : decode(bytes)});
  }

  function inferProjectName(){
    const titlePath=[...state.files.keys()].find(p=>/index\.html?$/i.test(p));
    return titlePath ? basename(titlePath).replace(/\.html?$/i,'') : 'web-app';
  }

  function refreshProject(){
    renderFiles();
    scan();
    populateRuleFileOptions();
  }

  function renderFiles(){
    const paths=[...state.files.keys()];
    const textCount=[...state.files.values()].filter(f=>!f.binary).length;
    summaryEl.textContent = `${paths.length} file • ${textCount} file text có thể phân tích • ${paths.length-textCount} file nhị phân được giữ nguyên`;
    fileListEl.innerHTML='';
    paths.slice(0,30).forEach(p=>{const d=document.createElement('span');d.className='file-chip';d.title=p;d.textContent=p;fileListEl.appendChild(d);});
    if(paths.length>30){const d=document.createElement('span');d.className='file-chip';d.textContent=`+${paths.length-30} file`;fileListEl.appendChild(d);}
  }

  function addDetection(field, path, current, before='', after='', label=''){
    current = String(current ?? '');
    if(!current) return;
    const key=[field,path,before,current,after].join('\u0001');
    if(state.detections.some(d=>d.key===key)) return;
    state.detections.push({key,field,path,current,before,after,label,enabled:true});
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
    state.detections.forEach((d,i)=>{
      const row=document.createElement('div');row.className='detect-row';
      const cb=document.createElement('input');cb.type='checkbox';cb.checked=d.enabled;cb.addEventListener('change',()=>d.enabled=cb.checked);
      const f=document.createElement('div');f.className='detect-field';f.textContent=fieldLabel(d.field);
      const v=document.createElement('div');v.className='detect-value';v.title=d.current;v.textContent=d.current;
      const p=document.createElement('div');p.className='detect-file';p.title=d.path;p.textContent=d.path;
      row.append(cb,f,v,p);detectionsEl.appendChild(row);
    });
  }

  function fieldLabel(f){return ({appName:'Tên app',shortName:'Tên ngắn',version:'Phiên bản',buildId:'Build ID',supabaseUrl:'DB URL',supabaseKey:'Public key'})[f]||f;}
  function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

  function currentConfig(){
    const cfg={};fields.forEach(k=>cfg[k]=els[k].value.trim());
    if($('autoBuild').checked) cfg.buildId=nowBuild();
    return cfg;
  }

  function applyChanges(){
    const cfg=currentConfig();
    const output=new Map();
    for(const [path,f] of state.files) output.set(path,{...f,bytes:new Uint8Array(f.bytes),text:f.text});
    const changes=[];

    for(const d of state.detections){
      if(!d.enabled) continue;
      const next=cfg[d.field]; if(next==null || next==='') continue;
      const f=output.get(d.path); if(!f || f.binary || f.text==null) continue;
      const oldFull=d.before+d.current+d.after, newFull=d.before+next+d.after;
      if(oldFull===newFull) continue;
      const count=countOccurrences(f.text,oldFull);
      if(count){ f.text=f.text.split(oldFull).join(newFull); changes.push({path:d.path,field:d.field,old:d.current,new:next,count}); }
    }

    if($('globalNameSync').checked && state.originalValues.appName && cfg.appName && cfg.appName!==state.originalValues.appName){
      const oldName=state.originalValues.appName;
      for(const [path,f] of output){
        if(f.binary || f.text==null) continue;
        const count=countOccurrences(f.text,oldName);
        if(count){ f.text=f.text.split(oldName).join(cfg.appName); changes.push({path,field:'appName-global',old:oldName,new:cfg.appName,count}); }
      }
    }

    for(const r of state.manualRules){
      if(!r.file || !r.search) continue;
      const f=output.get(r.file); if(!f || f.binary || f.text==null) continue;
      const replacement=r.field==='custom'?r.custom:(cfg[r.field]||'');
      if(replacement==='') continue;
      const count=countOccurrences(f.text,r.search);
      if(count){ f.text=f.text.split(r.search).join(replacement); changes.push({path:r.file,field:'manual',old:r.search,new:replacement,count}); }
    }

    for(const [,f] of output){ if(!f.binary && f.text!=null) f.bytes=encode(f.text); }
    return {output,changes,cfg};
  }

  function countOccurrences(text,needle){ if(!needle) return 0; return text.split(needle).length-1; }

  function addManualRule(data={}){
    const frag=ruleTemplate.content.cloneNode(true); const row=frag.querySelector('.rule-row');
    const fileSel=row.querySelector('.rule-file'), search=row.querySelector('.rule-search'), fieldSel=row.querySelector('.rule-field'), custom=row.querySelector('.rule-custom');
    fillFileSelect(fileSel,data.file);
    search.value=data.search||'';fieldSel.value=data.field||'appName';custom.value=data.custom||'';custom.hidden=fieldSel.value!=='custom';
    const obj={file:fileSel.value,search:search.value,field:fieldSel.value,custom:custom.value};
    state.manualRules.push(obj);
    fileSel.onchange=()=>obj.file=fileSel.value;search.oninput=()=>obj.search=search.value;fieldSel.onchange=()=>{obj.field=fieldSel.value;custom.hidden=fieldSel.value!=='custom';};custom.oninput=()=>obj.custom=custom.value;
    row.querySelector('.rule-remove').onclick=()=>{ const idx=state.manualRules.indexOf(obj);if(idx>=0)state.manualRules.splice(idx,1);row.remove(); };
    manualRulesEl.appendChild(frag);
  }

  function fillFileSelect(sel,chosen=''){
    sel.innerHTML=''; [...state.files.entries()].filter(([,f])=>!f.binary).forEach(([path])=>{const o=document.createElement('option');o.value=path;o.textContent=path;o.selected=path===chosen;sel.appendChild(o);});
  }
  function populateRuleFileOptions(){ manualRulesEl.querySelectorAll('.rule-file').forEach(sel=>{const v=sel.value;fillFileSelect(sel,v);}); }

  function validate(){
    const {output,cfg}=applyChanges(); const checks=[];
    checks.push(cfg.appName?['ok','Có tên app.']:['warn','Chưa nhập tên app.']);
    checks.push(cfg.version?['ok','Có phiên bản.']:['warn','Chưa nhập phiên bản.']);
    if(cfg.supabaseUrl){ checks.push(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl)?['ok','Supabase URL đúng định dạng.']:['bad','Supabase URL có vẻ không đúng định dạng.']); }
    if(cfg.supabaseKey){ checks.push((/^sb_publishable_/i.test(cfg.supabaseKey)||/^eyJ[A-Za-z0-9._-]+$/.test(cfg.supabaseKey))?['ok','Public/anon key có định dạng hợp lý.']:['warn','Key không giống Supabase publishable/anon key thông thường.']); }
    const danger=[];
    for(const [path,f] of output){
      if(f.binary||f.text==null)continue; const t=f.text;
      if(/sb_secret_[A-Za-z0-9._-]{10,}/.test(t)) danger.push(`${path}: phát hiện sb_secret_ key`);
      if(/service_role[^\n]{0,120}eyJ[A-Za-z0-9._-]{40,}/i.test(t)) danger.push(`${path}: có thể chứa service_role JWT`);
      if(/VAPID_PRIVATE_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{30,}/i.test(t)) danger.push(`${path}: có thể chứa VAPID private key`);
      if(/(?:CRON_SECRET|OTPRO_CRON_SECRET)\s*[:=]\s*["']?(?!CHANGE_ME|YOUR_|<)[A-Za-z0-9_-]{20,}/i.test(t)) danger.push(`${path}: có thể chứa Cron secret`);
    }
    danger.forEach(x=>checks.push(['bad',x]));
    if(!danger.length) checks.push(['ok','Không phát hiện secret server phổ biến trong frontend.']);
    checks.push(state.files.size?['ok',`${state.files.size} file sẵn sàng xuất.`]:['bad','Chưa nạp source.']);
    renderValidation(checks); return {checks,danger};
  }

  function renderValidation(checks){
    const box=$('validation');box.className='validation';box.innerHTML='';
    checks.forEach(([type,msg])=>{const d=document.createElement('div');d.className=`check ${type}`;d.textContent=(type==='ok'?'✓ ':type==='warn'?'⚠ ':'✕ ')+msg;box.appendChild(d);});
  }

  function preview(){
    if(!state.files.size){alert('Hãy nạp source trước.');return;}
    const {changes}=applyChanges();const box=$('previewContent');box.innerHTML='';
    if(!changes.length){box.textContent='Không có thay đổi.';}else{
      const by=new Map();changes.forEach(c=>{if(!by.has(c.path))by.set(c.path,[]);by.get(c.path).push(c);});
      for(const [path,arr] of by){const card=document.createElement('div');card.className='preview-file';const h=document.createElement('h4');h.textContent=path;card.appendChild(h);arr.forEach(c=>{const a=document.createElement('div');a.className='diff-line diff-old';a.textContent=`− ${fieldLabel(c.field)}: ${maskIfKey(c.field,c.old)}  (${c.count} vị trí)`;const b=document.createElement('div');b.className='diff-line diff-new';b.textContent=`+ ${fieldLabel(c.field)}: ${maskIfKey(c.field,c.new)}`;card.append(a,b);});box.appendChild(card);}
    }
    $('previewDialog').showModal();
  }
  function maskIfKey(field,val){ if(/key/i.test(field) && val && val.length>16)return val.slice(0,8)+'…'+val.slice(-5);return val; }

  async function exportZip(){
    if(!state.files.size){alert('Hãy nạp source trước.');return;}
    const {danger}=validate(); if(danger.length && !$('allowUnsafe').checked){alert('Đang có cảnh báo secret nghiêm trọng. Kiểm tra mục 6 hoặc bật cho phép xuất nếu bạn chắc chắn.');return;}
    const {output,cfg}=applyChanges();
    const entries=[...output].map(([name,f])=>({name,bytes:f.bytes}));
    const zipBytes=makeZip(entries);
    const base=safeName(cfg.appName || state.projectName), ver=safeName(cfg.version || 'build');
    downloadBlob(new Blob([zipBytes],{type:'application/zip'}),`${base}-${ver}.zip`);
  }

  async function makeAdapter(){
    const signature=await projectSignature();
    return {
      format:'web-app-builder-adapter',version:1,createdAt:new Date().toISOString(),signature,
      config:Object.fromEntries(fields.map(k=>[k,els[k].value.trim()])),
      options:{globalNameSync:$('globalNameSync').checked,autoBuild:$('autoBuild').checked},
      detections:state.detections.map(d=>({field:d.field,path:d.path,current:d.current,before:d.before,after:d.after,label:d.label,enabled:d.enabled})),
      manualRules:state.manualRules.map(r=>({...r}))
    };
  }

  async function applyAdapter(adapter){
    if(!adapter || adapter.format!=='web-app-builder-adapter') throw new Error('Không đúng định dạng adapter.');
    for(const k of fields) if(adapter.config?.[k]!=null) els[k].value=adapter.config[k];
    if(adapter.options){$('globalNameSync').checked=adapter.options.globalNameSync!==false;$('autoBuild').checked=adapter.options.autoBuild!==false;}
    if(Array.isArray(adapter.detections) && state.files.size){
      state.detections=adapter.detections.filter(d=>state.files.has(d.path)).map((d,i)=>({...d,key:`adapter-${i}`}));renderDetections();
    }
    state.manualRules=[];manualRulesEl.innerHTML='';(adapter.manualRules||[]).forEach(addManualRule);
  }

  async function projectSignature(){ return sha256([...state.files.keys()].sort().join('|')); }
  async function saveProfile(){ if(!state.files.size){alert('Nạp source trước.');return;} const a=await makeAdapter();localStorage.setItem('wab-profile-'+a.signature,JSON.stringify(a));alert('Đã lưu profile cho cấu trúc file này trên trình duyệt.'); }
  async function loadProfile(){ if(!state.files.size){alert('Nạp source trước.');return;} const sig=await projectSignature();const raw=localStorage.getItem('wab-profile-'+sig);if(!raw){alert('Chưa có profile đã lưu cho cấu trúc file này.');return;}await applyAdapter(JSON.parse(raw));alert('Đã nạp profile.'); }
  async function exportAdapter(){ const a=await makeAdapter();downloadBlob(new Blob([JSON.stringify(a,null,2)],{type:'application/json'}),`${safeName(els.appName.value||state.projectName)}-builder.adapter.json`); }
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}

  // Minimal ZIP reader/writer: writer uses STORE (method 0); reader supports STORE and DEFLATE.
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

  fileInput.addEventListener('change',e=>loadFiles(e.target.files));folderInput.addEventListener('change',e=>loadFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.remove('drag');}));
  dropZone.addEventListener('drop',e=>loadFiles(e.dataTransfer.files));
  $('clearBtn').onclick=()=>{state.files.clear();state.detections=[];state.manualRules=[];manualRulesEl.innerHTML='';fileListEl.innerHTML='';summaryEl.textContent='Chưa nạp source.';detectionsEl.textContent='Nạp source để bắt đầu quét.';fields.forEach(k=>els[k].value='');};
  $('scanBtn').onclick=scan;$('addRuleBtn').onclick=()=>addManualRule();$('validateBtn').onclick=validate;$('previewBtn').onclick=preview;$('exportBtn').onclick=exportZip;$('closePreviewBtn').onclick=()=>$('previewDialog').close();
  $('saveProfileBtn').onclick=saveProfile;$('loadProfileBtn').onclick=loadProfile;$('exportAdapterBtn').onclick=exportAdapter;
  $('adapterInput').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;await applyAdapter(JSON.parse(await f.text()));alert('Đã nhập adapter.');}catch(err){alert('Adapter lỗi: '+err.message);}});
  els.appName.addEventListener('input',()=>{state.projectName=safeName(els.appName.value||'web-app');});
})();
