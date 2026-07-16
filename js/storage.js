
"use strict";
window.Storage={
 DB_NAME:"hsk-offline-smart-v2",DB_VERSION:1,
 stores:{vocabPacks:"vocabPacks",words:"words",questionPacks:"questionPacks",questions:"questions",wordProgress:"wordProgress",questionProgress:"questionProgress",activities:"activities",settings:"settings"},
 keyPaths:{vocabPacks:"id",words:"id",questionPacks:"id",questions:"id",wordProgress:"wordId",questionProgress:"questionId",activities:"id",settings:"key"},
 async open(){
  if(!("indexedDB"in window)){State.storageMode="localStorage";return null;}
  return new Promise(resolve=>{try{const r=indexedDB.open(this.DB_NAME,this.DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;Object.entries(this.keyPaths).forEach(([n,k])=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:k});});};r.onsuccess=()=>{State.storageMode="indexedDB";resolve(r.result)};r.onerror=()=>{State.storageMode="localStorage";resolve(null)};r.onblocked=()=>{State.storageMode="localStorage";resolve(null)};}catch(e){State.storageMode="localStorage";resolve(null);}});
 },
 localKey(s){return `${this.DB_NAME}:${s}`},
 localRead(s){try{return JSON.parse(localStorage.getItem(this.localKey(s))||"[]")}catch{return[]}},
 localWrite(s,v){localStorage.setItem(this.localKey(s),JSON.stringify(v))},
 tx(s,m,fn){return new Promise((res,rej)=>{const t=State.db.transaction(s,m),st=t.objectStore(s);let r;try{r=fn(st)}catch(e){rej(e);return}t.oncomplete=()=>res(r?.result);t.onerror=()=>rej(t.error||r?.error);});},
 async getAll(s){return State.storageMode==="localStorage"?this.localRead(s):this.tx(s,"readonly",st=>st.getAll())},
 async put(s,v){if(State.storageMode==="localStorage"){const a=this.localRead(s),k=this.keyPaths[s],i=a.findIndex(x=>x[k]===v[k]);if(i>=0)a[i]=v;else a.push(v);this.localWrite(s,a);return}return this.tx(s,"readwrite",st=>st.put(v))},
 async remove(s,id){if(State.storageMode==="localStorage"){const k=this.keyPaths[s];this.localWrite(s,this.localRead(s).filter(x=>x[k]!==id));return}return this.tx(s,"readwrite",st=>st.delete(id))},
 async clear(s){if(State.storageMode==="localStorage"){this.localWrite(s,[]);return}return this.tx(s,"readwrite",st=>st.clear())},
 async replace(s,items){await this.clear(s);for(const x of items)await this.put(s,x)},
 async loadAll(){
  const S=this.stores;
  [State.vocabPacks,State.words,State.questionPacks,State.questions,State.activities]=await Promise.all([this.getAll(S.vocabPacks),this.getAll(S.words),this.getAll(S.questionPacks),this.getAll(S.questions),this.getAll(S.activities)]);
  State.wordProgress=new Map((await this.getAll(S.wordProgress)).map(x=>[x.wordId,x]));
  State.questionProgress=new Map((await this.getAll(S.questionProgress)).map(x=>[x.questionId,x]));
  State.settings=Object.fromEntries((await this.getAll(S.settings)).map(x=>[x.key,x.value]));
 }
};
