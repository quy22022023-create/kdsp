
"use strict";
window.Settings={
 async set(k,v){State.settings[k]=v;await Storage.put(Storage.stores.settings,{key:k,value:v})},
 async saveBeginnerMode(){await this.set("beginnerMode",Utils.$("beginner-mode").checked);Vocabulary.renderFlashcard()},
 apply(){document.body.classList.toggle("dark",State.settings.theme==="dark");Utils.$("beginner-mode").checked=State.settings.beginnerMode!==false},
 currentLevel(){return State.settings.currentLevel||"ALL"},
 async chooseLevel(level){await this.set("currentLevel",level);HSK.render();App.refresh();Vocabulary.resetFlashcards();Utils.toast(level==="ALL"?"Đang học tất cả cấp độ":`Đã chọn ${level}`)}
};
