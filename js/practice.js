
"use strict";
window.Practice={
 getProgress(id){return State.questionProgress.get(id)||{questionId:id,correct:0,incorrect:0,lastAnswered:0,hidden:false}},
 async saveProgress(p){State.questionProgress.set(p.questionId,p);await Storage.put(Storage.stores.questionProgress,p)},
 activeQuestions(){const ids=new Set(State.questionPacks.filter(p=>p.enabled!==false).map(p=>p.id)),lvl=Settings.currentLevel();return State.questions.filter(q=>ids.has(q.packId)&&!this.getProgress(q.id).hidden&&(lvl==="ALL"||q.level===lvl||(lvl==="HSK7-9"&&["HSK7","HSK8","HSK9","HSK7-9"].includes(q.level))))},
 select(type,count,source,pack){let a=this.activeQuestions();if(pack!=="all")a=a.filter(q=>q.packId===pack);if(type!=="mixed")a=a.filter(q=>q.type===type);if(source==="unseen")a=a.filter(q=>!this.getProgress(q.id).lastAnswered);if(source==="wrong")a=a.filter(q=>this.getProgress(q.id).incorrect>this.getProgress(q.id).correct);if(source==="smart")a.sort((x,y)=>{const a=this.getProgress(x.id),b=this.getProgress(y.id);return((b.incorrect-b.correct)*10+(b.lastAnswered?0:30))-((a.incorrect-a.correct)*10+(a.lastAnswered?0:30))});return Utils.shuffle(a.slice(0,Math.max(count*3,count))).slice(0,count)},
 start(type){Learning.startQuestionSession(this.select(type,Number(Utils.$("practice-count").value||10),"smart","all"))},
 startCustom(){Learning.startQuestionSession(this.select("mixed",Number(Utils.$("practice-count").value),Utils.$("practice-source").value,Utils.$("practice-pack-filter").value))}
};
