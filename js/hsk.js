
"use strict";
window.HSK={
 levels:["ALL",...DEFAULT_LEVELS],
 wordsFor(level){return State.words.filter(w=>level==="ALL"||w.level===level||(level==="HSK7-9"&&["HSK7","HSK8","HSK9","HSK7-9"].includes(w.level)))},
 questionsFor(level){return State.questions.filter(q=>level==="ALL"||q.level===level||(level==="HSK7-9"&&["HSK7","HSK8","HSK9","HSK7-9"].includes(q.level)))},
 progress(level){
  const ws=this.wordsFor(level),done=ws.filter(w=>Vocabulary.getProgress(w.id).lastStudied).length;
  return{total:ws.length,done,percent:ws.length?Math.round(done/ws.length*100):0,questions:this.questionsFor(level).length}
 },
 render(){
  const cur=Settings.currentLevel();
  Utils.$("level-grid").innerHTML=this.levels.map(l=>{const p=this.progress(l);return`<article class="level-card ${cur===l?"active":""}"><h3>${l==="ALL"?"Tất cả cấp độ":l}</h3><p>${p.total} từ · ${p.questions} câu</p><div class="progress-track"><div class="progress-bar" style="width:${p.percent}%"></div></div><p>${p.done}/${p.total} từ đã học</p><button onclick="Settings.chooseLevel('${l}')">${cur===l?"Đang chọn":"Chọn cấp này"}</button></article>`}).join("");
  const p=this.progress(cur);Utils.$("current-level-card").innerHTML=`<h3>${cur==="ALL"?"Tất cả cấp độ":cur}</h3><p>${p.total} từ · ${p.questions} câu hỏi</p><div class="progress-track"><div class="progress-bar" style="width:${p.percent}%"></div></div><p>${p.percent}% từ đã học</p>`;
 }
};
