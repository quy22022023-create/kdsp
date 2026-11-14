/**
 * TỆP DỮ LIỆU TỪ VỰNG & KANJI TRUNG TÂM (N5 -> N3)
 * Xuất tự động từ ứng dụng Flashcards (0 từ vựng)
 */

var VOCAB_DATA = 
    [
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "いきます",
    "kanji": "行きます",
    "romaji": "ikimasu",
    "vi": "Đi",
    "mnemonic": "Chữ Hành (行 - hình ngã tư đường) -> Đi trên đường. [N4/N3: Mở rộng nghĩa tổ chức sự kiện (行う)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v3",
    "jp": "きます",
    "kanji": "来ます",
    "romaji": "kimasu",
    "vi": "Đến",
    "mnemonic": "Chữ Lai (来 - cây lúa trĩu bông mang tới) -> Mang đến, đi tới. [N4/N3: Đọc là ライ trong らいねん (năm sau), しょうらい (tương lai)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "かえります",
    "kanji": "帰ります",
    "romaji": "kaerimasu",
    "vi": "Về, trở về",
    "mnemonic": "Chữ Quy (帰 - người phụ nữ cầm chổi quét dọn nhà) -> Trở về nhà. [N4/N3: Lưu ý đây là động từ nhóm 1 đặc biệt (thể て là かえって), dùng trong きこく (về nước)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v2",
    "jp": "たべます",
    "kanji": "食べます",
    "romaji": "tabemasu",
    "vi": "Ăn",
    "mnemonic": "Chữ Thực (食 - cái nắp đậy trên bát cơm) -> Ăn uống. [N4/N3: Đọc là ショク trong しょくじ (bữa ăn), しょくどう (nhà ăn)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "のみます",
    "kanji": "飲みます",
    "romaji": "nomimasu",
    "vi": "Uống",
    "mnemonic": "Chữ Ẩm (飲 - bộ Thực 食 + người há miệng 欠) -> Uống nước, uống thuốc. [N4/N3: Dùng trong いんしょくてん (quán ăn uống)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v2",
    "jp": "みます",
    "kanji": "見ます",
    "romaji": "mimasu",
    "vi": "Nhìn, xem",
    "mnemonic": "Chữ Kiến (見 - con mắt 目 trên đôi chân 儿) -> Nhìn, xem. [N4/N3: Đọc là ケン trong けんがく (tham quan học tập), いけん (ý kiến)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "かいます",
    "kanji": "買います",
    "romaji": "kaimasu",
    "vi": "Mua",
    "mnemonic": "Chữ Mãi (買 - cái lưới 罒 trùm lên vỏ sò tiền 貝) -> Mua sắm. [N4/N3: Đọc là バイ trong ばいばい (mua bán)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "よみます",
    "kanji": "読みます",
    "romaji": "yomimasu",
    "vi": "Đọc",
    "mnemonic": "Chữ Độc (読 - lời nói 言 bán 売 ra thành sách) -> Đọc sách, đọc báo. [N4/N3: Đọc là ドク trong どくしょ (đọc sách)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "ききます",
    "kanji": "聞きます",
    "romaji": "kikimasu",
    "vi": "Nghe, hỏi",
    "mnemonic": "Chữ Văn (聞 - cái tai 耳 đặt ở cánh cửa 門) -> Lắng nghe, hỏi thăm. [N4/N3: Đọc là ブン trong しんぶん (báo chí)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "かきます",
    "kanji": "書きます",
    "romaji": "kakimasu",
    "vi": "Viết",
    "mnemonic": "Chữ Thư (書 - bàn tay cầm bút viết lên giấy 日) -> Viết chữ, viết thư. [N4/N3: Đọc là ショ trong としょかん (thư viện), じしょ (từ điển)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "とります",
    "kanji": "撮ります",
    "romaji": "torimasu",
    "vi": "Chụp (ảnh)",
    "mnemonic": "Chữ Toát (撮 - bàn tay 扌 nắm lấy tai 最) -> Bấm máy chụp ảnh. [N4/N3: Đọc là サツ trong さつえい (quay phim, chụp ảnh)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "あいます",
    "kanji": "会います",
    "romaji": "aimasu",
    "vi": "Gặp gỡ",
    "mnemonic": "Chữ Hội (会 - mái nhà tụ họp mây 云) -> Gặp mặt (đi với trợ từ に). [N4/N3: Đọc là カイ trong かいしゃ (công ty), かいぎ (cuộc họp)]"
  },
  {
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "tag": "v1",
    "jp": "きります",
    "kanji": "切ります",
    "romaji": "kirimasu",
    "vi": "Cắt",
    "mnemonic": "Chữ Thiết (切 - số bảy 七 dùng dao 刀 cắt đứt) -> Cắt. [N4/N3: Động từ nhóm 1 đặc biệt (thể て là きって), xuất hiện trong たいせつ (quan trọng)]"
  },
  {
    "level": "N5",
    "topic": "Địa điểm & Đời sống",
    "tag": "noun",
    "jp": "えき",
    "kanji": "駅",
    "romaji": "eki",
    "vi": "Nhà ga",
    "mnemonic": "Chữ Dịch (駅 - con ngựa 馬 đứng ở trạm dừng 尺) -> Trạm dừng tàu, nhà ga. [N4/N3: Kết hợp thành えきまえ (trước nhà ga), えきいん (nhân viên nhà ga)]"
  },
  {
    "level": "N5",
    "topic": "Địa điểm & Đời sống",
    "tag": "noun",
    "jp": "うち",
    "kanji": "家",
    "romaji": "uchi",
    "vi": "Nhà, gia đình",
    "mnemonic": "Chữ Gia (家 - mái nhà 宀 che chở cho con heo 豕) -> Ngôi nhà, mái ấm. [N4/N3: Cũng đọc là いえ (ngôi nhà vật lý) hoặc カ trong かぞく (gia đình)]"
  },
  {
    "level": "N5",
    "topic": "Địa điểm & Đời sống",
    "tag": "noun",
    "jp": "としょかん",
    "kanji": "図書館",
    "romaji": "toshokan",
    "vi": "Thư viện",
    "mnemonic": "Đồ (図) + Thư (書) + Quán (館) -> Tòa nhà lưu giữ sách vở và bản đồ. [N4/N3: Tách lẻ ちず (bản đồ), びじゅつかん (bảo tàng mỹ thuật)]"
  },
  {
    "level": "N5",
    "topic": "Địa điểm & Đời sống",
    "tag": "noun",
    "jp": "スーパー",
    "kanji": "",
    "romaji": "suupaa",
    "vi": "Siêu thị",
    "mnemonic": "Từ mượn tiếng Anh 'Supermarket' viết rút gọn bằng Katakana. [N4/N3: Các từ rút gọn tương tự như デパート (trung tâm thương mại), コンビニ (cửa hàng tiện lợi)]"
  },
  {
    "level": "N5",
    "topic": "Địa điểm & Đời sống",
    "tag": "noun",
    "jp": "にほん",
    "kanji": "日本",
    "romaji": "nihon",
    "vi": "Nhật Bản",
    "mnemonic": "Nhật (日 - mặt trời) + Bản (本 - gốc rễ) -> Đất nước mặt trời mọc. [N4/N3: Cũng đọc trang trọng là にっぽん]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "あさごはん",
    "kanji": "朝ご飯",
    "romaji": "asagohan",
    "vi": "Bữa sáng",
    "mnemonic": "Triêu (朝 - buổi sáng) + Ngự (ご) + Phạn (飯 - cơm) -> Cơm buổi sáng. [N4/N3: Tương tự có ひるごはん (bữa trưa), ばんごはん (bữa tối)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "みず",
    "kanji": "水",
    "romaji": "mizu",
    "vi": "Nước (nguội/lạnh)",
    "mnemonic": "Chữ Thủy (水 - hình dòng nước chảy ở giữa và tia nước bắn hai bên) -> Nước uống. [N4/N3: Đọc là スイ trong すいようび (thứ Tư), すいえい (bơi lội)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "えいが",
    "kanji": "映画",
    "romaji": "eiga",
    "vi": "Phim điện ảnh",
    "mnemonic": "Ánh (映 - ánh sáng chiếu) + Họa (画 - bức tranh) -> Tranh chiếu sáng lên màn ảnh. [N4/N3: Kết hợp thành えいがかん (rạp chiếu phim)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "くつ",
    "kanji": "靴",
    "romaji": "kutsu",
    "vi": "Giày",
    "mnemonic": "Chữ Ngoa (靴 - làm bằng da thuộc 革 để đi lại 化) -> Đôi giày. [N4/N3: Mở rộng thành くつした (tất/vớ)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "ほん",
    "kanji": "本",
    "romaji": "hon",
    "vi": "Sách",
    "mnemonic": "Chữ Bản (本 - cái cây 木 có gạch ngang ở gốc) -> Gốc rễ tri thức là sách. [N4/N3: Còn là lượng từ đếm vật thon dài (いっぽん, にほん, さんぼん)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "おんがく",
    "kanji": "音楽",
    "romaji": "ongaku",
    "vi": "Âm nhạc",
    "mnemonic": "Âm (音 - âm thanh) + Nhạc (楽 - niềm vui) -> Âm thanh mang lại niềm vui. [N4/N3: Chữ 楽 còn đọc là たのしい (vui vẻ) và らく (thoải mái)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "てがみ",
    "kanji": "手紙",
    "romaji": "tegami",
    "vi": "Bức thư",
    "mnemonic": "Thủ (手 - bàn tay) + Chỉ (紙 - tờ giấy) -> Tờ giấy viết bằng tay gửi đi. [N4/N3: Chữ 紙 đứng một mình đọc là かみ (giấy)]"
  },
  {
    "level": "N5",
    "topic": "Đồ vật & Ẩm thực",
    "tag": "noun",
    "jp": "しゃしん",
    "kanji": "写真",
    "romaji": "shashin",
    "vi": "Bức ảnh",
    "mnemonic": "Tả (写 - sao chép) + Chân (真 - sự thật) -> Ghi lại hình ảnh chân thật. [N4/N3: Động từ うつします (sao chép, chụp lại)]"
  },
  {
    "level": "N5",
    "topic": "Con người",
    "tag": "noun",
    "jp": "ともだち",
    "kanji": "友達",
    "romaji": "tomodachi",
    "vi": "Bạn bè",
    "mnemonic": "Hữu (友 - hai bàn tay nắm lấy nhau) + Đạt (達 - nhóm người) -> Bạn bè. [N4/N3: Đọc là ユウ trong ゆうじん (bạn bè - văn viết), しんゆう (bạn thân)]"
  },
  {
    "level": "N5",
    "topic": "Tính từ N5 (Phần 1)",
    "tag": "adj_i",
    "jp": "あつい",
    "kanji": "熱い",
    "romaji": "atsui",
    "vi": "Nóng (đồ vật, thức uống)",
    "mnemonic": "Chữ Nhiệt (熱 - có 4 chấm hỏa 灬 ở dưới đun sôi) -> Nóng bỏng tay. [N4/N3: Phân biệt với 暑い (nóng thời tiết) và 厚い (dày dặn)]"
  }
]
;
