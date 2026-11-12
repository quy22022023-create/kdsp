/**
 * TỆP DỮ LIỆU TỪ VỰNG TRUNG TÂM (N5 -> N3)
 * Xuất tự động từ ứng dụng Flashcards (231 từ vựng)
 */

var VOCAB_DATA = [
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "かいぎ",
    "kanji": "会議",
    "romaji": "kaigi",
    "vi": "Cuộc họp",
    "mnemonic": "Chữ Hội (会 - gặp gỡ) + chữ Nghị (議 - bàn bạc) -> Gặp gỡ để bàn bạc."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "じむしょ",
    "kanji": "事務所",
    "romaji": "jimusho",
    "vi": "Văn phòng làm việc",
    "mnemonic": "Sự (事) + Vụ (務) + Sở (所) -> Cơ sở giải quyết các sự vụ."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "しゃちょう",
    "kanji": "社長",
    "romaji": "shachou",
    "vi": "Giám đốc",
    "mnemonic": "Xã (社 - công ty) + Trưởng (長 - đứng đầu) -> Người đứng đầu công ty."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "あいさつ",
    "kanji": "挨拶",
    "romaji": "aisatsu",
    "vi": "Chào hỏi",
    "mnemonic": "Cả 2 chữ đều có bộ Thủ (扌 - tay) -> Đưa tay ra chào hỏi xã giao."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "ざんぎょう",
    "kanji": "残業",
    "romaji": "zangyou",
    "vi": "Làm thêm giờ",
    "mnemonic": "Tàn (残 - còn sót lại) + Nghiệp (業 - công việc) -> Xử lý nốt công việc còn sót."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "しゅっちょう",
    "kanji": "出張",
    "romaji": "shucchou",
    "vi": "Đi công tác",
    "mnemonic": "Xuất (出 - đi ra ngoài) + Trương (張 - kéo dài/phân công) -> Được cử đi ra ngoài làm việc."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "コピー",
    "kanji": "",
    "romaji": "kopii",
    "vi": "Photocopy, sao chép",
    "mnemonic": "Từ mượn tiếng Anh: Copy."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "れんらく",
    "kanji": "連絡",
    "romaji": "renraku",
    "vi": "Liên lạc",
    "mnemonic": "Liên (連 - kết nối) + Lạc (絡 - quấn quýt/mạng lưới) -> Giữ kết nối thông tin."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "そうだん",
    "kanji": "相談",
    "romaji": "soudan",
    "vi": "Thảo luận, bàn bạc",
    "mnemonic": "Tương (相 - cùng nhau) + Đàm (談 - nói chuyện) -> Cùng nhau nói chuyện để giải quyết."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "じゅんび",
    "kanji": "準備",
    "romaji": "junbi",
    "vi": "Chuẩn bị",
    "mnemonic": "Chuẩn (準 - tiêu chuẩn) + Bị (備 - phòng bị) -> Sẵn sàng mọi thứ đạt chuẩn."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "よてい",
    "kanji": "予定",
    "romaji": "yotei",
    "vi": "Dự định, lịch trình",
    "mnemonic": "Dự (予 - trước) + Định (定 - quyết định) -> Những việc đã được quyết định từ trước."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "りゆう",
    "kanji": "理由",
    "romaji": "riyuu",
    "vi": "Lý do",
    "mnemonic": "Lý (理 - logic) + Do (由 - nguyên do) -> Nguyên nhân theo logic."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "いけん",
    "kanji": "意見",
    "romaji": "iken",
    "vi": "Ý kiến",
    "mnemonic": "Ý (意 - suy nghĩ) + Kiến (見 - góc nhìn) -> Góc nhìn và suy nghĩ của bản thân."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "きそく",
    "kanji": "規則",
    "romaji": "kisoku",
    "vi": "Quy tắc, kỷ luật",
    "mnemonic": "Quy (規 - thước đo) + Tắc (則 - phép tắc) -> Những luật lệ phải tuân theo."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "けいけん",
    "kanji": "経験",
    "romaji": "keiken",
    "vi": "Kinh nghiệm",
    "mnemonic": "Kinh (経 - trải qua) + Nghiệm (験 - kiểm chứng) -> Trải qua và rút ra bài học."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "しっぱい",
    "kanji": "失敗",
    "romaji": "shippai",
    "vi": "Thất bại",
    "mnemonic": "Thất (失 - mất mát) + Bại (敗 - thua) -> Làm hỏng việc, thất bại."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "せいこう",
    "kanji": "成功",
    "romaji": "seikou",
    "vi": "Thành công",
    "mnemonic": "Thành (成 - hoàn thành) + Công (功 - công lao) -> Đạt được kết quả tốt."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "しつもん",
    "kanji": "質問",
    "romaji": "shitsumon",
    "vi": "Câu hỏi",
    "mnemonic": "Chất (質 - hỏi han) + Môn (問 - hỏi) -> Đưa ra thắc mắc."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "こたえます",
    "kanji": "答えます",
    "romaji": "kotaemasu",
    "vi": "Trả lời",
    "mnemonic": "Bộ Trúc (竹) ở trên chữ Hợp (合) -> Lời đáp hợp lý như trúc ghép lại."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "はたらきます",
    "kanji": "働きます",
    "romaji": "hatarakimasu",
    "vi": "Làm việc",
    "mnemonic": "Bộ Nhân (亻- người) + chữ Động (動 - di chuyển) -> Người vận động để làm việc."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "やすみます",
    "kanji": "休みます",
    "romaji": "yasumimasu",
    "vi": "Nghỉ ngơi, xin nghỉ",
    "mnemonic": "Bộ Nhân (亻- người) đứng cạnh cái Cây (木) -> Người dựa vào cây để nghỉ ngơi."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "おくれます",
    "kanji": "遅れます",
    "romaji": "okuremasu",
    "vi": "Đến muộn, chậm trễ",
    "mnemonic": "Bộ Xước (辶 - di chuyển) + chữ Tê (犀 - con tê giác) -> Tê giác di chuyển chậm chạp nên đến muộn."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "まにあいます",
    "kanji": "間に合います",
    "romaji": "maniaimasu",
    "vi": "Kịp giờ",
    "mnemonic": "Gian (間 - thời gian) + Hợp (合 - phù hợp) -> Khớp với thời gian quy định."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "しらせます",
    "kanji": "知らせます",
    "romaji": "shirasemasu",
    "vi": "Thông báo",
    "mnemonic": "Chữ Tri (知 - biết) -> Làm cho người khác biết (thể sai khiến)."
  },
  {
    "level": "N4",
    "topic": "Công việc & Giao tiếp công sở",
    "jp": "しらべます",
    "kanji": "調べます",
    "romaji": "shirabemasu",
    "vi": "Điều tra, tìm hiểu",
    "mnemonic": "Chữ Điều (調 - bộ Ngôn 言 + chữ Chu 周) -> Dùng lời nói đi vòng quanh để điều tra."
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "います",
    "kanji": "居ます",
    "romaji": "imasu",
    "vi": "Có, ở (người, động vật)",
    "mnemonic": "Chữ Cư (居 - thi thể 古 ngồi xổm phơi thây thi 尸) -> Cư trú, ở. [N4/N3: Lên cấp cao thường dùng chữ Hán 居 để chỉ chỗ ở]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "あります",
    "kanji": "有ります",
    "romaji": "arimasu",
    "vi": "Có, ở (đồ vật, cây cối)",
    "mnemonic": "Chữ Hữu (有 - tay ナ cầm nhục 肉) -> Có trong tay. [N4/N3: Mở rộng thành 在ります (tồn tại vật lý) hoặc 有ります (sở hữu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "いきます",
    "kanji": "行きます",
    "romaji": "ikimasu",
    "vi": "Đi",
    "mnemonic": "Chữ Hành (行 - hình ngã tư đường) -> Đi trên đường. [N4/N3: Mở rộng nghĩa 'tổ chức sự kiện' (行う) hoặc ghép danh động từ]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "きます",
    "kanji": "来ます",
    "romaji": "kimasu",
    "vi": "Đến",
    "mnemonic": "Chữ Lai (来 - cây lúa trĩu hạt mang về) -> Mang đến, đi đến. [N4/N3: Dùng trong ngữ pháp ~te kimasu (làm gì đó rồi quay lại/tiến đến)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "かえります",
    "kanji": "帰ります",
    "romaji": "kaerimasu",
    "vi": "Về",
    "mnemonic": "Chữ Quy (帰 - cái chổi ⺕ quét dọn) -> Trở về nhà. [N4/N3: Dùng chỉ sự trở về quê hương, đất nước, nơi thuộc về mình]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "たべます",
    "kanji": "食べます",
    "romaji": "tabemasu",
    "vi": "Ăn",
    "mnemonic": "Bộ Thực (食 - hộp cơm có nắp) -> Ăn uống. [N4/N3: Xuất hiện trong các từ ghép âm On như 食事 (shokuji - bữa ăn)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "のみます",
    "kanji": "飲みます",
    "romaji": "nomimasu",
    "vi": "Uống",
    "mnemonic": "Chữ Ẩm (飲 - Thực 食 + Khiếm 欠 há miệng) -> Há miệng uống nước. [N4/N3: Ẩm thực (飲食 - inshoku)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "みます",
    "kanji": "見ます",
    "romaji": "mimasu",
    "vi": "Xem, nhìn",
    "mnemonic": "Chữ Kiến (見 - mắt 目 trên đôi chân 儿) -> Mắt nhìn. [N4/N3: Nâng cấp Kanji thành 診ます (khám bệnh) hoặc 観ます (xem phim)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "ききます",
    "kanji": "聞きます",
    "romaji": "kikimasu",
    "vi": "Nghe, hỏi",
    "mnemonic": "Chữ Văn (聞 - tai 耳 ở giữa cửa 門) -> Ghé tai nghe ngóng. [N4/N3: Nâng cấp Kanji thành 聴きます (nghe nhạc/lắng nghe cẩn thận)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "かきます",
    "kanji": "書きます",
    "romaji": "kakimasu",
    "vi": "Viết",
    "mnemonic": "Chữ Thư (書 - tay cầm bút viết lên giấy) -> Viết chữ. [N4/N3: Cùng cách đọc kakimasu nhưng đổi Kanji thành 描きます (vẽ tranh)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "よみます",
    "kanji": "読みます",
    "romaji": "yomimasu",
    "vi": "Đọc",
    "mnemonic": "Chữ Độc (読 - Ngôn 言 + Mại 売) -> Đọc lời văn rao bán. [N4/N3: Dùng trong từ ghép Độc giả (読者 - dokusha)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "はなします",
    "kanji": "話します",
    "romaji": "hanashimasu",
    "vi": "Nói chuyện",
    "mnemonic": "Chữ Thoại (話 - Ngôn 言 + Thiệt 舌 cái lưỡi) -> Lưỡi uốn lượn nói chuyện. [N4/N3: Mở rộng thành Hội thoại (会話 - kaiwa)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "かいます",
    "kanji": "買います",
    "romaji": "kaimasu",
    "vi": "Mua",
    "mnemonic": "Chữ Mãi (買 - lưới 罒 bắt sò 貝 tiền tệ) -> Dùng tiền mua đồ. [N4/N3: Xuất hiện trong Mua sắm (買い物 - kaimono)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "おきます",
    "kanji": "起きます",
    "romaji": "okimasu",
    "vi": "Thức dậy",
    "mnemonic": "Chữ Khởi (起 - Tẩu 走 chạy + Tỷ 己 bản thân) -> Bản thân bật dậy. [N4/N3: Cùng cách đọc okimasu có chữ Trí (置きます - đặt, để)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "ねます",
    "kanji": "寝ます",
    "romaji": "nemasu",
    "vi": "Ngủ",
    "mnemonic": "Chữ Tẩm (寝 - Miên 宀 mái nhà + chữ ⺕) -> Nằm ngủ trong nhà. [N4/N3: Mở rộng trong từ Ngủ quên (寝坊する - nebou suru)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "あそびます",
    "kanji": "遊びます",
    "romaji": "asobimasu",
    "vi": "Chơi",
    "mnemonic": "Chữ Du (遊 - Xước 辶 + Phương 方 + Tử 子) -> Trẻ con đi muôn phương chơi. [N4/N3: Dùng trong Khu vui chơi (遊園地 - yuuenchi)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "あいます",
    "kanji": "会います",
    "romaji": "aimasu",
    "vi": "Gặp gỡ",
    "mnemonic": "Chữ Hội (会 - Người Nhân 人 tập hợp lại) -> Gặp gỡ. [N4/N3: Nâng cấp Kanji thành 遭います (gặp nạn) hoặc 合います (phù hợp)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "きります",
    "kanji": "切ります",
    "romaji": "kirimasu",
    "vi": "Cắt",
    "mnemonic": "Chữ Thiết (切 - Số Bảy 七 con dao 刀) -> Dùng dao cắt. [N4/N3: Mở rộng nghĩa ngắt điện thoại, hết hạn, hoặc Cẩn thận (大切 - taisetsu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "わかります",
    "kanji": "分かります",
    "romaji": "wakarimasu",
    "vi": "Hiểu, biết",
    "mnemonic": "Chữ Phân (分 - Bát 八 chia bằng dao 刀) -> Chia nhỏ ra để hiểu cặn kẽ. [N4/N3: Còn mang nghĩa phân chia, chia tay (別れる - wakareru)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "おしえます",
    "kanji": "教えます",
    "romaji": "oshiemasu",
    "vi": "Dạy",
    "mnemonic": "Chữ Giáo (教 - Hào 爻 + Tử 子 + Phập 攴) -> Cầm roi dạy trẻ. [N4/N3: Mở rộng nghĩa là 'chỉ cho biết, thông báo' (電話番号を教える)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "ならいます",
    "kanji": "習います",
    "romaji": "naraimasu",
    "vi": "Học (từ ai đó)",
    "mnemonic": "Chữ Tập (習 - Vũ 羽 lông chim + Bạch 白) -> Chim non luyện tập cất cánh bay. [N4/N3: Nằm trong từ ghép Ôn tập (復習 - fukushuu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "かします",
    "kanji": "貸します",
    "romaji": "kashimasu",
    "vi": "Cho mượn, cho vay",
    "mnemonic": "Chữ Thải (貸 - Đại 代 thay thế + Bối 貝 tiền) -> Đưa tiền/đồ thay thế. [N4/N3: Nằm trong cụm Cho thuê (貸し出し - kashidashi)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "かります",
    "kanji": "借ります",
    "romaji": "karimasu",
    "vi": "Mượn, vay",
    "mnemonic": "Chữ Tá (借 - Nhân 亻 + Tích 昔 ngày xưa) -> Vay mượn từ ngày xưa. [N4/N3: Dùng trong từ Tiền vay nợ (借金 - shakkin)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "まちます",
    "kanji": "待ちます",
    "romaji": "machimasu",
    "vi": "Đợi, chờ",
    "mnemonic": "Chữ Đãi (待 - Xích 彳 bước đi + Tự 寺 chùa) -> Bước đến chùa chờ. [N4/N3: Dùng trong Phòng chờ (待合室 - machiaishitsu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "もちます",
    "kanji": "持ちます",
    "romaji": "mochimasu",
    "vi": "Cầm, mang, sở hữu",
    "mnemonic": "Chữ Trì (持 - Thủ 扌 tay + Tự 寺 chùa) -> Tay mang hương đi chùa. [N4/N3: Mở rộng nghĩa 'bảo quản', hoặc Người giàu (お金持ち - okanemochi)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "とります",
    "kanji": "撮ります",
    "romaji": "torimasu",
    "vi": "Chụp (ảnh)",
    "mnemonic": "Chữ Toát (撮 - Thủ 扌 + Tối 最 nhất) -> Dùng tay túm lấy khoảnh khắc. [N4/N3: Cùng âm đọc có 取ります (Lấy), 盗ります (Ăn cắp)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "つくります",
    "kanji": "作ります",
    "romaji": "tsukurimasu",
    "vi": "Làm, chế tạo",
    "mnemonic": "Chữ Tác (作 - Nhân 亻 người + Trác 乍) -> Người đang làm việc. [N4/N3: Đổi Kanji thành 造ります (đóng tàu/nhà), 創ります (sáng tác)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "つかいます",
    "kanji": "使います",
    "romaji": "tsukaimasu",
    "vi": "Dùng, sử dụng",
    "mnemonic": "Chữ Sử (使 - Nhân 亻 + Lại 吏 viên chức) -> Sai phái, sử dụng người. [N4/N3: Xuất hiện trong Cách sử dụng (使い方 - tsukaikata)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "よびます",
    "kanji": "呼びます",
    "romaji": "yobimasu",
    "vi": "Gọi",
    "mnemonic": "Chữ Hô (呼 - Khẩu 口 miệng + Hồ 乎) -> Dùng miệng để hô hoán, gọi. [N4/N3: Nằm trong từ Hô hấp (呼吸 - kokyuu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "およぎます",
    "kanji": "泳ぎます",
    "romaji": "oyogimasu",
    "vi": "Bơi",
    "mnemonic": "Chữ Vịnh (泳 - Thủy 氵 nước + Vĩnh 永 mãi mãi) -> Vùng vẫy mãi trong nước. [N4/N3: Môn Bơi lội (水泳 - suiei)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "だします",
    "kanji": "出します",
    "romaji": "dashimasu",
    "vi": "Lấy ra, nộp",
    "mnemonic": "Chữ Xuất (出 - Hai ngọn núi 山 chồng lên nhau) -> Đi ra khỏi núi. [N4/N3: Trở thành ngữ pháp V-ます bỏ ます + 出す (bắt đầu làm gì đột ngột)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "はいります",
    "kanji": "入ります",
    "romaji": "hairimasu",
    "vi": "Vào, bước vào",
    "mnemonic": "Chữ Nhập (入 - Hình mũi tên đi vào) -> Bước vào trong. [N4/N3: Nằm trong từ ghép Nhập học (入学 - nyuugaku)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "jp": "けします",
    "kanji": "消します",
    "romaji": "keshimasu",
    "vi": "Tắt (điện), xóa",
    "mnemonic": "Chữ Tiêu (消 - Thủy 氵 + Tiếu 肖) -> Dùng nước dập tắt lửa. [N4/N3: Nằm trong Cục tẩy (消しゴム - keshigomu) hoặc Biến mất (消える - kieru)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "うたいます",
    "kanji": "歌います",
    "romaji": "utaimasu",
    "vi": "Hát",
    "mnemonic": "Chữ Ca (歌 - Khả 可 + Khiếm 欠) -> Há miệng để ca hát. [N4/N3: Nằm trong từ ghép Ca sĩ (歌手 - kashu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "ひきます",
    "kanji": "弾きます",
    "romaji": "hikimasu",
    "vi": "Chơi (nhạc cụ), gảy đàn",
    "mnemonic": "Chữ Đàn (弾 - Cung 弓 + Đơn 単) -> Kéo dây cung đàn. [N4/N3: Nghĩa mở rộng là văng ra, hoặc viên đạn (弾 - tama)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "できます",
    "kanji": "出来ます",
    "romaji": "dekimasu",
    "vi": "Có thể, hoàn thành",
    "mnemonic": "Chữ Xuất (出) + Lai (来) -> Việc được làm ra, tạo ra thành công. [N4/N3: Thường dùng với nghĩa hoàn thành việc gì đó]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "あらいます",
    "kanji": "洗います",
    "romaji": "araimasu",
    "vi": "Rửa",
    "mnemonic": "Chữ Tẩy (洗 - Thủy 氵 + Tiên 先) -> Phải dùng nước rửa trước tiên. [N4/N3: Nằm trong từ Máy giặt (洗濯機 - sentakuki)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "あるきます",
    "kanji": "歩きます",
    "romaji": "arukimasu",
    "vi": "Đi bộ",
    "mnemonic": "Chữ Bộ (歩 - Chỉ 止 dừng lại + Thiếu 少 một chút) -> Đi bộ rồi thỉnh thoảng dừng lại. [N4/N3: Lối đi bộ (歩道 - hodou)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "いそぎます",
    "kanji": "急ぎます",
    "romaji": "isogimasu",
    "vi": "Vội vàng, khẩn trương",
    "mnemonic": "Chữ Cấp (急 - Ký 彐 bàn tay + Tâm 心 trái tim) -> Trong lòng gấp gáp. [N4/N3: Tàu tốc hành (急行 - kyuukou)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "おもいます",
    "kanji": "思います",
    "romaji": "omoimasu",
    "vi": "Nghĩ, suy nghĩ",
    "mnemonic": "Chữ Tư (思 - Điền 田 ruộng + Tâm 心 trái tim) -> Lòng hướng về ruộng đất mà trăn trở. [N4/N3: Kỷ niệm (思い出 - omoide)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "おぼえます",
    "kanji": "覚えます",
    "romaji": "oboemasu",
    "vi": "Nhớ, ghi nhớ",
    "mnemonic": "Chữ Giác (覚 - Học 馤 + Kiến 見 nhìn) -> Phải nhìn nhiều lần mới giác ngộ, ghi nhớ. [N4/N3: Mở rộng nghĩa Tỉnh giấc (目を覚ます)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "わすれます",
    "kanji": "忘れます",
    "romaji": "wasuremasu",
    "vi": "Quên",
    "mnemonic": "Chữ Vong (忘 - Vong 亡 mất + Tâm 心 trái tim) -> Trái tim để mất đi ký ức. [N4/N3: Đồ bỏ quên (忘れ物 - wasuremono)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "なくします",
    "kanji": "無くします",
    "romaji": "nakushimasu",
    "vi": "Đánh mất",
    "mnemonic": "Chữ Vô (無 - Bộ Hỏa 灬 ngọn lửa ở dưới) -> Bị thiêu rụi trở về số 0, đánh mất. [N4/N3: Nếu dùng chữ Thất 失 thì là 失くす]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "はらいます",
    "kanji": "払います",
    "romaji": "haraimasu",
    "vi": "Trả tiền, thanh toán",
    "mnemonic": "Chữ Phất (払 - Thủ 扌 tay + Khư 厶) -> Đưa tay ra phủi tiền để thanh toán. [N4/N3: Sự thanh toán (支払い - shiharai)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "ぬぎます",
    "kanji": "脱ぎます",
    "romaji": "nugimasu",
    "vi": "Cởi (quần áo, giày)",
    "mnemonic": "Chữ Thoát (脱 - Nhục 月 thịt + Đoái 兌) -> Thoát y, cởi lớp áo ngoài. [N4/N3: Thoát hiểm, trốn thoát (脱出 - dasshutsu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "きます",
    "kanji": "着ます",
    "romaji": "kimasu",
    "vi": "Mặc (áo, từ thắt lưng trở lên)",
    "mnemonic": "Chữ Trước (着 - Dương 羊 con cừu + Mục 目) -> Mặc áo lông cừu che kín mắt. [N4/N3: Đồ lót (下着 - shitagi) hoặc Đến nơi (到着)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "はきます",
    "kanji": "履きます",
    "romaji": "hakimasu",
    "vi": "Mặc, xỏ (quần, váy, giày)",
    "mnemonic": "Chữ Lý (履 - Thi 尸 + Phục 復) -> Xỏ giày để đi lại. [N4/N3: Sơ yếu lý lịch (履歴書 - rirekisho)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "かぶります",
    "kanji": "被ります",
    "romaji": "kaburimasu",
    "vi": "Đội (mũ)",
    "mnemonic": "Chữ Bị (被 - Y 衤 quần áo + Bì 皮 da) -> Đội mũ da che đầu. [N4/N3: Nghĩa mở rộng là gánh chịu thiệt hại (被害 - higai)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "かけます",
    "kanji": "掛けます",
    "romaji": "kakemasu",
    "vi": "Đeo (kính), gọi (điện thoại)",
    "mnemonic": "Chữ Quải (掛 - Thủ 扌 tay + Quái 卦) -> Dùng tay treo lên, móc lên. [N4/N3: Động từ đa nghĩa: treo áo, đắp chăn, tốn thời gian]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "しります",
    "kanji": "知ります",
    "romaji": "shirimasu",
    "vi": "Biết",
    "mnemonic": "Chữ Tri (知 - Thỉ 矢 mũi tên + Khẩu 口 miệng) -> Biết rõ nên nói nhanh như tên bắn. [N4/N3: Thông báo (お知らせ - oshirase)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "すみます",
    "kanji": "住みます",
    "romaji": "sumimasu",
    "vi": "Sống, cư trú",
    "mnemonic": "Chữ Trụ (住 - Nhân 亻 người + Chủ 主 ông chủ) -> Người làm chủ nơi mình sống. [N4/N3: Địa chỉ (住所 - juusho)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "つとめます",
    "kanji": "勤めます",
    "romaji": "tsutomemasu",
    "vi": "Làm việc cho (công ty)",
    "mnemonic": "Chữ Cần (勤 - Cẩn 堇 + Lực 力 sức mạnh) -> Dùng sức làm việc chuyên cần. [N4/N3: Sự đi làm (通勤 - tsuukin)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "けっこんします",
    "kanji": "結婚します",
    "romaji": "kekkonshimasu",
    "vi": "Kết hôn",
    "mnemonic": "Kết (Mịch 糸 sợi chỉ buộc) + Hôn (Nữ 女 lấy người họ 氏 khác) -> Lễ kết hôn. [N4/N3: Lễ cưới (結婚式 - kekkonshiki)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "さんぽします",
    "kanji": "散歩します",
    "romaji": "sanposhimasu",
    "vi": "Đi dạo",
    "mnemonic": "Chữ Tản (散 - tản ra) + Bộ (歩 - đi bộ) -> Đi dạo thư giãn gân cốt. [N4/N3: Thường đi với trợ từ を (公園を散歩する)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "かいものします",
    "kanji": "買い物します",
    "romaji": "kaimonoshimasu",
    "vi": "Mua sắm",
    "mnemonic": "Mãi (買 - mua bằng tiền) + Vật (物 - đồ vật) -> Mua sắm đồ đạc. [N4/N3: Cụm từ rất phổ biến trong hội thoại mua bán]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "べんきょうします",
    "kanji": "勉強します",
    "romaji": "benkyoushimasu",
    "vi": "Học tập",
    "mnemonic": "Miễn (勉 - cố gắng) + Cường (強 - mạnh) -> Ép bản thân cố gắng học hỏi. [N4/N3: Ở vùng Kansai đôi khi mang nghĩa giảm giá]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "そうじします",
    "kanji": "掃除します",
    "romaji": "soujishimasu",
    "vi": "Dọn dẹp, vệ sinh",
    "mnemonic": "Tảo (掃 - tay cầm chổi quét) + Trừ (除 - dọn bỏ đi) -> Quét dọn. [N4/N3: Máy hút bụi (掃除機 - soujiki)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "せんたくします",
    "kanji": "洗濯します",
    "romaji": "sentakushimasu",
    "vi": "Giặt giũ",
    "mnemonic": "Tẩy (洗 - rửa bằng nước) + Trạc (濯 - giặt rũ) -> Đều có bộ Thủy, liên quan đến giặt. [N4/N3: Đồ mang đi giặt (洗濯物)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "れんしゅうします",
    "kanji": "練習します",
    "romaji": "renshuushimasu",
    "vi": "Luyện tập, thực hành",
    "mnemonic": "Luyện (練 - nhào nặn) + Tập (習 - học bay) -> Làm đi làm lại cho quen. [N4/N3: Bài tập rèn luyện (練習問題 - renshuumondai)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "うんてんします",
    "kanji": "運転します",
    "romaji": "untenshimasu",
    "vi": "Lái xe",
    "mnemonic": "Vận (運 - chuyển động) + Chuyển (転 - xe lăn bánh) -> Điều khiển xe chạy. [N4/N3: Tài xế (運転手 - untenshu)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "よやくします",
    "kanji": "予約します",
    "romaji": "yoyakushimasu",
    "vi": "Đặt trước, hẹn trước",
    "mnemonic": "Dự (予 - làm trước) + Ước (約 - lời hứa) -> Hứa trước một việc gì đó. [N4/N3: Dùng để đặt bàn nhà hàng, vé máy bay]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "けんがくします",
    "kanji": "見学します",
    "romaji": "kengakushimasu",
    "vi": "Tham quan với mục đích học tập",
    "mnemonic": "Kiến (見 - nhìn) + Học (学 - học) -> Đi xem tận mắt để học hỏi. [N4/N3: Các chuyến đi thực tế của học sinh sinh viên]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "あけます",
    "kanji": "開けます",
    "romaji": "akemasu",
    "vi": "Mở (cửa, hộp)",
    "mnemonic": "Chữ Khai (開 - Môn 門 cái cửa + Kiên 幵 hai tay) -> Dùng hai tay mở rộng cửa. [N4/N3: Tự động từ là 開く (aku), Bắt đầu (開始 - kaishi)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "しめます",
    "kanji": "閉めます",
    "romaji": "shimemasu",
    "vi": "Đóng (cửa)",
    "mnemonic": "Chữ Bế (閉 - Môn 門 cửa + Tài 才 thanh gỗ) -> Dùng thanh gỗ chắn ngang đóng cửa lại. [N4/N3: Tự động từ là 閉まる (shimaru)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "つけます",
    "kanji": "点けます",
    "romaji": "tsukemasu",
    "vi": "Bật (điện, máy điều hòa)",
    "mnemonic": "Chữ Điểm (点 - Bộ Hỏa 灬 ở dưới) -> Châm lửa, bật đèn sáng lên. [N4/N3: Thường viết bằng Hiragana, có cụm Chú ý (気を付ける)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "とめます",
    "kanji": "止めます",
    "romaji": "tomemasu",
    "vi": "Dừng (xe), đỗ (xe)",
    "mnemonic": "Chữ Chỉ (止 - hình ảnh bàn chân đứng lại) -> Làm cho xe dừng lại. [N4/N3: Tự động từ 止まる (tomaru), Cấm đoán (禁止 - kinshi)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "まがります",
    "kanji": "曲がります",
    "romaji": "magarimasu",
    "vi": "Rẽ, quẹo",
    "mnemonic": "Chữ Khúc (曲 - hình đường cong nét vẽ) -> Bẻ cong hướng đi, rẽ trái/phải. [N4/N3: Ngoài ra mang nghĩa Bài hát (曲 - kyoku)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi (Phần 2)",
    "jp": "ふります",
    "kanji": "降ります",
    "romaji": "furimasu",
    "vi": "Rơi (mưa, tuyết)",
    "mnemonic": "Chữ Giáng (降 - Phụ 阝 đồi núi) -> Nước tuyết từ trên trời giáng xuống. [N4/N3: Cùng chữ Kanji có cách đọc 降ります (orimasu - xuống xe)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "おおきい",
    "kanji": "大きい",
    "romaji": "ookii",
    "vi": "To, lớn",
    "mnemonic": "Chữ Đại (大 - người dang rộng hai tay hai chân) -> Rất to lớn. [N4/N3: Thường xuất hiện trong Đại học (大学 - daigaku)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "ちいさい",
    "kanji": "小さい",
    "romaji": "chiisai",
    "vi": "Nhỏ, bé",
    "mnemonic": "Chữ Tiểu (小 - một vật bị chia nhỏ làm đôi) -> Nhỏ bé. [N4/N3: Xuất hiện trong Tiểu thuyết (小説 - shousetsu)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あたらしい",
    "kanji": "新しい",
    "romaji": "atarashii",
    "vi": "Mới",
    "mnemonic": "Chữ Tân (新 - dùng rìu 斤 đẽo cây 木) -> Đẽo cây làm đồ mới. [N4/N3: Dùng trong Tờ báo (新聞 - shinbun)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "ふるい",
    "kanji": "古い",
    "romaji": "furui",
    "vi": "Cũ",
    "mnemonic": "Chữ Cổ (古 - Thập 十 mười + Khẩu 口 miệng) -> Mười cái miệng truyền từ đời này sang đời khác. [N4/N3: Đồ cũ/secondhand (中古 - chuuko)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "いい",
    "kanji": "良い",
    "romaji": "ii (hoặc yoi)",
    "vi": "Tốt",
    "mnemonic": "Chữ Lương (良 - hình ảnh hạt gạo dẻo ngon) -> Tốt lành. [N4/N3: Ghép vào từ vựng mang nghĩa Tồi tệ, bất lương (不良 - furyou)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "わるい",
    "kanji": "悪い",
    "romaji": "warui",
    "vi": "Xấu, tồi",
    "mnemonic": "Chữ Ác (悪 - Á 亜 che đậy + Tâm 心 trái tim) -> Tâm địa xấu xa. [N4/N3: Lời nói xấu (悪口 - waruguchi)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あつい",
    "kanji": "暑い",
    "romaji": "atsui",
    "vi": "Nóng (thời tiết)",
    "mnemonic": "Chữ Thử (暑 - Nhật 日 mặt trời + Giả 者 người) -> Người bị mặt trời thiêu đốt. [N4/N3: Mùa hè nóng bức gay gắt]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あつい",
    "kanji": "熱い",
    "romaji": "atsui",
    "vi": "Nóng (nhiệt độ đồ vật, cảm giác)",
    "mnemonic": "Chữ Nhiệt (熱 - Chấp 執 + Hỏa 灬 ngọn lửa) -> Nung chảy bằng lửa. [N4/N3: Danh từ Phát sốt (熱 - netsu)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "さむい",
    "kanji": "寒い",
    "romaji": "samui",
    "vi": "Lạnh (thời tiết)",
    "mnemonic": "Chữ Hàn (寒 - Miên 宀 mái nhà + Băng 冫) -> Ở trong nhà đóng băng lạnh lẽo. [N4/N3: Cảm giác ớn lạnh (寒気 - samuke)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "つめたい",
    "kanji": "冷たい",
    "romaji": "tsumetai",
    "vi": "Lạnh, buốt (nhiệt độ, tính cách)",
    "mnemonic": "Chữ Lãnh (冷 - Băng 冫 + Lệnh 令) -> Mệnh lệnh lạnh lùng như băng. [N4/N3: Tủ lạnh (冷蔵庫 - reizouko)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "むずかしい",
    "kanji": "難しい",
    "romaji": "muzukashii",
    "vi": "Khó",
    "mnemonic": "Chữ Nan (難 - Chuy 隹 chim bị mũi tên xuyên qua) -> Tình cảnh khó khăn. [N4/N3: Vấn đề gian nan (困難 - konnan)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "やさしい",
    "kanji": "易しい",
    "romaji": "yasashii",
    "vi": "Dễ",
    "mnemonic": "Chữ Dịch (易 - Nhật 日 mặt trời + Vật 勿) -> Sự thay đổi dễ dàng của thời gian. [N4/N3: Thương mại, giao dịch (貿易 - boueki)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "たかい",
    "kanji": "高い",
    "romaji": "takai",
    "vi": "Cao, đắt",
    "mnemonic": "Chữ Cao (高 - hình ảnh tòa tháp nhiều tầng) -> Rất cao hoặc giá cả đắt đỏ. [N4/N3: Học sinh cấp 3 (高校生 - koukousei)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "やすい",
    "kanji": "安い",
    "romaji": "yasui",
    "vi": "Rẻ",
    "mnemonic": "Chữ An (安 - Nữ 女 người phụ nữ ở dưới mái nhà 宀) -> Bình yên, giá cả nhẹ nhàng. [N4/N3: Sự an toàn (安全 - anzen)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "ひくい",
    "kanji": "低い",
    "romaji": "hikui",
    "vi": "Thấp",
    "mnemonic": "Chữ Đê (低 - Nhân 亻 người + Thị 氏) -> Người cúi rạp người xuống thấp. [N4/N3: Sự suy giảm, hạ thấp (低下 - teika)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "おもしろい",
    "kanji": "面白い",
    "romaji": "omoshiroi",
    "vi": "Thú vị, hay",
    "mnemonic": "Diện (面 - khuôn mặt) + Bạch (白 - trắng sáng) -> Gương mặt bừng sáng lên vì thấy thú vị. [N4/N3: Thường đi kèm với sách, phim]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "おいしい",
    "kanji": "美味しい",
    "romaji": "oishii",
    "vi": "Ngon",
    "mnemonic": "Mỹ (美 - đẹp) + Vị (味 - mùi vị) -> Hương vị tuyệt mĩ. [N4/N3: Ở cấp độ N5 thường được viết bằng Hiragana thay vì Kanji]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "いそがしい",
    "kanji": "忙しい",
    "romaji": "isogashii",
    "vi": "Bận rộn",
    "mnemonic": "Chữ Mang (忙 - Tâm 忄 + Vong 亡) -> Tâm trí mệt mỏi, bận đến quên hết mọi thứ. [N4/N3: Hay gặp trong bối cảnh công sở]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "たのしい",
    "kanji": "楽しい",
    "romaji": "tanoshii",
    "vi": "Vui vẻ",
    "mnemonic": "Chữ Lạc (楽 - hình ảnh cây đàn trên giá gỗ) -> Đánh đàn vui vẻ. [N4/N3: Âm nhạc (音楽 - ongaku)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "しろい",
    "kanji": "白い",
    "romaji": "shiroi",
    "vi": "Trắng",
    "mnemonic": "Chữ Bạch (白 - hình ảnh hạt gạo trắng) -> Màu trắng. [N4/N3: Từ ghép thú vị: Con thiên nga (白鳥 - hakuchou - con chim màu trắng)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "くろい",
    "kanji": "黒い",
    "romaji": "kuroi",
    "vi": "Đen",
    "mnemonic": "Chữ Hắc (黒 - đồng ruộng bị lửa 灬 thiêu rụi) -> Đen thui. [N4/N3: Bảng đen trong lớp học (黒板 - kokuban)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あかい",
    "kanji": "赤い",
    "romaji": "akai",
    "vi": "Đỏ",
    "mnemonic": "Chữ Xích (赤 - Đại 大 to lớn + Hỏa 灬 ngọn lửa) -> Lửa lớn cháy đỏ rực. [N4/N3: Em bé sơ sinh (赤ちゃん - akachan)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あおい",
    "kanji": "青い",
    "romaji": "aoi",
    "vi": "Xanh dương",
    "mnemonic": "Chữ Thanh (青 - Sinh 生 sinh sôi + Nguyệt 月) -> Sự tươi mát, xanh thẳm. [N4/N3: Thanh niên (青年 - seinen)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "ちかい",
    "kanji": "近い",
    "romaji": "chikai",
    "vi": "Gần",
    "mnemonic": "Chữ Cận (近 - Cân 斤 cái rìu + Xước 辶 di chuyển) -> Bước tới gần dùng rìu chặt cây. [N4/N3: Hàng xóm (近所 - kinjo)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "とおい",
    "kanji": "遠い",
    "romaji": "tooi",
    "vi": "Xa",
    "mnemonic": "Chữ Viễn (遠 - Viên 袁 áo dài + Xước 辶) -> Mặc áo dài đi trên con đường rất xa. [N4/N3: Ngần ngại, khách sáo (遠慮 - enryo)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "はやい",
    "kanji": "早い",
    "romaji": "hayai",
    "vi": "Sớm",
    "mnemonic": "Chữ Tảo (早 - Nhật 日 mặt trời + Thập 十 vạn vật) -> Mặt trời chiếu sáng vạn vật vào sáng sớm. [N4/N3: Dậy sớm (早起き - hayaoki)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "はやい",
    "kanji": "速い",
    "romaji": "hayai",
    "vi": "Nhanh (tốc độ)",
    "mnemonic": "Chữ Tốc (速 - Thúc 束 bó lại + Xước 辶) -> Bị bó buộc nên phải đi thật nhanh. [N4/N3: Tốc độ (速度 - sokudo)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "おそい",
    "kanji": "遅い",
    "romaji": "osoi",
    "vi": "Chậm, muộn",
    "mnemonic": "Chữ Trì (遅 - Tê 犀 con tê giác + Xước 辶) -> Tê giác di chuyển chậm chạp. [N4/N3: Động từ Đi muộn (遅刻する - chikoku suru)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "おおい",
    "kanji": "多い",
    "romaji": "ooi",
    "vi": "Nhiều",
    "mnemonic": "Chữ Đa (多 - Tịch 夕 hai buổi tối chồng lên nhau) -> Tích tụ rất nhiều đêm. [N4/N3: Số nhiều (多数 - tasuu)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "すくない",
    "kanji": "少ない",
    "romaji": "sukunai",
    "vi": "Ít",
    "mnemonic": "Chữ Thiểu (少 - Tiểu 小 nhỏ bé + nét phẩy) -> Đã nhỏ còn bị cắt bớt đi, rất ít. [N4/N3: Ít nhất (少なくとも - sukunakutomo)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あたたかい",
    "kanji": "暖かい",
    "romaji": "atatakai",
    "vi": "Ấm áp (thời tiết)",
    "mnemonic": "Chữ Noãn (暖 - Nhật 日 mặt trời + Viên 爰) -> Mặt trời sưởi ấm vạn vật. [N4/N3: Máy sưởi điện (暖房 - danbou)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あたたかい",
    "kanji": "温かい",
    "romaji": "atatakai",
    "vi": "Ấm (nhiệt độ, cảm giác)",
    "mnemonic": "Chữ Ôn (温 - Thủy 氵 + Nhật 日 + Mãnh 皿) -> Nước trong đĩa được phơi nắng ấm lên. [N4/N3: Nhiệt độ (温度 - ondo)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "すずしい",
    "kanji": "涼しい",
    "romaji": "suzushii",
    "vi": "Mát mẻ",
    "mnemonic": "Chữ Lương (涼 - Thủy 氵 + Kinh 京 kinh thành) -> Nước tưới mát khắp kinh thành. [N4/N3: Thời tiết dễ chịu của mùa thu Nhật Bản]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "あまい",
    "kanji": "甘い",
    "romaji": "amai",
    "vi": "Ngọt",
    "mnemonic": "Chữ Cam (甘 - Nhất 一 trong Khẩu 口) -> Ngậm một viên kẹo trong miệng rất ngọt. [N4/N3: Nghĩa mở rộng là Nuông chiều, ngây thơ]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "jp": "からい",
    "kanji": "辛い",
    "romaji": "karai",
    "vi": "Cay",
    "mnemonic": "Chữ Tân (辛 - Lập 立 đứng + Thập 十 mười) -> Bị phạt đứng 10 tiếng rất cay đắng. [N4/N3: Đọc là tsurai thì mang nghĩa đau khổ, vất vả]"
  },
  {
    "level": "N5",
    "topic": "Con người & Nghề nghiệp",
    "jp": "わたし",
    "kanji": "私",
    "romaji": "watashi",
    "vi": "Tôi",
    "mnemonic": "Chữ Tư (私 - Hòa 禾 cây lúa + Tư 厶 cá nhân) -> Phần lúa dành riêng cho tôi. [N4/N3: Đọc là shi trong Tư thục (私立 - shiritsu)]"
  },
  {
    "level": "N5",
    "topic": "Con người & Nghề nghiệp",
    "jp": "あなた",
    "kanji": "貴方",
    "romaji": "anata",
    "vi": "Bạn, anh/chị (ngôi thứ 2)",
    "mnemonic": "Thường viết bằng Hiragana. Chữ Quý (貴 - quý giá) + Phương (方 - người). [N4/N3: Từ này ít dùng trong giao tiếp thực tế, thường gọi thẳng tên]"
  },
  {
    "level": "N5",
    "topic": "Con người & Nghề nghiệp",
    "jp": "あのひと",
    "kanji": "あの人",
    "romaji": "anohito",
    "vi": "Người kia, người đó",
    "mnemonic": "Chữ Nhân (人 - hình người đang đứng). [N4/N3: Khi ghép âm On đọc là 'nin' hoặc 'jin' như 人形 (ningyou - búp bê)]"
  },
  {
    "level": "N5",
    "topic": "Con người & Nghề nghiệp",
    "jp": "あのかた",
    "kanji": "あの方",
    "romaji": "anokata",
    "vi": "Vị kia (cách nói lịch sự của あのひと)",
    "mnemonic": "Chữ Phương (方 - phương hướng). [N4/N3: Phương mang nghĩa 'cách thức', ví dụ: Cách làm (やり方 - yarikata)]"
  },
  {
    "level": "N5",
    "topic": "Con người & Nghề nghiệp",
    "jp": "みなさん",
    "kanji": "皆さん",
    "romaji": "minasan",
    "vi": "Mọi người, các bạn",
    "mnemonic": "Chữ Giai (皆 - Tỷ 比 + Bạch 白) -> Tất cả mọi người cùng nói trắng ra. [N4/N3: Dạng kính ngữ trang trọng là 皆様 (minasama)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "かぞく",
    "kanji": "家族",
    "romaji": "kazoku",
    "vi": "Gia đình",
    "mnemonic": "Gia (家 - nhà) + Tộc (族 - họ hàng) -> Những người cùng dòng họ chung sống. [N4/N3: Dân tộc (民族 - minzoku)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "そふ",
    "kanji": "祖父",
    "romaji": "sofu",
    "vi": "Ông (của mình)",
    "mnemonic": "Tổ (祖 - tổ tiên) + Phụ (父 - cha) -> Người cha của cha, tức là ông. [N4/N3: Tổ tiên (祖先 - sosen)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "そぼ",
    "kanji": "祖母",
    "romaji": "sobo",
    "vi": "Bà (của mình)",
    "mnemonic": "Tổ (祖 - tổ tiên) + Mẫu (母 - mẹ) -> Người mẹ của mẹ/cha, tức là bà. [N4/N3: Từ đồng âm そぼ (thô bạo)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "ちち",
    "kanji": "父",
    "romaji": "chichi",
    "vi": "Bố (của mình)",
    "mnemonic": "Chữ Phụ (父 - hai tay cầm roi dạy con) -> Người cha nghiêm khắc. [N4/N3: Cha mẹ (父母 - fubo)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "はは",
    "kanji": "母",
    "romaji": "haha",
    "vi": "Mẹ (của mình)",
    "mnemonic": "Chữ Mẫu (母 - hình ảnh người phụ nữ có hai bầu ngực) -> Người mẹ nuôi con. [N4/N3: Ngôn ngữ mẹ đẻ (母国語 - bokokugo)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "あに",
    "kanji": "兄",
    "romaji": "ani",
    "vi": "Anh trai (của mình)",
    "mnemonic": "Chữ Huynh (兄 - Khẩu 口 miệng + Nhân 儿 người) -> Người anh đứng ra nói thay các em. [N4/N3: Anh em (兄弟 - kyoudai)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "あね",
    "kanji": "姉",
    "romaji": "ane",
    "vi": "Chị gái (của mình)",
    "mnemonic": "Chữ Tỷ (姉 - Nữ 女 phụ nữ + Thị 巾 khu chợ) -> Chị gái đi chợ. [N4/N3: Chị em gái (姉妹 - shimai)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "おとうと",
    "kanji": "弟",
    "romaji": "otouto",
    "vi": "Em trai (của mình)",
    "mnemonic": "Chữ Đệ (弟 - hình ảnh vũ khí quấn dây da) -> Người em trai khỏe mạnh. [N4/N3: Đệ tử (弟子 - deshi)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "いもうと",
    "kanji": "妹",
    "romaji": "imouto",
    "vi": "Em gái (của mình)",
    "mnemonic": "Chữ Muội (妹 - Nữ 女 phụ nữ + Vị 未 chưa đến) -> Đứa bé gái chưa trưởng thành là em gái. [N4/N3: Cặp từ Trưởng nam/Trưởng nữ]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "しゅじん",
    "kanji": "主人",
    "romaji": "shujin",
    "vi": "Chồng (của mình)",
    "mnemonic": "Chủ (主 - người đứng đầu) + Nhân (人 - người) -> Trụ cột trong nhà. [N4/N3: Người sở hữu (持ち主 - mochinushi)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "つま",
    "kanji": "妻",
    "romaji": "tsuma",
    "vi": "Vợ (của mình)",
    "mnemonic": "Chữ Thê (妻 - hình người phụ nữ Nữ 女 tay cầm chổi) -> Vợ quán xuyến việc nhà. [N4/N3: Vợ chồng (夫妻 - fusai)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Gia đình mình)",
    "jp": "こども",
    "kanji": "子供",
    "romaji": "kodomo",
    "vi": "Con cái (của mình) / Trẻ em",
    "mnemonic": "Tử (子 - đứa trẻ) + Cung (供 - cung cấp) -> Đứa trẻ được chu cấp. [N4/N3: Lúc còn nhỏ (子供の時 - kodomo no toki)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おじいさん",
    "kanji": "お祖父さん",
    "romaji": "ojiisan",
    "vi": "Ông (của người khác) / Cụ ông",
    "mnemonic": "Thêm tiền tố 'o' và hậu tố 'san' để kính trọng. Kéo dài âm 'i'. [N4/N3: Chú ý phân biệt với おじさん (ojisan - chú/bác) âm ngắn]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おばあさん",
    "kanji": "お祖母さん",
    "romaji": "obaasan",
    "vi": "Bà (của người khác) / Cụ bà",
    "mnemonic": "Kéo dài âm 'a'. [N4/N3: Chú ý phân biệt với おばさん (obasan - cô/dì) âm ngắn]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おとうさん",
    "kanji": "お父さん",
    "romaji": "otousan",
    "vi": "Bố (của người khác)",
    "mnemonic": "Cách gọi tôn trọng người cha của người đối diện. [N4/N3: Trong hội thoại thân mật, có thể gọi bố mình là お父さん]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おかあさん",
    "kanji": "お母さん",
    "romaji": "okaasan",
    "vi": "Mẹ (của người khác)",
    "mnemonic": "Cách gọi tôn trọng người mẹ của người đối diện. [N4/N3: Cũng được dùng để gọi mẹ mình trong nhà]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おにいさん",
    "kanji": "お兄さん",
    "romaji": "oniisan",
    "vi": "Anh trai (của người khác)",
    "mnemonic": "Có thể dùng để gọi một thanh niên trẻ tuổi ngoài đường. [N4/N3: Tiếng lóng giới trẻ hay dùng là 兄貴 (aniki)]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おねえさん",
    "kanji": "お姉さん",
    "romaji": "oneesan",
    "vi": "Chị gái (của người khác)",
    "mnemonic": "Có thể dùng để gọi một thiếu nữ trẻ tuổi ngoài đường. [N4/N3: Thường viết bằng Hiragana khi gọi người ngoài]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "ごしゅじん",
    "kanji": "ご主人",
    "romaji": "goshujin",
    "vi": "Chồng (của người khác)",
    "mnemonic": "Thêm tiền tố 'go' để tăng phần kính trọng đối với gia chủ. [N4/N3: Dùng khi hỏi thăm: Chồng chị dạo này khỏe không?]"
  },
  {
    "level": "N5",
    "topic": "Gia đình (Người khác)",
    "jp": "おくさん",
    "kanji": "奥さん",
    "romaji": "okusan",
    "vi": "Vợ (của người khác)",
    "mnemonic": "Chữ Áo (奥 - bên trong) -> Người vợ hiền cai quản việc bên trong nhà. [N4/N3: Kính ngữ cao hơn là 奥様 (okusama)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "せんせい",
    "kanji": "先生",
    "romaji": "sensei",
    "vi": "Giáo viên (dùng làm xưng hô)",
    "mnemonic": "Tiên (先 - trước) + Sinh (生 - sinh ra) -> Người sinh trước, có kinh nghiệm. [N4/N3: Dùng để gọi cả Bác sĩ, Luật sư, Nhà văn]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "きょうし",
    "kanji": "教師",
    "romaji": "kyoushi",
    "vi": "Giáo viên (chỉ nghề nghiệp)",
    "mnemonic": "Giáo (教 - dạy học) + Sư (師 - người thầy) -> Nghề gõ đầu trẻ. [N4/N3: Khi tự giới thiệu bản thân là giáo viên thì dùng từ này]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "がくせい",
    "kanji": "学生",
    "romaji": "gakusei",
    "vi": "Học sinh, sinh viên",
    "mnemonic": "Học (学 - học tập) + Sinh (生 - người) -> Người đang đi học. [N4/N3: Học sinh cấp 3 (高校生), Sinh viên đại học (大学生)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "りゅうがくせい",
    "kanji": "留学生",
    "romaji": "ryuugakusei",
    "vi": "Du học sinh",
    "mnemonic": "Lưu (留 - ở lại) + Học Sinh (学生) -> Học sinh nước ngoài ở lại học tập. [N4/N3: Việc du học (留学 - ryuugaku)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "かいしゃいん",
    "kanji": "会社員",
    "romaji": "kaishain",
    "vi": "Nhân viên công ty (nói chung)",
    "mnemonic": "Hội (会 - tập hợp) + Xã (社 - công ty) + Viên (員 - nhân viên) -> Người làm công ăn lương. [N4/N3: Xã hội (社会 - shakai)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "しゃいん",
    "kanji": "社員",
    "romaji": "shain",
    "vi": "Nhân viên của (công ty cụ thể)",
    "mnemonic": "Thường đi kèm tên công ty phía trước (Ví dụ: IMCの社員). [N4/N3: Đội ngũ nhân viên (職員 - shokuin)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "ぎんこういん",
    "kanji": "銀行員",
    "romaji": "ginkouin",
    "vi": "Nhân viên ngân hàng",
    "mnemonic": "Ngân (銀 - bạc/tiền) + Hành (行 - đi) + Viên (員) -> Người làm việc ở nơi giao dịch tiền bạc. [N4/N3: Ngân hàng (銀行)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "いしゃ",
    "kanji": "医者",
    "romaji": "isha",
    "vi": "Bác sĩ",
    "mnemonic": "Y (医 - y học) + Giả (者 - người) -> Người làm nghề y tế. [N4/N3: Y học (医学 - igaku), Khuẩn (医者 lóng đôi khi gọi là せんせい)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "けんきゅうしゃ",
    "kanji": "研究者",
    "romaji": "kenkyuusha",
    "vi": "Nhà nghiên cứu",
    "mnemonic": "Nghiên (研 - mài giũa) + Cứu (究 - đào sâu) + Giả (者) -> Người đào sâu tri thức. [N4/N3: Phòng nghiên cứu (研究室 - kenkyuushitsu)]"
  },
  {
    "level": "N5",
    "topic": "Nghề nghiệp & Chức danh",
    "jp": "けいかん",
    "kanji": "警官",
    "romaji": "keikan",
    "vi": "Cảnh sát",
    "mnemonic": "Cảnh (警 - cảnh giác) + Quan (官 - quan chức) -> Cảnh sát viên. [N4/N3: Cảnh sát nói chung (警察 - keisatsu) hoặc お巡りさん]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "すき",
    "kanji": "好き",
    "romaji": "suki",
    "vi": "Thích",
    "mnemonic": "Chữ Hảo (好 - Nữ 女 đi cùng Tử 子) -> Phụ nữ rất thích trẻ con. [N4/N3: Sở thích (好み - konomi)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "きらい",
    "kanji": "嫌い",
    "romaji": "kirai",
    "vi": "Ghét",
    "mnemonic": "Chữ Hiềm (嫌 - Nữ 女 + Kiêm 兼) -> Phụ nữ ghét phải kiêm nhiệm nhiều việc. [N4/N3: Tâm trạng chán ghét (機嫌が悪い)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "じょうず",
    "kanji": "上手",
    "romaji": "jouzu",
    "vi": "Giỏi",
    "mnemonic": "Thượng (上 - trên) + Thủ (手 - tay) -> Tay ở thế chiếu trên là người giỏi. [N4/N3: Nâng cao năng lực (向上 - koujou)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "へた",
    "kanji": "下手",
    "romaji": "heta",
    "vi": "Kém",
    "mnemonic": "Hạ (下 - dưới) + Thủ (手 - tay) -> Tay ở thế chiếu dưới là người kém. [N4/N3: Nằm trong từ Kém cỏi (苦手 - nigate)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "きれい",
    "kanji": "綺麗",
    "romaji": "kirei",
    "vi": "Đẹp, sạch sẽ",
    "mnemonic": "Kì (綺 - gấm vóc) + Lệ (麗 - đẹp) -> Đẹp như gấm lụa. [N4/N3: Ở N5 thường viết Hiragana, lên N3 sẽ quen mặt chữ Hán 綺麗]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "ハンサム",
    "kanji": "",
    "romaji": "hansamu",
    "vi": "Đẹp trai",
    "mnemonic": "Từ mượn tiếng Anh: Handsome. [N4/N3: Từ đồng nghĩa giới trẻ hay dùng là イケメン (Ikemen)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "しんせつ",
    "kanji": "親切",
    "romaji": "shinsetsu",
    "vi": "Tốt bụng, tử tế",
    "mnemonic": "Thân (親 - gần gũi) + Thiết (切 - cắt) -> Cắt đứt rào cản để trở nên gần gũi, tử tế. [N4/N3: Bạn thân (親友 - shinyuu)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "げんき",
    "kanji": "元気",
    "romaji": "genki",
    "vi": "Khỏe mạnh",
    "mnemonic": "Nguyên (元 - ban đầu) + Khí (気 - năng lượng) -> Khí lực sung mãn như lúc ban đầu. [N4/N3: Ngày đầu năm (元日 - ganjitsu)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "べんり",
    "kanji": "便利",
    "romaji": "benri",
    "vi": "Tiện lợi",
    "mnemonic": "Tiện (便 - thuận lợi) + Lợi (利 - ích lợi) -> Mang lại lợi ích và thuận tiện. [N4/N3: Bưu điện (郵便局 - yuubinkyoku)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "ふべん",
    "kanji": "不便",
    "romaji": "fuben",
    "vi": "Bất tiện",
    "mnemonic": "Bất (不 - không) + Tiện (便 - thuận lợi) -> Bất tiện. [N4/N3: Sự bất an (不安 - fuan)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "ひま",
    "kanji": "暇",
    "romaji": "hima",
    "vi": "Rảnh rỗi",
    "mnemonic": "Nhật (日 - ngày) + Giả (叚) -> Ngày có thời gian rảnh rỗi. [N4/N3: Nghỉ phép dài ngày (休暇 - kyuuka)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "にぎやか",
    "kanji": "賑やか",
    "romaji": "nigiyaka",
    "vi": "Náo nhiệt, nhộn nhịp",
    "mnemonic": "Thường viết bằng Hiragana. [N4/N3: Chữ Chẩn 賑 mang nghĩa thịnh vượng, ồn ào nhiều tiền bạc]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "しずか",
    "kanji": "静か",
    "romaji": "shizuka",
    "vi": "Yên tĩnh",
    "mnemonic": "Tĩnh (静 - Thanh 青 + Tranh 争) -> Bầu trời xanh không có tranh cãi nên rất yên tĩnh. [N4/N3: Thái độ bình tĩnh (冷静 - reisei)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "ゆうめい",
    "kanji": "有名",
    "romaji": "yuumei",
    "vi": "Nổi tiếng",
    "mnemonic": "Hữu (有 - có) + Danh (名 - tên tuổi) -> Có danh tiếng. [N4/N3: Danh thiếp (名刺 - meishi)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "たいせつ",
    "kanji": "大切",
    "romaji": "taisetsu",
    "vi": "Quan trọng, quý giá",
    "mnemonic": "Đại (大 - lớn) + Thiết (切 - cắt) -> Việc cắt đi một phần lớn là rất quan trọng. [N4/N3: Chú ý cẩn thận (気を付ける)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "だいじょうぶ",
    "kanji": "大丈夫",
    "romaji": "daijoubu",
    "vi": "Không sao, ổn",
    "mnemonic": "Đại (大 - lớn) + Trượng (丈) + Phu (夫 - đàn ông) -> Bờ vai người đàn ông trượng phu rất vững chãi. [N4/N3: Bền, chắc chắn (丈夫)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "ざんねん",
    "kanji": "残念",
    "romaji": "zannen",
    "vi": "Đáng tiếc",
    "mnemonic": "Tàn (残 - sót lại) + Niệm (念 - suy nghĩ) -> Suy nghĩ còn vương vấn sót lại gây tiếc nuối. [N4/N3: Làm thêm giờ (残業 - zangyou)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "かんたん",
    "kanji": "簡単",
    "romaji": "kantan",
    "vi": "Đơn giản",
    "mnemonic": "Giản (簡 - đơn giản) + Đơn (単 - lẻ) -> Vô cùng đơn giản, không phức tạp. [N4/N3: Từ vựng/Từ đơn (単語 - tango)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "ていねい",
    "kanji": "丁寧",
    "romaji": "teinei",
    "vi": "Lịch sự, cẩn thận",
    "mnemonic": "Đinh (丁 - canh đinh) + Ninh (寧 - yên bình) -> Thái độ từ tốn, lịch sự. [N4/N3: Lịch sự trong giao tiếp kinh doanh]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "いろいろ",
    "kanji": "色々",
    "romaji": "iroiro",
    "vi": "Nhiều loại, đa dạng",
    "mnemonic": "Sắc (色 - màu sắc) + Dấu lặp (々) -> Rất nhiều màu sắc, đa dạng. [N4/N3: Phong cảnh (景色 - keshiki)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "すてき",
    "kanji": "素敵",
    "romaji": "suteki",
    "vi": "Tuyệt vời",
    "mnemonic": "Tố (素 - nguyên bản) + Địch (敵 - đối thủ) -> Tuyệt vời đến mức không có kẻ thù hay đối thủ. [N4/N3: Kẻ thù (敵 - teki)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Đuôi Na)",
    "jp": "じょうぶ",
    "kanji": "丈夫",
    "romaji": "joubu",
    "vi": "Bền bỉ, chắc chắn",
    "mnemonic": "Trượng (丈 - cao mười thước) + Phu (夫 - người đàn ông) -> Trượng phu rất khỏe mạnh, đồ vật rất bền. [N4/N3: Trạng thái (状態 - joutai)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "げつようび",
    "kanji": "月曜日",
    "romaji": "getsuyoubi",
    "vi": "Thứ 2",
    "mnemonic": "Nguyệt (月 - Mặt trăng) -> Ngày đầu tuần là ngày của Mặt trăng (Moon-day). [N4/N3: Cuối tháng (月末 - getsumatsu)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "かようび",
    "kanji": "火曜日",
    "romaji": "kayoubi",
    "vi": "Thứ 3",
    "mnemonic": "Hỏa (火 - Lửa) -> Ngày thứ 3. [N4/N3: Hỏa hoạn (火事 - kaji)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "すいようび",
    "kanji": "水曜日",
    "romaji": "suiyoubi",
    "vi": "Thứ 4",
    "mnemonic": "Thủy (水 - Nước) -> Ngày thứ 4. [N4/N3: Môn bơi lội (水泳 - suiei)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "もくようび",
    "kanji": "木曜日",
    "romaji": "mokuyoubi",
    "vi": "Thứ 5",
    "mnemonic": "Mộc (木 - Cây cối) -> Ngày thứ 5. [N4/N3: Ghép trong cụm 毎週木曜日 (Thứ 5 hàng tuần)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "きんようび",
    "kanji": "金曜日",
    "romaji": "kinyoubi",
    "vi": "Thứ 6",
    "mnemonic": "Kim (金 - Vàng/Tiền) -> Ngày thứ 6. [N4/N3: Người giàu có (お金持ち - okanemochi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "どようび",
    "kanji": "土曜日",
    "romaji": "doyoubi",
    "vi": "Thứ 7",
    "mnemonic": "Thổ (土 - Đất) -> Ngày thứ 7. [N4/N3: Đất đai (土地 - tochi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "にちようび",
    "kanji": "日曜日",
    "romaji": "nichiyoubi",
    "vi": "Chủ nhật",
    "mnemonic": "Nhật (日 - Mặt trời) -> Ngày Chủ nhật (Sun-day). [N4/N3: Ngày nghỉ lễ (休日 - kyuujitsu)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "あさ",
    "kanji": "朝",
    "romaji": "asa",
    "vi": "Buổi sáng",
    "mnemonic": "Triều (朝 - Thập 十 + Nhật 日 + Nguyệt 月) -> Giao thoa giữa trăng và mặt trời lúc ban mai. [N4/N3: Bữa sáng (朝食 - choushoku)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "ひる",
    "kanji": "昼",
    "romaji": "hiru",
    "vi": "Buổi trưa",
    "mnemonic": "Trú (昼 - Thích 尺 + Đán 旦) -> Mặt trời lên cao nhất vào ban trưa. [N4/N3: Giờ nghỉ trưa (昼休み - hiruyasumi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "よる",
    "kanji": "夜",
    "romaji": "yoru",
    "vi": "Buổi tối, ban đêm",
    "mnemonic": "Dạ (夜 - Đầu 亠 + Nhân 亻 + Tịch 夕) -> Người đội mũ đi bộ vào đêm tối. [N4/N3: Bữa ăn đêm (夜食 - yashoku)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "ばん",
    "kanji": "晩",
    "romaji": "ban",
    "vi": "Buổi tối",
    "mnemonic": "Vãn (晩 - Nhật 日 + Miễn 免) -> Lúc mặt trời lặn là chiều tối. [N4/N3: Bữa tối (晩ご飯 - bangohan)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "まいにち",
    "kanji": "毎日",
    "romaji": "mainichi",
    "vi": "Mỗi ngày",
    "mnemonic": "Mỗi (毎 - Mỗi một) + Nhật (日 - Ngày) -> Mỗi ngày. [N4/N3: Tương tự có Mỗi sáng (毎朝 - maiasa)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Ngày tháng",
    "jp": "いつも",
    "kanji": "",
    "romaji": "itsumo",
    "vi": "Luôn luôn, lúc nào cũng",
    "mnemonic": "Phó từ chỉ tần suất 100%. [N4/N3: Thường đi kèm trợ từ thành cụm いつまでも (Mãi mãi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "いま",
    "kanji": "今",
    "romaji": "ima",
    "vi": "Bây giờ",
    "mnemonic": "Chữ Kim (今 - hiện tại) -> Ngay lúc này. [N4/N3: Lần này (今回 - konkai)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "ごぜん",
    "kanji": "午前",
    "romaji": "gozen",
    "vi": "Sáng (AM)",
    "mnemonic": "Ngọ (午 - giữa trưa 12h) + Tiền (前 - trước) -> Trước 12h trưa là buổi sáng. [N4/N3: Tương đương với AM trong tiếng Anh]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "ごご",
    "kanji": "午後",
    "romaji": "gogo",
    "vi": "Chiều (PM)",
    "mnemonic": "Ngọ (午 - giữa trưa) + Hậu (後 - sau) -> Sau 12h trưa là buổi chiều. [N4/N3: Tương đương với PM trong tiếng Anh]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "はん",
    "kanji": "半",
    "romaji": "han",
    "vi": "Rưỡi, một nửa",
    "mnemonic": "Chữ Bán (半 - Ba 三 nét bị chia cắt ở giữa 丨) -> Một nửa. [N4/N3: Nửa năm (半年 - hantoshi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "ことし",
    "kanji": "今年",
    "romaji": "kotoshi",
    "vi": "Năm nay",
    "mnemonic": "Kim (今 - hiện tại) + Niên (年 - năm) -> Năm hiện tại. [N4/N3: Chú ý âm đọc đặc biệt kotoshi, không đọc là konnen]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "きょねん",
    "kanji": "去年",
    "romaji": "kyonen",
    "vi": "Năm ngoái",
    "mnemonic": "Khứ (去 - trôi qua) + Niên (年 - năm) -> Năm đã qua. [N4/N3: Quá khứ (過去 - kako)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "らいねん",
    "kanji": "来年",
    "romaji": "rainen",
    "vi": "Năm sau",
    "mnemonic": "Lai (来 - đến) + Niên (年 - năm) -> Năm sắp tới. [N4/N3: Tương lai (未来 - mirai)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "こんげつ",
    "kanji": "今月",
    "romaji": "kongetsu",
    "vi": "Tháng này",
    "mnemonic": "Kim (今 - hiện tại) + Nguyệt (月 - tháng). [N4/N3: Chú ý cách đọc là kongetsu]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "せんげつ",
    "kanji": "先月",
    "romaji": "sengetsu",
    "vi": "Tháng trước",
    "mnemonic": "Tiên (先 - trước) + Nguyệt (月 - tháng). [N4/N3: Đi trước, phía trước (先 - saki)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "らいげつ",
    "kanji": "来月",
    "romaji": "raigetsu",
    "vi": "Tháng sau",
    "mnemonic": "Lai (来 - đến) + Nguyệt (月 - tháng). [N4/N3: Tháng tới]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "こんしゅう",
    "kanji": "今週",
    "romaji": "konshuu",
    "vi": "Tuần này",
    "mnemonic": "Kim (今 - hiện tại) + Chu (週 - tuần). [N4/N3: Cuối tuần (週末 - shuumatsu)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "せんしゅう",
    "kanji": "先週",
    "romaji": "senshuu",
    "vi": "Tuần trước",
    "mnemonic": "Tiên (先 - trước) + Chu (週 - tuần). [N4/N3: Tuần vừa qua]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "らいしゅう",
    "kanji": "来週",
    "romaji": "raishuu",
    "vi": "Tuần sau",
    "mnemonic": "Lai (来 - đến) + Chu (週 - tuần). [N4/N3: Tuần kế tiếp]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "はる",
    "kanji": "春",
    "romaji": "haru",
    "vi": "Mùa xuân",
    "mnemonic": "Chữ Xuân (春 - Ba người Tam 三 cùng ngắm mặt trời Nhật 日 mọc) -> Mùa xuân ấm áp. [N4/N3: Thanh xuân (青春 - seishun)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "なつ",
    "kanji": "夏",
    "romaji": "natsu",
    "vi": "Mùa hè",
    "mnemonic": "Chữ Hạ (夏 - Đầu Hiệt 頁 + chân đi chậm Truy 夊) -> Trời nóng nên đi lại chậm chạp. [N4/N3: Nghỉ hè (夏休み - natsuyasumi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "あき",
    "kanji": "秋",
    "romaji": "aki",
    "vi": "Mùa thu",
    "mnemonic": "Chữ Thu (秋 - Hòa 禾 cây lúa + Hỏa 火 ngọn lửa) -> Mùa thu hoạch lúa chín vàng như lửa. [N4/N3: Mùa thu Nhật Bản rất đẹp]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "ふゆ",
    "kanji": "冬",
    "romaji": "fuyu",
    "vi": "Mùa đông",
    "mnemonic": "Chữ Đông (冬 - Băng 冫 dưới mái nhà) -> Băng giá lạnh lẽo là mùa đông. [N4/N3: Nghỉ đông (冬休み - fuyuyasumi)]"
  },
  {
    "level": "N5",
    "topic": "Thời gian & Mùa màng",
    "jp": "じかん",
    "kanji": "時間",
    "romaji": "jikan",
    "vi": "Thời gian, tiếng đồng hồ",
    "mnemonic": "Thời (時 - giờ) + Gian (間 - khoảng trống) -> Khoảng thời gian. [N4/N3: Kế hoạch thời gian (時間割 - jikanwari)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "まえ",
    "kanji": "前",
    "romaji": "mae",
    "vi": "Trước, phía trước",
    "mnemonic": "Chữ Tiền (前 - Nhục 月 thịt + Đao 刂 con dao) -> Cầm dao thái thịt để trước mặt. [N4/N3: Nửa đầu (前半 - zenhan)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "うしろ",
    "kanji": "後ろ",
    "romaji": "ushiro",
    "vi": "Sau, phía sau",
    "mnemonic": "Chữ Hậu (後 - Xích 彳 bước đi + Yêu 幺 + Truy 夊) -> Bước đi lùi về phía sau. [N4/N3: Nửa sau (後半 - kouhan)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "みぎ",
    "kanji": "右",
    "romaji": "migi",
    "vi": "Phía phải",
    "mnemonic": "Chữ Hữu (右 - Tay ナ đưa thức ăn vào Miệng 口) -> Tay phải cầm đũa. [N4/N3: Rẽ phải (右折 - usetsu)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "ひだり",
    "kanji": "左",
    "romaji": "hidari",
    "vi": "Phía trái",
    "mnemonic": "Chữ Tả (左 - Tay ナ cầm Công cụ 工) -> Tay trái giữ đồ vật để tay phải làm. [N4/N3: Rẽ trái (左折 - sasetsu)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "うえ",
    "kanji": "上",
    "romaji": "ue",
    "vi": "Trên",
    "mnemonic": "Chữ Thượng (上 - Một nét nằm trên đường ngang) -> Phía trên. [N4/N3: Áo khoác ngoài (上着 - uwagi)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "した",
    "kanji": "下",
    "romaji": "shita",
    "vi": "Dưới",
    "mnemonic": "Chữ Hạ (下 - Một nét nằm dưới đường ngang) -> Phía dưới. [N4/N3: Đồ lót (下着 - shitagi)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "なか",
    "kanji": "中",
    "romaji": "naka",
    "vi": "Trong, ở giữa",
    "mnemonic": "Chữ Trung (中 - Mũi tên xuyên trúng đích) -> Ở chính giữa, bên trong. [N4/N3: Trung tâm (中心 - chuushin)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "そと",
    "kanji": "外",
    "romaji": "soto",
    "vi": "Ngoài",
    "mnemonic": "Chữ Ngoại (外 - Tịch 夕 buổi tối + Bốc 卜 bói toán) -> Ra ngoài xem bói vào buổi tối. [N4/N3: Nước ngoài (外国 - gaikoku)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "となり",
    "kanji": "隣",
    "romaji": "tonari",
    "vi": "Bên cạnh (sát vách)",
    "mnemonic": "Chữ Lân (隣 - Phụ 阝 đồi núi + Lân 粦) -> Hàng xóm láng giềng sát vách. [N4/N3: Thường chỉ những vật cùng loại đứng cạnh nhau]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "ちかく",
    "kanji": "近く",
    "romaji": "chikaku",
    "vi": "Gần (khu vực lân cận)",
    "mnemonic": "Cận (近 - gần) -> Biến đổi từ tính từ chikai thành danh từ chỉ vị trí. [N4/N3: Hàng xóm (近所 - kinjo)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "あいだ",
    "kanji": "間",
    "romaji": "aida",
    "vi": "Ở giữa (hai vật/người)",
    "mnemonic": "Chữ Gian (間 - Ánh sáng mặt trời Nhật 日 lọt qua khe cửa Môn 門) -> Không gian ở giữa. [N4/N3: Khoảng thời gian (間 - ma)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "きた",
    "kanji": "北",
    "romaji": "kita",
    "vi": "Phía Bắc",
    "mnemonic": "Chữ Bắc (北 - Hai người quay lưng lại với nhau) -> Phương Bắc lạnh lẽo. [N4/N3: Hokkaido (北海道 - Đảo phía Bắc)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "みなみ",
    "kanji": "南",
    "romaji": "minami",
    "vi": "Phía Nam",
    "mnemonic": "Chữ Nam (南 - Thập 十 + Quynh 冂 + Dương ￥) -> Phương Nam ấm áp. [N4/N3: Hướng Nam (南口 - Cửa Nam)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "ひがし",
    "kanji": "東",
    "romaji": "higashi",
    "vi": "Phía Đông",
    "mnemonic": "Chữ Đông (東 - Nhật 日 mặt trời + Mộc 木 cái cây) -> Mặt trời mọc sau gốc cây hướng Đông. [N4/N3: Tokyo (東京 - Đông Kinh)]"
  },
  {
    "level": "N5",
    "topic": "Phương hướng & Vị trí",
    "jp": "にし",
    "kanji": "西",
    "romaji": "nishi",
    "vi": "Phía Tây",
    "mnemonic": "Chữ Tây (西 - Hình ảnh tổ chim, chim quay về tổ lúc mặt trời lặn) -> Phương Tây. [N4/N3: Kansai (関西 - Vùng Quan Tây)]"
  }
];
