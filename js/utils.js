
"use strict";
window.Utils={
 $:id=>document.getElementById(id),
 uid:p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
 esc:v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])),
 shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b},
 day(t=Date.now()){const d=new Date(t);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`},
 toast(m){const t=this.$("toast");t.textContent=m;t.classList.add("show");clearTimeout(this.toast.timer);this.toast.timer=setTimeout(()=>t.classList.remove("show"),2500)},
 download(name,data){const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
};
