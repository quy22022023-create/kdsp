
"use strict";
window.State={
  db:null,storageMode:"indexedDB",
  vocabPacks:[],words:[],questionPacks:[],questions:[],activities:[],
  wordProgress:new Map(),questionProgress:new Map(),settings:{},
  flashQueue:[],flashIndex:0,session:null,pendingImport:null
};
window.DEFAULT_LEVELS=["HSK1","HSK2","HSK3","HSK4","HSK5","HSK6","HSK7-9"];
window.DEFAULT_VOCAB_PACK={
 schema:"hsk-vocabulary-pack",version:2,
 meta:{id:"starter-vocab",name:"Bộ từ mẫu",level:"HSK1-4",description:"Dữ liệu mẫu",language:"zh-VN"},
 vocabulary:[
 {id:"w1",hanzi:"安排",pinyin:"ānpái",meaning:"Sắp xếp, thu xếp",wordType:"động từ",level:"HSK4",topic:"Công việc",example:"我已经安排好了明天的工作。",exampleMeaning:"Tôi đã sắp xếp xong công việc ngày mai.",beginnerNote:"Dùng khi nói sắp xếp thời gian, công việc hoặc kế hoạch.",memoryTip:"安排 = sắp xếp mọi thứ theo thứ tự."},
 {id:"w2",hanzi:"完成",pinyin:"wánchéng",meaning:"Hoàn thành",wordType:"động từ",level:"HSK3",topic:"Công việc",example:"我按时完成了任务。",exampleMeaning:"Tôi đã hoàn thành nhiệm vụ đúng hạn.",beginnerNote:"Thường đi với 任务, 工作, 作业.",memoryTip:"完 = xong, 成 = thành."},
 {id:"w3",hanzi:"高兴",pinyin:"gāoxìng",meaning:"Vui vẻ",wordType:"tính từ",level:"HSK1",topic:"Cảm xúc",example:"见到你我很高兴。",exampleMeaning:"Gặp bạn tôi rất vui.",beginnerNote:"Dùng để nói cảm xúc vui mừng.",memoryTip:"很高兴认识你 = rất vui được làm quen."}
 ]};
window.DEFAULT_QUESTION_PACK={
 schema:"hsk-question-pack",version:2,
 meta:{id:"starter-q",name:"Bộ câu hỏi mẫu",level:"HSK1-4",description:"Dữ liệu mẫu",language:"zh-VN"},
 questions:[
 {id:"q1",type:"fill_blank",level:"HSK4",question:"我已经把明天的工作（___）好了。",options:["安排","结婚","减少","发现"],answer:"安排",explanation:"安排好了 nghĩa là đã sắp xếp xong.",beginnerExplanation:"Cấu trúc 把 + tân ngữ + động từ + 好了 nhấn mạnh việc đã xử lý xong."},
 {id:"q2",type:"multiple_choice",level:"HSK3",question:"“完成” có nghĩa là gì?",options:["Hoàn thành","Giảm bớt","Kiên trì","Ảnh hưởng"],answerIndex:0,explanation:"完成 nghĩa là hoàn thành."},
 {id:"q3",type:"grammar",level:"HSK4",grammarPoint:"虽然……但是……",question:"虽然天气很冷，（___）他还是去跑步了。",options:["但是","因为","所以","如果"],answer:"但是",explanation:"虽然 đi với 但是 để diễn tả mặc dù… nhưng…",beginnerExplanation:"虽然 đứng ở vế đầu, 但是 đứng ở vế sau. Có thể lược 但是 trong khẩu ngữ."},
 {id:"q4",type:"sentence_order",level:"HSK3",question:"Sắp xếp thành câu đúng.",fragments:["我","已经","完成","任务","了"],answer:"我已经完成任务了。",explanation:"Chủ ngữ + 已经 + động từ + tân ngữ + 了."},
 {id:"q5",type:"error_correction",level:"HSK4",question:"他比我很高。",answer:"他比我高。",explanation:"Trong câu 比, trước tính từ thường không dùng 很."},
 {id:"q6",type:"reading",level:"HSK2",title:"Sắp xếp thời gian",passage:"小王每天都安排好自己的学习时间。",translation:"Tiểu Vương mỗi ngày đều sắp xếp tốt thời gian học.",questions:[{question:"小王每天做什么？",options:["安排学习时间","去旅行","买东西","看医生"],answerIndex:0,explanation:"Đoạn văn nói Tiểu Vương sắp xếp thời gian học."}]},
 {id:"q7",type:"writing",level:"HSK4",question:"Viết 4–6 câu về kế hoạch học tiếng Trung.",requiredWords:["计划","坚持","提高"],sampleAnswer:"我制定了一个学习计划。我每天坚持学习，希望提高汉语水平。",explanation:"Dùng đủ từ bắt buộc và viết câu ngắn rõ ràng."}
 ]};
