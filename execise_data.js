/**
 * TỆP DỮ LIỆU BÀI TẬP NGỮ CẢNH CHUẨN XÁC (N5 -> N3)
 * Gồm 3 dạng: Điền khuyết (cloze), Dịch câu ghép từ (sentence), Bẫy dễ nhầm (trap)
 * Xuất tự động (20 bài tập)
 */

var EXERCISE_DATA = [
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "いきます",
      "えき"
    ],
    "prompt_jp": "わたしは まいにち でんしゃ（　）えきへ いきます。",
    "prompt_vi": "Mỗi ngày tôi đi đến nhà ga bằng tàu điện.",
    "options": [
      "で",
      "を",
      "に",
      "へ"
    ],
    "answer": "で",
    "explanation": "Trợ từ で đứng sau phương tiện giao thông (でんしゃで = bằng tàu điện)."
  },
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "きます",
      "にほん"
    ],
    "prompt_jp": "せんげつ ベトナム（　）にほんへ きました。",
    "prompt_vi": "Tháng trước tôi đã từ Việt Nam đến Nhật Bản.",
    "options": [
      "から",
      "まで",
      "へ",
      "で"
    ],
    "answer": "から",
    "explanation": "Trợ từ から biểu thị điểm xuất phát (ベトナムから = từ Việt Nam)."
  },
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "かえります",
      "うち"
    ],
    "prompt_jp": "まいばん 7じに うち（　）かえります。",
    "prompt_vi": "Mỗi tối tôi về nhà lúc 7 giờ.",
    "options": [
      "へ",
      "を",
      "で",
      "が"
    ],
    "answer": "へ",
    "explanation": "Trợ từ へ (hoặc に) chỉ phương hướng di chuyển gắn liền với các động từ いきます, きます, かえります."
  },
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "たべます",
      "あさごはん"
    ],
    "prompt_jp": "けさ パン（　）たまごを たべました。",
    "prompt_vi": "Sáng nay tôi đã ăn bánh mì và trứng.",
    "options": [
      "と",
      "や",
      "も",
      "に"
    ],
    "answer": "と",
    "explanation": "Trợ từ と dùng để nối hai danh từ liệt kê đầy đủ (パンとたまご = bánh mì và trứng)."
  },
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "のみます",
      "みず"
    ],
    "prompt_jp": "あつい ですから、つめたい みず（　）のみます。",
    "prompt_vi": "Vì trời nóng nên tôi uống nước lạnh.",
    "options": [
      "を",
      "が",
      "に",
      "で"
    ],
    "answer": "を",
    "explanation": "Trợ từ を biểu thị tân ngữ trực tiếp chịu tác động của tha động từ のみます (uống)."
  },
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "みます",
      "えいが"
    ],
    "prompt_jp": "きのう ともだちと えいがかん（　）えいがを みました。",
    "prompt_vi": "Hôm qua tôi đã xem phim ở rạp chiếu phim cùng bạn.",
    "options": [
      "で",
      "に",
      "へ",
      "を"
    ],
    "answer": "で",
    "explanation": "Trợ từ で chỉ địa điểm diễn ra hành động (えいがかんで = tại rạp chiếu phim)."
  },
  {
    "type": "exercise",
    "kind": "cloze",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "かいます",
      "くつ"
    ],
    "prompt_jp": "にちようびに デパートで あたらしい くつ（　）かいました。",
    "prompt_vi": "Vào Chủ nhật tôi đã mua đôi giày mới ở trung tâm thương mại.",
    "options": [
      "を",
      "が",
      "に",
      "で"
    ],
    "answer": "を",
    "explanation": "Trợ từ を đi sau đối tượng được mua (くつをかいました = đã mua giày)."
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "いきます",
      "スーパー"
    ],
    "jp": "まいにちスーパーへいきます。",
    "romaji": "Mainichi suupaa e ikimasu.",
    "tokens": [
      {
        "jp": "まいにち",
        "romaji": "mainichi",
        "vi": "mỗi ngày",
        "ref": ""
      },
      {
        "jp": "スーパー",
        "romaji": "suupaa",
        "vi": "siêu thị",
        "ref": "スーパー"
      },
      {
        "jp": "へ",
        "romaji": "e",
        "vi": "đến (hướng tới)",
        "ref": ""
      },
      {
        "jp": "いきます",
        "romaji": "ikimasu",
        "vi": "đi",
        "ref": "いきます"
      }
    ],
    "vi": "Mỗi ngày tôi đi đến siêu thị.",
    "vi_blocks": [
      "Mỗi",
      "ngày",
      "tôi",
      "đi",
      "đến",
      "siêu thị"
    ],
    "distractors": [
      "tuần sau",
      "trường học",
      "về"
    ]
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "たべます",
      "あさごはん"
    ],
    "jp": "けさあさごはんをたべました。",
    "romaji": "Kesa asagohan o tabemashita.",
    "tokens": [
      {
        "jp": "けさ",
        "romaji": "kesa",
        "vi": "sáng nay",
        "ref": ""
      },
      {
        "jp": "あさごはん",
        "romaji": "asagohan",
        "vi": "bữa sáng",
        "ref": "あさごはん"
      },
      {
        "jp": "を",
        "romaji": "o",
        "vi": "(trợ từ tân ngữ)",
        "ref": ""
      },
      {
        "jp": "たべました",
        "romaji": "tabemashita",
        "vi": "đã ăn",
        "ref": "たべます"
      }
    ],
    "vi": "Sáng nay tôi đã ăn bữa sáng.",
    "vi_blocks": [
      "Sáng",
      "nay",
      "tôi",
      "đã",
      "ăn",
      "bữa sáng"
    ],
    "distractors": [
      "tối qua",
      "bữa tối",
      "uống"
    ]
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "よみます",
      "ほん",
      "としょかん"
    ],
    "jp": "としょかんでほんをよみます。",
    "romaji": "Toshokan de hon o yomimasu.",
    "tokens": [
      {
        "jp": "としょかん",
        "romaji": "toshokan",
        "vi": "thư viện",
        "ref": "としょかん"
      },
      {
        "jp": "で",
        "romaji": "de",
        "vi": "ở / tại",
        "ref": ""
      },
      {
        "jp": "ほん",
        "romaji": "hon",
        "vi": "sách",
        "ref": "ほん"
      },
      {
        "jp": "を",
        "romaji": "o",
        "vi": "(trợ từ tân ngữ)",
        "ref": ""
      },
      {
        "jp": "よみます",
        "romaji": "yomimasu",
        "vi": "đọc",
        "ref": "よみます"
      }
    ],
    "vi": "Tôi đọc sách ở thư viện.",
    "vi_blocks": [
      "Tôi",
      "đọc",
      "sách",
      "ở",
      "thư viện"
    ],
    "distractors": [
      "viết",
      "báo",
      "nhà ga"
    ]
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "ききます",
      "おんがく"
    ],
    "jp": "へやでおんがくをききます。",
    "romaji": "Heya de ongaku o kikimasu.",
    "tokens": [
      {
        "jp": "へや",
        "romaji": "heya",
        "vi": "căn phòng",
        "ref": ""
      },
      {
        "jp": "で",
        "romaji": "de",
        "vi": "ở trong",
        "ref": ""
      },
      {
        "jp": "おんがく",
        "romaji": "ongaku",
        "vi": "âm nhạc",
        "ref": "おんがく"
      },
      {
        "jp": "を",
        "romaji": "o",
        "vi": "(trợ từ tân ngữ)",
        "ref": ""
      },
      {
        "jp": "ききます",
        "romaji": "kikimasu",
        "vi": "nghe",
        "ref": "ききます"
      }
    ],
    "vi": "Tôi nghe nhạc ở trong phòng.",
    "vi_blocks": [
      "Tôi",
      "nghe",
      "nhạc",
      "ở",
      "trong",
      "phòng"
    ],
    "distractors": [
      "xem",
      "tivi",
      "ngoài sân"
    ]
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "かきます",
      "てがみ"
    ],
    "jp": "ともだちにてがみをかきます。",
    "romaji": "Tomodachi ni tegami o kakimasu.",
    "tokens": [
      {
        "jp": "ともだち",
        "romaji": "tomodachi",
        "vi": "bạn bè",
        "ref": ""
      },
      {
        "jp": "に",
        "romaji": "ni",
        "vi": "cho",
        "ref": ""
      },
      {
        "jp": "てがみ",
        "romaji": "tegami",
        "vi": "bức thư",
        "ref": "てがみ"
      },
      {
        "jp": "を",
        "romaji": "o",
        "vi": "(trợ từ tân ngữ)",
        "ref": ""
      },
      {
        "jp": "かきます",
        "romaji": "kakimasu",
        "vi": "viết",
        "ref": "かきます"
      }
    ],
    "vi": "Tôi viết thư cho bạn.",
    "vi_blocks": [
      "Tôi",
      "viết",
      "thư",
      "cho",
      "bạn"
    ],
    "distractors": [
      "đọc",
      "báo cáo",
      "giáo viên"
    ]
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "とります",
      "しゃしん"
    ],
    "jp": "こうえんでしゃしんをとりました。",
    "romaji": "Kouen de shashin o torimashita.",
    "tokens": [
      {
        "jp": "こうえん",
        "romaji": "kouen",
        "vi": "công viên",
        "ref": ""
      },
      {
        "jp": "で",
        "romaji": "de",
        "vi": "tại",
        "ref": ""
      },
      {
        "jp": "しゃしん",
        "romaji": "shashin",
        "vi": "bức ảnh",
        "ref": "しゃしん"
      },
      {
        "jp": "を",
        "romaji": "o",
        "vi": "(trợ từ tân ngữ)",
        "ref": ""
      },
      {
        "jp": "とりました",
        "romaji": "torimashita",
        "vi": "đã chụp",
        "ref": "とります"
      }
    ],
    "vi": "Tôi đã chụp ảnh tại công viên.",
    "vi_blocks": [
      "Tôi",
      "đã",
      "chụp",
      "ảnh",
      "tại",
      "công viên"
    ],
    "distractors": [
      "vẽ",
      "tranh",
      "bệnh viện"
    ]
  },
  {
    "type": "exercise",
    "kind": "sentence",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "あいます",
      "ともだち"
    ],
    "jp": "にちようびにともだちにあいます。",
    "romaji": "Nichiyoubi ni tomodachi ni aimasu.",
    "tokens": [
      {
        "jp": "にちようび",
        "romaji": "nichiyoubi",
        "vi": "Chủ nhật",
        "ref": ""
      },
      {
        "jp": "に",
        "romaji": "ni",
        "vi": "vào",
        "ref": ""
      },
      {
        "jp": "ともだち",
        "romaji": "tomodachi",
        "vi": "bạn",
        "ref": "ともだち"
      },
      {
        "jp": "に",
        "romaji": "ni",
        "vi": "(gặp) ai",
        "ref": ""
      },
      {
        "jp": "あいます",
        "romaji": "aimasu",
        "vi": "gặp",
        "ref": "あいます"
      }
    ],
    "vi": "Vào Chủ nhật tôi gặp bạn.",
    "vi_blocks": [
      "Vào",
      "Chủ nhật",
      "tôi",
      "gặp",
      "bạn"
    ],
    "distractors": [
      "Thứ Bảy",
      "gia đình",
      "chờ"
    ]
  },
  {
    "type": "exercise",
    "kind": "trap",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "いきます",
      "きます",
      "かえります"
    ],
    "prompt_jp": "らいしゅう わたしの くにへ（　）。",
    "prompt_vi": "Tuần sau tôi sẽ về nước của mình.",
    "options": [
      "かえります (帰ります)",
      "いきます (行きます)",
      "きます (来ます)",
      "でます (出ます)"
    ],
    "answer": "かえります (帰ります)",
    "explanation": "Khi trở về nơi thuộc về mình (nhà, quê hương, đất nước), tiếng Nhật bắt buộc dùng かえります (帰ります) thay vì いきます."
  },
  {
    "type": "exercise",
    "kind": "trap",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "かきます",
      "ききます"
    ],
    "prompt_jp": "先生（せんせい）の はなしを よく（　）ください。",
    "prompt_vi": "Hãy lắng nghe kỹ lời giảng của giáo viên.",
    "options": [
      "きいて (聞いて)",
      "かいて (書いて)",
      "みて (見て)",
      "よんで (読んで)"
    ],
    "answer": "きいて (聞いて)",
    "explanation": "ききます (聞きます) là nghe/hỏi; còn かきます (書きます) là viết. Hai từ dễ nhầm âm đầu."
  },
  {
    "type": "exercise",
    "kind": "trap",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "のみます",
      "たべます"
    ],
    "prompt_jp": "かぜを ひきましたから、くすりを（　）。",
    "prompt_vi": "Vì bị cảm nên tôi uống thuốc.",
    "options": [
      "のみます (飲みます)",
      "たべます (食べます)",
      "すいます (吸います)",
      "かみます (噛みます)"
    ],
    "answer": "のみます (飲みます)",
    "explanation": "Trong tiếng Nhật, hành động uống thuốc (kể cả thuốc viên) luôn dùng động từ のみます (飲みます), không dùng たべます."
  },
  {
    "type": "exercise",
    "kind": "trap",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "みます",
      "よみます"
    ],
    "prompt_jp": "まいあさ しんぶんを（　）。",
    "prompt_vi": "Mỗi sáng tôi đọc báo.",
    "options": [
      "よみます (読みます)",
      "みます (見ます)",
      "ききます (聞きます)",
      "かきます (書きます)"
    ],
    "answer": "よみます (読みます)",
    "explanation": "Với các ấn phẩm có chữ viết (sách, báo, tạp chí), tiếng Nhật dùng よみます (đọc) chứ không dùng みます (nhìn/xem)."
  },
  {
    "type": "exercise",
    "kind": "trap",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "あいます"
    ],
    "prompt_jp": "えきの まえで ともだち（　）あいました。",
    "prompt_vi": "Tôi đã gặp bạn ở trước nhà ga.",
    "options": [
      "に",
      "を",
      "で",
      "へ"
    ],
    "answer": "に",
    "explanation": "Động từ あいます (gặp gỡ) luôn đi với trợ từ に (ともだちにあう), không dùng trợ từ を như tiếng Việt."
  },
  {
    "type": "exercise",
    "kind": "trap",
    "level": "N5",
    "topic": "Động từ cốt lõi",
    "refs": [
      "きります",
      "きます"
    ],
    "prompt_jp": "はさみで かみを（　）。",
    "prompt_vi": "Tôi cắt giấy bằng kéo.",
    "options": [
      "きります (切ります)",
      "きます (着ます)",
      "きます (来ます)",
      "ききます (聞きます)"
    ],
    "answer": "きります (切ります)",
    "explanation": "きります (切ります - động từ nhóm 1) nghĩa là cắt; còn きます (着ます - nhóm 2) là mặc áo, và きます (来ます - nhóm 3) là đến."
  }
];
