
"use strict";
window.App={
 async init(){
  State.db=await Storage.open();await Storage.loadAll();
  if(!State.vocabPacks.length){const p=ImportExport.parseVocab(DEFAULT_VOCAB_PACK);await Storage.put(Storage.stores.vocabPacks,p.pack);for(const x of p.items)await Storage.put(Storage.stores.words,x)}
  if(!State.questionPacks.length){const p=ImportExport.parseQ(DEFAULT_QUESTION_PACK);await Storage.put(Storage.stores.questionPacks,p.pack);for(const x of p.items)await Storage.put(Storage.stores.questions,x)}
  await Storage.loadAll();Settings.apply();this.refresh();Vocabulary.resetFlashcards();Utils.toast(State.storageMode==="localStorage"?"Đang dùng chế độ tương thích.":"Ứng dụng đã sẵn sàng.")
 },
 showScreen(id,btn){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));const t=Utils.$(`screen-${id}`);if(!t)return Utils.toast(`Không tìm thấy màn hình ${id}`);t.classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.screen===id));if(btn)btn.classList.add("active");Utils.$("page-title").textContent={home:"Hôm nay",levels:"Phân cấp HSK",vocabulary:"Học từ",practice:"Luyện tập",data:"Kho dữ liệu",statistics:"Thống kê",session:"Buổi học"}[id]||"HSK Offline Smart";if(id==="statistics")Statistics.render();if(id==="levels")HSK.render();window.scrollTo(0,0)},
 refresh(){
  const lvl=Settings.currentLevel(),ws=Vocabulary.activeWords(),qs=Practice.activeQuestions(),due=ws.filter(w=>Vocabulary.getProgress(w.id).dueAt<=Date.now()).length,newW=ws.filter(w=>!Vocabulary.getProgress(w.id).lastStudied).length,unseen=qs.filter(q=>!Practice.getProgress(q.id).lastAnswered).length;
  const wp=[...State.wordProgress.values()],qp=[...State.questionProgress.values()],c=wp.reduce((s,x)=>s+x.correct,0)+qp.reduce((s,x)=>s+x.correct,0),w=wp.reduce((s,x)=>s+x.incorrect,0)+qp.reduce((s,x)=>s+x.incorrect,0),acc=c+w?Math.round(c/(c+w)*100):0,done=State.activities.filter(a=>Utils.day(a.timestamp)===Utils.day()).length;
  Utils.$("stat-due").textContent=due;Utils.$("stat-new").textContent=newW;Utils.$("stat-questions").textContent=unseen;Utils.$("stat-accuracy").textContent=`${acc}%`;Utils.$("home-summary").textContent=`${lvl==="ALL"?"Tất cả cấp độ":lvl}: ${due} từ cần ôn và ${unseen} câu chưa làm.`;Utils.$("daily-progress-label").textContent=`${done}/20`;Utils.$("daily-progress-bar").style.width=`${Math.min(100,done/20*100)}%`;Utils.$("daily-plan").innerHTML=`<div>Ôn tối đa <strong>${Math.min(10,due)}</strong> từ</div><div>Học <strong>${Math.min(5,newW)}</strong> từ mới</div><div>Làm <strong>${Math.min(10,unseen||10)}</strong> câu hỏi</div>`;
  Utils.$("vocab-pack-filter").innerHTML='<option value="all">Tất cả bộ từ</option>'+State.vocabPacks.map(p=>`<option value="${p.id}">${Utils.esc(p.name)}</option>`).join("");Utils.$("practice-pack-filter").innerHTML='<option value="all">Tất cả bộ đang bật</option>'+State.questionPacks.filter(p=>p.enabled!==false).map(p=>`<option value="${p.id}">${Utils.esc(p.name)}</option>`).join("");
  HSK.render();Vocabulary.renderList();ImportExport.renderPacks();Statistics.render()
 },
 async toggleTheme(){await Settings.set("theme",document.body.classList.contains("dark")?"light":"dark");Settings.apply()}
};
document.addEventListener("DOMContentLoaded",()=>App.init().catch(e=>{console.error(e);Utils.toast(`Lỗi khởi tạo: ${e.message}`)}));
