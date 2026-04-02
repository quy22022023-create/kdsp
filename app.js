// --- QUẢN LÝ PHIÊN BẢN (APP VERSION) ---
const APP_VERSION = 'v1.5.4_SUPER_FIX';

// --- KHỞI TẠO SUPABASE ---
const supabaseUrl = 'https://awxkvzkigfxoidnvmxew.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eGt2emtpZ2Z4b2lkbnZteGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzUwNTcsImV4cCI6MjA4NTg1MTA1N30.eBGQc3rp9-H4ipsCDhUdLTC7aJB6HHDh6CKwsvV9b3A';
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- BIẾN TRẠNG THÁI QUẢN LÝ REALTIME MODAL ---
let currentUser = JSON.parse(localStorage.getItem('pms_user')) || null;
let isModalOpen = false;
let needRefresh = false;

// --- HÀM HỖ TRỢ XỬ LÝ QUYỀN HẠN (CHỐNG LỖI JSON) ---
function getPerms(userObj) {
    if (!userObj || !userObj.permissions) return {};
    let p = userObj.permissions;
    if (typeof p === 'string') {
        try { return JSON.parse(p); } catch(e) { return {}; }
    }
    return p;
}

// --- HÀM HỖ TRỢ XỬ LÝ TIỀN TỆ (FORMAT DẤU PHẨY) ---
function formatCur(input) {
    let val = input.value.replace(/[^0-9]/g, ''); 
    input.value = val ? parseInt(val, 10).toLocaleString('en-US') : '';
}

function getNum(val) {
    if (!val) return 0;
    return parseInt(String(val).replace(/,/g, ''), 10) || 0;
}

function numToStr(num) {
    return (num || 0).toLocaleString('en-US');
}

// --- CÁC HÀM HỖ TRỢ XỬ LÝ NGÀY GIỜ ---
function getLocalISODate(d) {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().substring(0, 10);
}

function getCurrentTimeStr() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
}

function fmt(isoDateStr, includeTime = false) {
    if(!isoDateStr) return '';
    const cleanStr = isoDateStr.replace(' ', 'T');
    const parts = cleanStr.split('T');
    const datePart = parts[0]; 
    const dArr = datePart.split('-');
    if (dArr.length !== 3) return cleanStr; 
    
    const dd = parseInt(dArr[2]); 
    const mm = parseInt(dArr[1]);
    const yyyy = dArr[0];
    
    if (includeTime && parts.length > 1) {
        const timePart = parts[1].substring(0, 5); 
        return `${timePart} - ${dd}/${mm}/${yyyy}`;
    }
    return `${dd}/${mm}/${yyyy}`;
}

function checkOverdue(booking) {
    if (booking.type === 'grey') return false; 
    if (!booking.end) return false;
    
    const nowMs = new Date().getTime();
    const endMs = new Date(booking.end.replace(' ', 'T')).getTime();
    return nowMs > endMs; 
}

// --- THUẬT TOÁN TÍNH TIỀN QUÉT TỪNG ĐÊM (CÓ PHỤ THU LỄ) ---
function calcRoomCost(basePrice, startIso, endIso) {
    if (!startIso || !endIso) return basePrice;
    const sStr = startIso.substring(0, 10);
    const eStr = endIso.substring(0, 10);
    
    const s = new Date(sStr + 'T00:00:00');
    const e = new Date(eStr + 'T00:00:00');
    
    let total = 0;
    let nights = 0;
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
        nights++;
        const dStr = getLocalISODate(d);
        const pct = holidays[dStr] || 0;
        let nightPrice = basePrice + (basePrice * pct / 100);
        nightPrice = Math.round(nightPrice / 1000) * 1000; // Làm tròn tới hàng nghìn
        total += nightPrice;
    }
    if (nights === 0) total = basePrice;
    return total;
}

// --- DATA ENGINE ---
let rooms = [];
let bookings = [];
let services = []; 
let holidays = {};

let currentFilter = 'all';
let searchCriteria = null; 

const realTodayStr = getLocalISODate(new Date()); 
let currentViewDate = new Date();
currentViewDate.setDate(1); 
currentViewDate.setHours(12, 0, 0, 0); 

// --- ĐỒNG BỘ THỜI GIAN THỰC (REALTIME SYNC) ---
_supabase.channel('public-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      console.log('Phát hiện dữ liệu thay đổi:', payload);
      if (!currentUser) return;
      if (isModalOpen) {
          needRefresh = true; 
      } else {
          loadData(); 
      }
  })
  .subscribe();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
        console.log('App is visible again, checking for updates...');
        if (!isModalOpen) {
            loadData();
        } else {
            needRefresh = true;
        }
    }
});

setInterval(() => {
    if (currentUser && !isModalOpen) {
        loadData();
    } else if (currentUser) {
        needRefresh = true;
    }
}, 180000); 

// --- AUTHENTICATION LOGIC (ĐĂNG NHẬP & PHÂN QUYỀN) ---
async function executeLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPin').value.trim();
    if(!u || !p) return alert("Vui lòng nhập đủ thông tin!");

    try {
        const { data, error } = await _supabase.from('users').select('*').eq('username', u).eq('pin', p).single();
        if (error || !data) {
            alert("Sai tên đăng nhập hoặc mã PIN!");
        } else {
            currentUser = data;
            localStorage.setItem('pms_user', JSON.stringify(data));
            checkAuthAndLoad();
        }
    } catch (e) {
        alert("Lỗi kết nối CSDL. Bạn đã chạy mã SQL tạo bảng users chưa?");
    }
}

function executeLogout() {
    currentUser = null;
    localStorage.removeItem('pms_user');
    location.reload(); 
}

function checkAuthAndLoad() {
    if (currentUser) {
        document.getElementById('loginScreen').style.display = 'none';
        applyPermissions();
        loadData();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
    }
}

function applyPermissions() {
    if(!currentUser) return;
    const role = currentUser.role;
    const p = getPerms(currentUser);
    const isAdmin = role === 'admin';
    
    // Nút Lọc và Tìm phòng
    document.getElementById('roomFilter').style.display = (isAdmin || role === 'staff') ? 'inline-block' : 'none';
    document.getElementById('btnSearchRoom').style.display = (isAdmin || role === 'staff') ? 'inline-block' : 'none';
    
    // Các chức năng Quản lý
    document.getElementById('btnServices').style.display = (isAdmin || p.can_manage_services) ? 'inline-block' : 'none';
    document.getElementById('btnHolidays').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('btnUsers').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('btnExcel').style.display = (isAdmin || p.can_export_excel) ? 'inline-block' : 'none';
    document.getElementById('btnAddRoom').style.display = (isAdmin || p.can_edit_room) ? 'inline-block' : 'none';
    
    // Thống kê doanh thu
    const statsEl = document.getElementById('topStats');
    if (isAdmin || p.can_view_revenue) {
        statsEl.style.display = window.innerWidth > 768 ? 'flex' : 'none'; 
    } else {
        statsEl.style.display = 'none';
    }
}

// --- QUẢN LÝ NHÂN SỰ (CHỈ ADMIN) ---
let usersList = [];
window.openUserMgr = async function() {
    if(!currentUser || currentUser.role !== 'admin') return;
    const { data } = await _supabase.from('users').select('*').order('role', { ascending: true });
    usersList = data || [];
    
    let html = `
        <div style="margin-bottom: 10px; font-size: 13px; color: #444;">Nhập trực tiếp để sửa thông tin. Tick chọn để phân quyền chi tiết.</div>
        <div style="overflow-x:auto;">
        <table class="excel-table" style="min-width: 100%;">
            <tr>
                <th style="width: 30%;">Tài khoản</th>
                <th>Thông tin & Phân quyền</th>
                <th style="width: 40px; text-align:center;">Xóa</th>
            </tr>`;
            
    usersList.forEach(u => {
        let p = getPerms(u);
        html += `<tr>
            <td style="vertical-align: top; padding-top: 15px;">
                <input type="text" value="${u.username}" readonly style="background:#f4f7f6; color:#777; font-weight:bold; width: 100%;">
            </td>
            <td style="padding: 10px;">
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <input type="text" value="${u.name}" onchange="updateUser('${u.username}', 'name', this.value)" placeholder="Tên hiển thị" style="flex: 1 1 100%; border:1px solid #ccc; padding:8px; border-radius:5px; height:38px;">
                    <input type="text" value="${u.pin}" onchange="updateUser('${u.username}', 'pin', this.value)" placeholder="PIN" style="flex: 1 1 40%; border:1px solid #ccc; padding:8px; border-radius:5px; height:38px;">
                    <select onchange="updateUser('${u.username}', 'role', this.value)" style="flex: 1 1 50%; border:1px solid #ccc; padding:8px; border-radius:5px; height:38px; background: white;">
                        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                        <option value="staff" ${u.role==='staff'?'selected':''}>Lễ tân</option>
                        <option value="housekeeping" ${u.role==='housekeeping'?'selected':''}>Buồng phòng</option>
                        <option value="maintenance" ${u.role==='maintenance'?'selected':''}>Bảo trì</option>
                    </select>
                </div>
                ${u.role !== 'admin' ? `
                <div style="font-size:12px; text-align:left; background:#f0f4f8; padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:8px;">
                    <b style="color:var(--p-blue); margin-bottom: 2px;">Cấp quyền phụ:</b>
                    <label style="display:flex; align-items:center; margin:0; font-weight:normal;"><input type="checkbox" ${p.can_edit_room?'checked':''} onchange="updatePerm('${u.username}', 'can_edit_room', this.checked)" style="width:18px; height:18px; margin-right:8px;"> Sửa thông tin phòng</label>
                    <label style="display:flex; align-items:center; margin:0; font-weight:normal;"><input type="checkbox" ${p.can_delete_room?'checked':''} onchange="updatePerm('${u.username}', 'can_delete_room', this.checked)" style="width:18px; height:18px; margin-right:8px;"> Xóa phòng / Lịch sử</label>
                    <label style="display:flex; align-items:center; margin:0; font-weight:normal;"><input type="checkbox" ${p.can_view_revenue?'checked':''} onchange="updatePerm('${u.username}', 'can_view_revenue', this.checked)" style="width:18px; height:18px; margin-right:8px;"> Xem Tổng Doanh thu</label>
                    <label style="display:flex; align-items:center; margin:0; font-weight:normal;"><input type="checkbox" ${p.can_manage_services?'checked':''} onchange="updatePerm('${u.username}', 'can_manage_services', this.checked)" style="width:18px; height:18px; margin-right:8px;"> Cập nhật Menu Dịch vụ</label>
                    <label style="display:flex; align-items:center; margin:0; font-weight:normal;"><input type="checkbox" ${p.can_export_excel?'checked':''} onchange="updatePerm('${u.username}', 'can_export_excel', this.checked)" style="width:18px; height:18px; margin-right:8px;"> Xuất Báo cáo Excel</label>
                </div>` : '<div style="font-size:12px; color:#27ae60; padding:8px; font-weight:bold;">✅ Admin có toàn quyền.</div>'}
            </td>
            <td style="text-align:center; vertical-align: top; padding-top: 15px;"><button style="background: #ffebee; color: var(--p-red);" onclick="deleteUser('${u.username}')">✕</button></td>
        </tr>`;
    });
    
    html += `<tr>
        <td style="vertical-align: top; padding-top: 15px;"><input type="text" id="newUName" placeholder="Tài khoản..."></td>
        <td style="padding: 10px;">
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                <input type="text" id="newUFullName" placeholder="Tên nhân viên..." style="flex: 1 1 100%; border:1px solid #ccc; padding:8px; border-radius:5px; height:38px;">
                <input type="text" id="newUPin" placeholder="PIN..." style="flex: 1 1 40%; border:1px solid #ccc; padding:8px; border-radius:5px; height:38px;">
                <select id="newURole" style="flex: 1 1 50%; border:1px solid #ccc; padding:8px; border-radius:5px; height:38px; background: white;">
                    <option value="staff">Lễ tân</option>
                    <option value="housekeeping">Buồng phòng</option>
                    <option value="maintenance">Bảo trì</option>
                    <option value="admin">Quản lý (Admin)</option>
                </select>
            </div>
        </td>
        <td style="text-align:center; vertical-align: top; padding-top: 15px;"><button style="background: var(--s-green); color: white;" onclick="addUser()">+</button></td>
    </tr></table></div>
    <button class="btn btn-cancel" style="width:100%; margin-top:15px;" onclick="closeModal()">ĐÓNG LẠI</button>`;
    
    document.getElementById('mTitle').innerText = "Quản trị Nhân sự & Phân quyền";
    document.getElementById('mContent').innerHTML = html;
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true;
}

window.updateUser = async function(uname, field, val) {
    const { error } = await _supabase.from('users').update({[field]: val}).eq('username', uname);
    if(error) {
        alert("Lỗi cập nhật CSDL: " + error.message);
    } else {
        if(field === 'role') openUserMgr(); 
        if (uname === currentUser?.username && field === 'role') {
            currentUser.role = val;
            localStorage.setItem('pms_user', JSON.stringify(currentUser));
            applyPermissions();
        }
    }
}

window.updatePerm = async function(uname, permKey, isChecked) {
    const u = usersList.find(x => x.username === uname);
    let p = getPerms(u);
    p[permKey] = isChecked;
    u.permissions = p; 
    const { error } = await _supabase.from('users').update({permissions: p}).eq('username', uname);
    
    if (error) {
        alert("Lỗi Supabase khi lưu quyền:\n" + error.message);
        return;
    }
    
    if (uname === currentUser?.username) {
        currentUser.permissions = p;
        localStorage.setItem('pms_user', JSON.stringify(currentUser));
        applyPermissions();
    }
}

window.deleteUser = async function(uname) {
    if(uname === currentUser.username) return alert("Hành động bị cấm! Bạn không thể tự xóa chính tài khoản mình đang dùng.");
    if(confirm(`Xác nhận xóa quyền truy cập của tài khoản ${uname}?`)) {
        const { error } = await _supabase.from('users').delete().eq('username', uname);
        if (error) alert("Lỗi xóa user: " + error.message);
        else openUserMgr();
    }
}

window.addUser = async function() {
    const u = document.getElementById('newUName').value.trim();
    const n = document.getElementById('newUFullName').value.trim();
    const p = document.getElementById('newUPin').value.trim();
    const r = document.getElementById('newURole').value;
    
    if(!u || !p || !n) return alert("Vui lòng nhập đủ thông tin Tài khoản, Tên và PIN!");
    
    const { error } = await _supabase.from('users').insert([{username: u, name: n, pin: p, role: r, permissions: {}}]);
    if(error) alert("Lỗi Supabase: " + error.message);
    else openUserMgr();
}

// --- QUẢN LÝ NGÀY LỄ ---
window.openHolidayMgr = async function() {
    if(!currentUser || currentUser.role !== 'admin') return;
    let html = `
        <div style="margin-bottom: 10px; font-size: 13px; color: #444;">Định cấu hình phụ thu % cho các ngày lễ. Hệ thống tự động quét và tính tiền cho từng đêm khách ở, làm tròn đến hàng nghìn.</div>
        <div style="overflow-x:auto;">
        <table class="excel-table">
            <tr><th>Ngày lễ (YYYY-MM-DD)</th><th>Phụ thu (%)</th><th style="width: 50px; text-align:center;">Xóa</th></tr>
    `;
    
    Object.keys(holidays).sort().forEach(date => {
        html += `<tr>
            <td style="text-align:center; font-weight:bold; color:var(--p-blue);">${fmt(date)}</td>
            <td style="text-align:center; font-weight:bold; color:var(--p-red);">+${holidays[date]}%</td>
            <td style="text-align:center;"><button style="background:#ffebee; color:var(--p-red);" onclick="deleteHoliday('${date}')">✕</button></td>
        </tr>`;
    });
    
    html += `<tr>
        <td><input type="date" id="newHolDate" style="width:100%; border:1px solid #ccc; padding:8px; border-radius:5px;"></td>
        <td><input type="number" id="newHolPct" placeholder="VD: 20" style="width:100%; border:1px solid #ccc; padding:8px; text-align:center; border-radius:5px;"></td>
        <td style="text-align:center;"><button style="background:var(--s-green); color:white;" onclick="addHoliday()">+</button></td>
    </tr></table></div>
    <button class="btn btn-cancel" style="width:100%; margin-top:10px;" onclick="closeModal()">ĐÓNG LẠI</button>
    `;
    
    document.getElementById('mTitle').innerText = "🎉 Cấu hình Giá Ngày Lễ";
    document.getElementById('mContent').innerHTML = html;
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true;
}

window.addHoliday = async function() {
    const d = document.getElementById('newHolDate').value;
    const p = parseInt(document.getElementById('newHolPct').value) || 0;
    
    if(!d || p <= 0) return alert("Vui lòng nhập ngày và % phụ thu hợp lệ!");
    
    const { error } = await _supabase.from('holidays').upsert([{date_str: d, percent_increase: p}]);
    if (error) return alert("Lỗi khi thêm ngày lễ: " + error.message);
    
    await loadData();
    openHolidayMgr();
}

window.deleteHoliday = async function(d) {
    if(confirm("Bạn muốn xóa cấu hình phụ thu của ngày lễ này?")) {
        const { error } = await _supabase.from('holidays').delete().eq('date_str', d);
        if (error) return alert("Lỗi xóa: " + error.message);
        await loadData();
        openHolidayMgr();
    }
}

// --- HÀM TẢI VÀ ĐỒNG BỘ DỮ LIỆU TỪ SUPABASE ---
async function loadData() {
    if(!currentUser) return;

    const [resRooms, resBks, resSvs, resHols] = await Promise.all([
        _supabase.from('rooms').select('*').order('id', { ascending: true }),
        _supabase.from('bookings').select('*'),
        _supabase.from('services').select('*').order('name', { ascending: true }),
        _supabase.from('holidays').select('*')
    ]);

    if (resRooms.error) console.error("Lỗi tải rooms:", resRooms.error);
    if (resBks.error) console.error("Lỗi tải bookings:", resBks.error);
    if (resSvs.error) console.error("Lỗi tải services:", resSvs.error);
    
    holidays = {};
    if (resHols.error) {
        console.error("Lỗi tải holidays:", resHols.error);
    } else if (resHols.data) {
        resHols.data.forEach(h => holidays[h.date_str] = h.percent_increase);
    }

    rooms = resRooms.data || [];
    services = resSvs.data || []; 
    
    bookings = (resBks.data || []).map(b => {
        if (b.start && b.start.includes(' ')) b.start = b.start.replace(' ', 'T');
        if (b.end && b.end.includes(' ')) b.end = b.end.replace(' ', 'T');
        return b;
    });
    
    const { data: userData } = await _supabase.from('users').select('*').eq('username', currentUser.username).single();
    if(userData) {
        currentUser = userData;
        localStorage.setItem('pms_user', JSON.stringify(currentUser));
        applyPermissions();
    }

    render();
}

// --- RENDERING CHÍNH ---
function render() {
    renderDashboard();
    renderTimeline();
}

function applyFilter() {
    currentFilter = document.getElementById('roomFilter').value;
    if (currentFilter !== 'search') {
        searchCriteria = null;
        let opt = document.getElementById('optSearch');
        if (opt) opt.style.display = 'none';
    }
    render();
}

function renderDashboard() {
    const p = getPerms(currentUser);
    const isAdmin = currentUser?.role === 'admin';
    if (!currentUser || (!isAdmin && currentUser.role !== 'staff' && !p.can_view_revenue)) return;

    const active = bookings.filter(b => {
        const bStartD = b.start ? b.start.substring(0, 10) : '';
        const bEndD = b.end ? b.end.substring(0, 10) : '';
        return realTodayStr >= bStartD && realTodayStr < bEndD && b.type === 'red';
    }).length;
    
    let totalRev = 0;
    if (isAdmin || p.can_view_revenue) {
        totalRev = bookings.reduce((sum, b) => {
            const appliedPrice = b.price !== undefined ? b.price : (rooms.find(rm => rm.id === b.roomId)?.price || 0);
            const roomCost = calcRoomCost(appliedPrice, b.start ? b.start : realTodayStr, b.end ? b.end : realTodayStr);
            const miniTotal = parseInt(b.minibar_total) || 0; 
            return sum + roomCost + miniTotal; 
        }, 0);
    }

    const statsEl = document.getElementById('topStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card"><small>ĐANG Ở</small><b>${active}</b></div>
            ${(isAdmin || p.can_view_revenue) ? `<div class="stat-card"><small>TỔNG DOANH THU</small><b>${numToStr(totalRev/1000)}k</b></div>` : ''}
        `;
    }
}

// --- RENDER BẢNG ĐỒNG NHẤT (UNIFIED TIMELINE) ---
function renderTimeline() {
    const container = document.getElementById('mainTimeline');
    if (!container) return;
    container.innerHTML = '';

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const mPicker = document.getElementById('monthPicker');
    const mLabel = document.getElementById('monthLabel');
    if(mPicker) mPicker.value = `${year}-${String(month + 1).padStart(2, '0')}`;
    if(mLabel) mLabel.innerText = `${month + 1}/${year}`;

    let dateArr = [];
    for(let i = 1; i <= daysInMonth; i++) {
        dateArr.push(getLocalISODate(new Date(year, month, i, 12, 0, 0)));
    }
    const viewStartStr = dateArr[0];

    let table = document.createElement('table');
    
    let thead = document.createElement('thead');
    let trHead = document.createElement('tr');
    trHead.innerHTML = `
        <th class="sticky-corner">
            <div style="font-size: 14px; font-weight: 800; color: var(--p-blue)">PHÒNG \\ NGÀY</div>
        </th>
    `;
    
    dateArr.forEach((ds, index) => {
        let d = new Date(ds);
        const isToday = ds === realTodayStr ? 'background: rgba(255, 249, 219, 0.9); border-bottom: 3px solid var(--p-gold);' : '';
        const todayAttr = ds === realTodayStr ? 'id="col-today"' : ''; 
        
        const isHol = holidays[ds] ? 'color: var(--p-red);' : 'color: #1e293b;';
        const holText = holidays[ds] ? `<div style="font-size:10px; color:white; background:var(--p-red); display:inline-block; padding:1px 4px; border-radius:4px; margin-top:2px;">Lễ +${holidays[ds]}%</div>` : '';
        
        trHead.innerHTML += `
            <th ${todayAttr} class="sticky-header" style="${isToday}">
                <div style="font-size: 12px; font-weight: normal; color: #555;">${d.toLocaleDateString('vi-VN', {weekday: 'short'})}</div>
                <div style="font-size: 14px; font-weight: bold; ${isHol}">${d.getDate()}/${d.getMonth()+1}</div>
                ${holText}
            </th>
        `;
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    let tbody = document.createElement('tbody');
    const filteredRooms = rooms.filter(r => {
        if (currentFilter !== 'all' && currentFilter !== 'search' && r.status !== currentFilter) return false;
        if (currentFilter === 'search' && searchCriteria) {
            const isOverlapped = bookings.some(b => b.roomId === r.id && (searchCriteria.start < b.end && searchCriteria.end > b.start));
            if (isOverlapped) return false; 
        }
        return true;
    });

    filteredRooms.forEach(r => {
        let tr = document.createElement('tr');

        const activeBk = bookings.find(b => {
            const bStartD = b.start ? b.start.substring(0, 10) : '';
            const bEndD = b.end ? b.end.substring(0, 10) : '';
            return b.roomId === r.id && realTodayStr >= bStartD && realTodayStr < bEndD && b.type === 'red';
        });
        
        let badgeColor = 'var(--s-green)';
        let sttText = 'Sạch - Sẵn sàng';
        
        if (activeBk) { 
            if (checkOverdue(activeBk)) {
                badgeColor = '#ff9800';
                sttText = 'QUÁ GIỜ TRẢ PHÒNG!';
            } else {
                badgeColor = 'var(--p-red)';
                sttText = 'Đang có khách lưu trú';
            }
        } else if (r.status === 'dirty') { 
            badgeColor = 'var(--p-gold)'; 
            sttText = 'Khách đã out - Chờ dọn dẹp'; 
        }

        // HIỂN THỊ CỘT PHÒNG THEO QUYỀN
        const p = getPerms(currentUser);
        const isAdmin = currentUser?.role === 'admin';
        const canSeePrices = isAdmin || currentUser?.role === 'staff' || p.can_view_revenue;
        
        let roomPriceHtml = canSeePrices ? `<span class="r-price">${numToStr(r.price)}đ</span>` : '';
        let roomNotesHtml = (isAdmin || currentUser?.role === 'staff' || currentUser?.role === 'maintenance') ? `<span class="r-notes">${r.notes || '---'}</span>` : '';

        let thRoom = document.createElement('th');
        thRoom.className = 'sticky-col';
        thRoom.onclick = () => openRoomSettings(r.id);
        thRoom.innerHTML = `
            <div class="room-info" title="Nhấn để thiết lập phòng">
                <b>${r.id}</b>
                <span class="lb-code">${r.lockbox ? 'LB: ' + r.lockbox : 'Chưa có LB'}</span>
                ${roomPriceHtml}
                ${roomNotesHtml}
                <div class="badge-status" style="background:${badgeColor}" onclick="toggleDirty('${r.id}', event)" title="Tình trạng: ${sttText}. Nhấn để đổi trạng thái"></div>
            </div>
        `;
        tr.appendChild(thRoom);

        dateArr.forEach(date => {
            let td = document.createElement('td');
            td.className = 'grid-cell';
            
            const b = bookings.find(bk => {
                const bkStartD = bk.start ? bk.start.substring(0, 10) : '';
                const bkEndD = bk.end ? bk.end.substring(0, 10) : '';
                return bk.roomId === r.id && (bkStartD === date || (date === viewStartStr && bkStartD < viewStartStr && bkEndD > viewStartStr));
            });

            if(b) {
                const bStartStr = b.start ? b.start.substring(0, 10) : realTodayStr;
                const bEndStr = b.end ? b.end.substring(0, 10) : realTodayStr;
                
                const bStartCal = new Date(bStartStr + 'T00:00:00');
                const bEndCal = new Date(bEndStr + 'T00:00:00');
                
                const viewStartCal = new Date(year, month, 1, 0, 0, 0);
                const viewNextMonthCal = new Date(year, month + 1, 1, 0, 0, 0);
                
                const renderStartCal = bStartCal < viewStartCal ? viewStartCal : bStartCal;
                const renderEndCal = bEndCal > viewNextMonthCal ? viewNextMonthCal : bEndCal;
                
                const durationToRender = Math.max((renderEndCal - renderStartCal) / 86400000, 1);
                const width = (durationToRender * (window.innerWidth <= 768 ? 70 : 100)) - 10;
                
                const totalDuration = Math.max((bEndCal - bStartCal) / 86400000, 1);
                
                let crossStyle = '';
                if (bStartCal < viewStartCal && bEndCal > viewNextMonthCal) {
                    crossStyle = 'border-radius: 0; border-left: 3px dashed #fff; border-right: 3px dashed #fff;';
                } else if (bStartCal < viewStartCal) {
                    crossStyle = 'border-radius: 0 8px 8px 0; border-left: 3px dashed #fff;';
                } else if (bEndCal > viewNextMonthCal) {
                    crossStyle = 'border-radius: 8px 0 0 8px; border-right: 3px dashed #fff;';
                }

                // HIỂN THỊ THÔNG TIN TRÊN THẺ BOOKING THEO QUYỀN
                let label = b.type === 'grey' ? '(Đã xong)' : '';
                let guestName = (currentUser.role === 'housekeeping' || currentUser.role === 'maintenance') ? 'Đang có khách' : b.guest;
                let depTxt = (b.deposit && b.deposit > 0 && canSeePrices) ? ` - Cọc: ${numToStr(b.deposit/1000)}k` : '';
                const overdueCls = checkOverdue(b) ? ' tag-overdue' : '';

                td.innerHTML = `
                    <div class="booking-tag tag-${b.type}${overdueCls}" style="width: ${width}px; left: 5px; ${crossStyle}" onclick="openDetail('${b.id}')">
                        <div style="white-space:nowrap; overflow:hidden">${guestName} ${label}</div>
                        <small style="white-space:nowrap;">${totalDuration} đêm${depTxt}</small>
                    </div>
                `;
            } else {
                td.onclick = () => openBooking(r.id, date);
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);

    // --- TỰ ĐỘNG CUỘN ĐẾN NGÀY HÔM NAY ---
    const currentRealDate = new Date();
    const isCurrentMonth = (year === currentRealDate.getFullYear() && month === currentRealDate.getMonth());

    const currentViewKey = `${year}-${month}`;
    if (window.lastViewedMonth !== currentViewKey) {
        window.hasAutoScrolled = false; 
        window.lastViewedMonth = currentViewKey;
    }

    if (!window.hasAutoScrolled) {
        setTimeout(() => {
            if (container) {
                if (isCurrentMonth) {
                    const todayCol = document.getElementById('col-today');
                    const stickyCorner = document.querySelector('.sticky-corner');
                    if (todayCol) {
                        const offsetLeft = stickyCorner ? stickyCorner.offsetWidth : 120;
                        container.scrollTo({
                            left: todayCol.offsetLeft - offsetLeft - 5, 
                            behavior: 'smooth'
                        });
                    }
                } else {
                    container.scrollTo({
                        left: 0,
                        behavior: 'smooth'
                    });
                }
                window.hasAutoScrolled = true; 
            }
        }, 100);
    }
}

// --- HÀM ĐIỀU HƯỚNG THÁNG ---
function changeMonth(delta) {
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    window.hasAutoScrolled = false; 
    render();
}

function selectMonth() {
    const val = document.getElementById('monthPicker').value;
    if (val) {
        const parts = val.split('-');
        currentViewDate.setFullYear(parseInt(parts[0]));
        currentViewDate.setMonth(parseInt(parts[1]) - 1);
        window.hasAutoScrolled = false; 
        render();
    }
}

// --- QUẢN LÝ MINIBAR CATALOG (ROLE BASED) ---
window.openMinibarCatalog = function() {
    const p = getPerms(currentUser);
    if(!currentUser || (currentUser.role !== 'admin' && !p.can_manage_services)) return;

    let html = `
        <div style="margin-bottom: 10px; font-size: 13px; color: #444;">Nhập trực tiếp vào ô để sửa dữ liệu. Hệ thống sẽ tự động đồng bộ lên Database.</div>
        <div style="overflow-x:auto;">
        <table class="excel-table">
            <tr>
                <th>Tên mặt hàng</th>
                <th>Giá bán (VNĐ)</th>
                <th style="width: 50px; text-align:center;">Xóa</th>
            </tr>`;
    services.forEach((item) => {
        html += `<tr>
            <td><input type="text" value="${item.name}" onchange="updateCatalog('${item.id}', 'name', this.value)"></td>
            <td><input type="text" inputmode="numeric" value="${numToStr(item.price)}" oninput="formatCur(this)" onchange="updateCatalog('${item.id}', 'price', this.value)"></td>
            <td style="text-align: center;"><button style="background: #ffebee; color: var(--p-red);" onclick="deleteCatalog('${item.id}')">✕</button></td>
        </tr>`;
    });
    html += `<tr>
            <td><input type="text" id="newCatName" placeholder="Thêm món mới..." style="background: #f0f7ff;"></td>
            <td><input type="text" inputmode="numeric" id="newCatPrice" placeholder="Giá tiền..." style="background: #f0f7ff;" oninput="formatCur(this)"></td>
            <td style="text-align: center;"><button style="background: var(--s-green); color: white; font-weight:bold;" onclick="addCatalog()">+</button></td>
        </tr>
        </table></div>
        <button class="btn btn-cancel" style="width:100%; margin-top:10px;" onclick="closeModal()">ĐÓNG LẠI</button>
    `;
    document.getElementById('mTitle').innerText = `Quản lý Danh mục Dịch vụ`;
    document.getElementById('mContent').innerHTML = html;
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true; 
}

window.updateCatalog = async function(id, field, val) {
    const p = getPerms(currentUser);
    if (currentUser?.role !== 'admin' && !p.can_manage_services) return alert("Bạn không có quyền sửa dịch vụ!");

    if(field === 'price') val = getNum(val);
    const { error } = await _supabase.from('services').update({ [field]: val }).eq('id', id);
    if(error) alert("Lỗi khi cập nhật món hàng: " + error.message);
}

window.deleteCatalog = async function(id) {
    const p = getPerms(currentUser);
    if (currentUser?.role !== 'admin' && !p.can_manage_services) return alert("Bạn không có quyền xóa dịch vụ!");

    if(confirm("Bạn có chắc muốn xóa dịch vụ này? (Không ảnh hưởng đến hóa đơn cũ)")) {
        const { error } = await _supabase.from('services').delete().eq('id', id);
        if (error) alert("Lỗi xóa: " + error.message);
        else openMinibarCatalog();
    }
}

window.addCatalog = async function() {
    const p = getPerms(currentUser);
    if (currentUser?.role !== 'admin' && !p.can_manage_services) return alert("Bạn không có quyền thêm dịch vụ!");

    let name = document.getElementById('newCatName').value.trim();
    let price = getNum(document.getElementById('newCatPrice').value);
    if(!name) return;
    
    let newId = 'SV' + Date.now();
    const { error } = await _supabase.from('services').insert([{ id: newId, name: name, price: price }]);
    if(error) alert("Lỗi thêm dịch vụ: " + error.message);
    else {
        await loadData();
        openMinibarCatalog();
    }
}

// --- TÍNH NĂNG TÌM PHÒNG TRỐNG ---
function openSearchModal() {
    document.getElementById('mTitle').innerText = `Bộ lọc Tìm phòng trống`;
    
    let tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    const defaultIn = realTodayStr;
    const defaultOut = getLocalISODate(tmr);

    document.getElementById('mContent').innerHTML = `
        <div style="background:#f0f7ff; padding:15px; border-radius:12px; margin-bottom:15px; font-size:13px; color:#333;">
            Nhập khoảng ngày khách muốn ở. Hệ thống sẽ lọc những phòng <b>chưa có người đặt</b>.
        </div>
        <div class="f-group">
            <label>Ngày khách Check-in</label>
            <div class="date-wrapper">
                <span class="date-label" id="lblSearchIn">${fmt(defaultIn)}</span>
                <input id="sStart" type="date" value="${defaultIn}" onchange="document.getElementById('lblSearchIn').innerText = fmt(this.value)">
            </div>
        </div>
        <div class="f-group">
            <label>Ngày khách Check-out</label>
            <div class="date-wrapper">
                <span class="date-label" id="lblSearchOut">${fmt(defaultOut)}</span>
                <input id="sEnd" type="date" value="${defaultOut}" onchange="document.getElementById('lblSearchOut').innerText = fmt(this.value)">
            </div>
        </div>
        <div class="btn-row" style="margin-top: 25px;">
            <button class="btn btn-p" onclick="executeSearch()">TÌM PHÒNG TRỐNG</button>
            <button class="btn btn-cancel" onclick="closeModal()">HỦY BỎ</button>
        </div>
    `;
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true;
}

function executeSearch() {
    const sStart = document.getElementById('sStart').value;
    const sEnd = document.getElementById('sEnd').value;
    if (!sStart || !sEnd || sStart >= sEnd) return alert("Ngày đi phải lớn hơn ngày đến!");

    searchCriteria = { start: sStart + 'T14:00', end: sEnd + 'T12:00' };

    let opt = document.getElementById('optSearch');
    if (!opt) {
        opt = document.createElement('option');
        opt.id = 'optSearch';
        opt.value = 'search';
        document.getElementById('roomFilter').appendChild(opt);
    }
    opt.text = `Đang lọc: ${fmt(sStart)} ➔ ${fmt(sEnd)}`;
    opt.style.display = 'block';
    
    document.getElementById('roomFilter').value = 'search';
    currentFilter = 'search';

    closeModal(); render();
}

// --- TÍNH NĂNG QUẢN LÝ PHÒNG (ĐÃ VÁ LỖI PHÂN QUYỀN) ---
function openRoomSettings(rid) {
    if(!currentUser) return;
    const r = rooms.find(x => x.id === rid);
    const p = getPerms(currentUser);
    const isAdmin = currentUser.role === 'admin';

    // QUYỀN BUỒNG PHÒNG
    if(currentUser.role === 'housekeeping') {
        toggleDirty(rid); 
        return;
    }

    // QUYỀN BẢO TRÌ
    if(currentUser.role === 'maintenance') {
        document.getElementById('mTitle').innerText = `Bảo trì Phòng ${r.id}`;
        document.getElementById('mContent').innerHTML = `
            <div class="f-group"><label>Mã Lockbox (Chỉ xem)</label><input type="text" value="${r.lockbox || 'Không có'}" readonly style="background:#f4f7f6;"></div>
            <div class="f-group"><label>Ghi chú hỏng hóc (Cập nhật khi sửa xong)</label><input id="fMaintNotes" type="text" value="${r.notes || ''}"></div>
            <button class="btn btn-p" style="width:100%; margin-top:15px;" onclick="saveMaintenanceNotes('${rid}')">LƯU THÔNG TIN</button>
            <button class="btn btn-cancel" style="width:100%; margin-top:10px;" onclick="closeModal()">ĐÓNG LẠI</button>
        `;
        document.getElementById('pmsModal').style.display = 'flex';
        isModalOpen = true; 
        return;
    }

    // QUYỀN LỄ TÂN & ADMIN DỰA TRÊN MICRO-PERMISSIONS
    const canEditRoom = isAdmin || p.can_edit_room;
    const canDeleteRoom = isAdmin || p.can_delete_room;

    const btnDelete = canDeleteRoom ? `<button class="btn btn-d" onclick="deleteRoom('${rid}')">XÓA PHÒNG</button>` : '';
    const readOnlyAttr = !canEditRoom ? 'readonly style="background:#f4f7f6;"' : '';
    const btnSave = canEditRoom ? `<button class="btn btn-p" ${!canDeleteRoom ? 'style="grid-column: span 2"' : ''} onclick="saveRoomSettings('${rid}')">LƯU THAY ĐỔI</button>` : '';

    document.getElementById('mTitle').innerText = `Cài đặt phòng`;
    document.getElementById('mContent').innerHTML = `
        <div class="f-group"><label>Tên / Số phòng</label><input id="fRoomId" type="text" value="${r.id}" ${readOnlyAttr}></div>
        <div class="flex-row" style="margin-bottom: 15px;">
            <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Mã Lockbox</label><input class="f-group" style="margin-bottom:0;" id="fRoomLockbox" type="text" value="${r.lockbox || ''}" ${readOnlyAttr}></div>
            <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Giá gốc / đêm</label><input class="f-group" style="margin-bottom:0;" id="fRoomPrice" type="text" inputmode="numeric" value="${numToStr(r.price)}" oninput="formatCur(this)" ${readOnlyAttr}></div>
        </div>
        <div class="f-group"><label>Ghi chú / Tính chất phòng</label><input id="fRoomNotes" type="text" value="${r.notes || ''}" placeholder="VD: Quạt trần, ban công..." ${readOnlyAttr}></div>
        <div class="btn-row" style="margin-top: 25px;">
            ${btnSave}
            ${btnDelete}
            <button class="btn btn-cancel" ${!canEditRoom && !canDeleteRoom ? 'style="grid-column: span 2"' : ''} onclick="closeModal()">ĐÓNG</button>
        </div>
    `;
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true;
}

window.saveMaintenanceNotes = async function(rid) {
    const notes = document.getElementById('fMaintNotes').value.trim();
    const { error } = await _supabase.from('rooms').update({ notes: notes }).eq('id', rid);
    if(error) alert("Lỗi: " + error.message);
    else closeModal();
}

async function saveRoomSettings(oldRid) {
    const p = getPerms(currentUser);
    const isAdmin = currentUser.role === 'admin';
    const canEdit = isAdmin || p.can_edit_room;
    const canDelete = isAdmin || p.can_delete_room;

    if(!canEdit) return alert("Bạn không có quyền sửa thông tin phòng!");

    const newId = document.getElementById('fRoomId').value.trim();
    const newPrice = getNum(document.getElementById('fRoomPrice').value);
    const newLockbox = document.getElementById('fRoomLockbox').value.trim();
    const newNotes = document.getElementById('fRoomNotes').value.trim();

    if(!newId) return alert("Tên phòng không được để trống!");
    if(newId !== oldRid && rooms.some(x => x.id === newId)) return alert("Tên phòng này đã tồn tại trong hệ thống! Vui lòng chọn tên khác.");

    if(newId !== oldRid) {
        if (!canDelete) return alert("Bạn cần thêm quyền 'Xóa phòng' để có thể đổi tên/số phòng (vì hệ thống phải xóa tên phòng cũ)!");
        
        const r = rooms.find(x => x.id === oldRid);
        const { error: e1 } = await _supabase.from('rooms').insert([{ id: newId, price: newPrice, cat: r.cat || "", status: r.status, lockbox: newLockbox, notes: newNotes }]);
        if (e1) return alert("Lỗi CSDL khi tạo phòng mới: " + e1.message);

        const { error: e2 } = await _supabase.from('bookings').update({ roomId: newId }).eq('roomId', oldRid);
        if (e2) return alert("Lỗi CSDL khi chuyển lịch sử phòng: " + e2.message);

        const { error: e3 } = await _supabase.from('rooms').delete().eq('id', oldRid);
        if (e3) return alert("Lỗi CSDL khi xóa phòng cũ: " + e3.message);
    } else {
        const { error } = await _supabase.from('rooms').update({ price: newPrice, lockbox: newLockbox, notes: newNotes }).eq('id', oldRid);
        if (error) return alert("Lỗi CSDL khi lưu phòng: " + error.message);
    }
    
    closeModal(); 
}

async function deleteRoom(rid) {
    const p = getPerms(currentUser);
    const canDelete = currentUser.role === 'admin' || p.can_delete_room;
    if(!canDelete) return alert("Bạn không có quyền xóa phòng!");

    const hasBookings = bookings.some(b => b.roomId === rid);
    let msg = `Bạn có chắc chắn muốn xóa phòng ${rid} khỏi hệ thống không?`;
    if (hasBookings) msg = `CẢNH BÁO NGUY HIỂM:\nPhòng ${rid} đang có lịch sử khách hàng!\nBạn vẫn muốn tiếp tục xóa?`;

    if(confirm(msg)) {
        const { error: e1 } = await _supabase.from('bookings').delete().eq('roomId', rid); 
        if (e1) return alert("Lỗi xóa lịch sử: " + e1.message);
        const { error: e2 } = await _supabase.from('rooms').delete().eq('id', rid); 
        if (e2) return alert("Lỗi xóa phòng: " + e2.message);
        closeModal(); 
    }
}

async function addRoom() {
    const p = getPerms(currentUser);
    const isAdmin = currentUser?.role === 'admin';
    if (!isAdmin && !p.can_edit_room) return alert("Bạn không có quyền thêm phòng mới!");

    const id = prompt("Nhập Số/Tên phòng mới (VD: 301, P201):");
    const price = prompt("Giá mặc định mỗi đêm (VNĐ):", "350000");
    if(id && price) { 
        const { error } = await _supabase.from('rooms').insert([{ id, price: getNum(price), cat: "", status: "clean", lockbox: "", notes: "" }]);
        if (error) alert("Lỗi thêm phòng (Tên phòng có thể đã trùng): " + error.message);
    }
}

async function toggleDirty(rid, event) {
    if(event) event.stopPropagation(); 
    if(!currentUser) return;
    const r = rooms.find(x => x.id === rid);
    if(r.status === 'dirty') {
        if(confirm("Xác nhận phòng " + rid + " đã được dọn sạch?")) { 
            const { error } = await _supabase.from('rooms').update({ status: 'clean' }).eq('id', rid);
            if(error) alert("Lỗi cập nhật: " + error.message);
        }
    } else {
        if(confirm("Đánh dấu phòng " + rid + " cần dọn dẹp?")) { 
            const { error } = await _supabase.from('rooms').update({ status: 'dirty' }).eq('id', rid);
            if(error) alert("Lỗi cập nhật: " + error.message);
        }
    }
}

// --- CÁC CHỨC NĂNG NGHIỆP VỤ ĐẶT PHÒNG ---
window.checkDepositStatus = function() {
    const dep = getNum(document.getElementById('fDeposit').value);
    const typeSelect = document.getElementById('fType');
    if (dep > 0 && typeSelect.value === 'blue') typeSelect.value = 'purple'; 
    else if (dep === 0 && typeSelect.value === 'purple') typeSelect.value = 'blue'; 
};

function openBooking(roomId, date) {
    if(currentUser.role === 'housekeeping' || currentUser.role === 'maintenance') return; 
    const r = rooms.find(x => x.id === roomId);
    
    let nextDay = new Date(date); nextDay.setDate(nextDay.getDate() + 1);
    const endD = getLocalISODate(nextDay);

    document.getElementById('mTitle').innerText = `Đặt phòng ${roomId}`;
    document.getElementById('mContent').innerHTML = `
        <div class="f-group"><label>Tên khách hàng</label><input id="fName" type="text" placeholder="VD: Anh Minh"></div>
        
        <div class="f-group">
            <label>Số điện thoại (Dán tự động lọc chữ)</label>
            <input id="fPhone" type="tel" placeholder="Dán thông tin chứa SĐT vào đây..." oninput="this.value = this.value.replace(/[^0-9+]/g, '')">
        </div>

        <div class="f-group">
            <label>Ghi chú đặt phòng (Yêu cầu thêm)</label>
            <input id="fBkNotes" type="text" placeholder="VD: Khách cần thêm gối, nợ tiền cọc...">
        </div>

        <div class="flex-row" style="margin-bottom: 15px;">
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Ngày đến</label>
                <div class="date-wrapper">
                    <span class="date-label" id="lblBkStart">${fmt(date)}</span>
                    <input id="fStart" type="date" value="${date}" onchange="document.getElementById('lblBkStart').innerText = fmt(this.value)">
                </div>
            </div>
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Ngày đi</label>
                <div class="date-wrapper">
                    <span class="date-label" id="lblBkEnd">${fmt(endD)}</span>
                    <input id="fEnd" type="date" value="${endD}" onchange="document.getElementById('lblBkEnd').innerText = fmt(this.value)">
                </div>
            </div>
        </div>
        
        <div class="flex-row" style="margin-bottom: 15px;">
            <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Giá thỏa thuận / Đêm</label><input class="f-group" style="margin-bottom:0;" id="fPrice" type="text" inputmode="numeric" value="${numToStr(r.price)}" oninput="formatCur(this)"></div>
            <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Tiền đặt cọc phòng</label><input class="f-group" style="margin-bottom:0;" id="fDeposit" type="text" inputmode="numeric" value="0" oninput="formatCur(this); checkDepositStatus();" placeholder="0"></div>
        </div>
        <div style="font-size:11px; color:#888; margin-bottom:15px; text-align:center;">* Giá này chưa bao gồm phụ thu Ngày Lễ. Hệ thống sẽ tự động bóc tách cộng thêm vào tổng bill.</div>
        <div class="f-group">
            <label>Trạng thái ban đầu</label>
            <select id="fType">
                <option value="blue">Chưa cọc (Xanh)</option>
                <option value="purple">Đã đặt cọc (Tím)</option>
                <option value="red">Check-in luôn (Đỏ)</option>
            </select>
        </div>
        <button class="btn btn-p" style="width:100%; margin-top: 10px;" onclick="confirmBooking('${roomId}')">XÁC NHẬN ĐẶT PHÒNG</button>
    `;
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true;
}

async function confirmBooking(roomId) {
    const guest = document.getElementById('fName').value;
    const phone = document.getElementById('fPhone').value.trim();
    const notes = document.getElementById('fBkNotes').value.trim();
    const startD = document.getElementById('fStart').value;
    const endD = document.getElementById('fEnd').value;
    const price = getNum(document.getElementById('fPrice').value);
    const deposit = getNum(document.getElementById('fDeposit').value);
    const type = document.getElementById('fType').value;

    if(!guest || startD >= endD) return alert("Vui lòng kiểm tra lại thông tin ngày tháng hoặc tên khách!");

    const startTimeStr = type === 'red' ? getCurrentTimeStr() : '14:00';
    let startStr = `${startD}T${startTimeStr}`;
    let endStr = `${endD}T12:00`;

    const overlap = bookings.some(b => b.roomId === roomId && (startStr < b.end && endStr > b.start));
    if(overlap) return alert("Phòng này đã có khách lưu trú trong thời gian bạn chọn!");

    const actionBy = currentUser ? currentUser.name : 'Unknown';

    const newBk = { 
        id: 'BK'+Date.now(), roomId, guest, phone, start: startStr, end: endStr, 
        type: type, price: price, deposit: deposit, minibar_total: 0, minibar_items: JSON.stringify([]), 
        notes: notes, created_by: actionBy
    };
    
    const { error } = await _supabase.from('bookings').insert([newBk]);
    if (error) return alert("Lỗi khi tạo booking: " + error.message);
    closeModal(); 
}

window.updatePriceOnChange = function(newRid) {
    const rm = rooms.find(x => x.id === newRid);
    if (rm) {
        document.getElementById('dPrice').value = numToStr(rm.price);
    }
};

window.openDetail = function(bid) {
    if(currentUser.role === 'housekeeping' || currentUser.role === 'maintenance') return;
    const b = bookings.find(x => x.id === bid);
    if(!b) return; 
    const r = rooms.find(rm => rm.id === b.roomId);
    const p = getPerms(currentUser);
    const isAdmin = currentUser.role === 'admin';
    
    let bStart = b.start && b.start.includes('T') ? b.start : (b.start || realTodayStr) + 'T14:00';
    let bEnd = b.end && b.end.includes('T') ? b.end : (b.end || realTodayStr) + 'T12:00';
    
    const dStartInput = bStart.substring(0, 10); 
    const dEndInput = bEnd.substring(0, 10);
    
    const startCal = new Date(dStartInput + 'T00:00:00');
    const endCal = new Date(dEndInput + 'T00:00:00');
    const nights = Math.max((endCal - startCal) / 86400000, 1);
    
    const appliedPrice = b.price !== undefined ? b.price : r.price;
    const deposit = b.deposit || 0; 
    
    // TÍNH TIỀN PHÒNG CHUẨN XÁC CÓ PHỤ THU LỄ
    const roomCost = calcRoomCost(appliedPrice, bStart, bEnd);
    
    let miniItems = [];
    try { miniItems = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []); } catch(e) { miniItems = []; }
    let miniTotal = parseInt(b.minibar_total) || 0;
    
    let paidMiniTotal = miniItems.filter(m => m.paid).reduce((sum, m) => sum + (m.price * m.qty), 0);

    const totalCost = roomCost + miniTotal;
    const remaining = totalCost - deposit - paidMiniTotal;
    const isCompleted = b.type === 'grey';

    document.getElementById('mTitle').innerText = isCompleted ? "Lịch sử lưu trú" : "Chi tiết & Gia hạn phòng";
    
    let miniHtml = '';
    if (!isCompleted) {
        miniHtml = `
        <div style="background:#fdfaf0; border: 1px solid #fcebb6; padding:15px; border-radius:12px; margin-bottom:15px;">
            <h4 style="margin: 0 0 10px 0; color: var(--p-blue); font-size: 14px;">🛒 Gọi Dịch vụ / Minibar</h4>
            <div style="display:flex; gap:8px; margin-bottom: 12px; width: 100%;">
                <select id="mbItem" class="mb-select">
                    ${services.map(c => `<option value="${c.name}|${c.price}">${c.name} - ${numToStr(c.price/1000)}k</option>`).join('')}
                </select>
                <input type="number" id="mbQty" class="mb-qty" value="1" min="1">
                <button class="mb-add-btn" style="background:var(--p-blue);" onclick="addMbToBooking('${bid}')" title="Ghi nợ vào bill">+</button>
                <button class="mb-add-btn" style="background:var(--s-green); font-size:13px;" onclick="addMbAndPay('${bid}')" title="Thu tiền ngay lúc gọi món">+ ĐÃ THU</button>
            </div>
            <div id="mbList" style="font-size: 14px; color: #444;">
                ${miniItems.map((m, i) => `<div style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px dashed #e0e0e0;">
                    <span>${m.qty}x ${m.name} ${m.paid ? '<span style="color:#27ae60; font-size:11px; font-weight:bold;">(Đã thu)</span>' : ''}</span>
                    <span><b>${numToStr(m.qty * m.price)}đ</b> <span style="color:var(--p-red); cursor:pointer; margin-left:12px; font-weight:bold; padding:0 5px;" onclick="removeMb('${bid}', ${i})">✕</span></span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    let actionButtons = '';
    if (isCompleted) {
        const canDelHist = isAdmin || p.can_delete_room;
        actionButtons = `
            ${canDelHist ? `<button class="btn btn-d" style="grid-column: span 2" onclick="delBK('${bid}')">XÓA HẲN LỊCH SỬ NÀY</button>` : ''}
            <button class="btn btn-cancel" ${!canDelHist ? 'style="grid-column: span 2"' : ''} onclick="closeModal()">ĐÓNG</button>
        `;
        document.getElementById('mContent').innerHTML = `
            <div style="background:#f0f7ff; padding:15px; border-radius:12px;">
                <h2 style="margin:0">${b.guest} <span style="color:#7f8c8d; font-size:14px">(Đã trả phòng)</span></h2>
                <p style="margin: 4px 0; color: #555;">SĐT: <b>${b.phone || 'Không có'}</b></p>
                <p style="margin: 4px 0; color: #555;">Phòng: <b>${b.roomId}</b></p>
                <p style="margin: 4px 0; color: #555;">Ghi chú: <b>${b.notes || 'Không có ghi chú'}</b></p>
                <p style="margin: 4px 0; color: #555;">Thao tác cuối: <b>${b.created_by || 'Hệ thống'}</b></p>
            </div>
            <div class="bill-box">
                <div class="bill-row" style="color:var(--p-blue); font-size:13px; font-weight:bold;"><span>⏱ Giờ vào:</span><span>${fmt(bStart, true)}</span></div>
                <div class="bill-row" style="color:var(--p-red); font-size:13px; font-weight:bold; margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;"><span>🚪 Giờ ra:</span><span>${fmt(bEnd, true)}</span></div>
                <div class="bill-row"><span>Đơn giá gốc (${nights} đêm):</span><span>${numToStr(appliedPrice)}đ / đêm</span></div>
                <div class="bill-row"><span>Tiền phòng (Đã tính lễ):</span><span>${numToStr(roomCost)}đ</span></div>
                ${miniTotal > 0 ? `<div class="bill-row" style="color:var(--s-purple);"><span>Phụ thu Dịch vụ:</span><span>+ ${numToStr(miniTotal)}đ</span></div>` : ''}
                <div class="bill-row" style="color: var(--s-green);"><span>Đã đặt cọc phòng:</span><span>- ${numToStr(deposit)}đ</span></div>
                ${paidMiniTotal > 0 ? `<div class="bill-row" style="color: #27ae60;"><span>Dịch vụ đã thanh toán:</span><span>- ${numToStr(paidMiniTotal)}đ</span></div>` : ''}
                <div class="bill-row total"><span>CÒN LẠI CẦN THU:</span><span>${numToStr(remaining)}đ</span></div>
            </div>
            <div class="btn-row">${actionButtons}</div>
        `;
    } else {
        const canDelBooking = isAdmin || p.can_delete_room;
        actionButtons = `
            ${b.type !== 'red' ? `<button class="btn btn-s" onclick="updateBK('${bid}','red')">CHECK-IN</button>` : ''}
            <button class="btn btn-p" style="background:var(--p-gold); color:#000" onclick="checkOut('${bid}')">CHECK-OUT & THU TIỀN</button>
            ${canDelBooking ? `<button class="btn btn-d" onclick="delBK('${bid}')">HỦY PHÒNG</button>` : ''}
            <button class="btn btn-cancel" ${!canDelBooking ? 'style="grid-column: span 2"' : ''} onclick="closeModal()">ĐÓNG</button>
        `;
        
        const lbDisplay = r.lockbox ? `<b style="color:var(--s-purple); background:#f4e8f9; padding:2px 5px; border-radius:4px; font-size:11px;">LB: ${r.lockbox}</b>` : '';

        const roomSelectHtml = `
            <div style="flex:1; min-width: 0;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:4px; color:var(--p-blue);">Phòng (Đổi phòng)</label>
                <select id="dRoomId" onchange="updatePriceOnChange(this.value)" style="padding: 8px; font-size: 16px !important; font-weight: bold; color: var(--p-blue); border: 2px solid var(--p-blue); border-radius: 8px; outline: none; width: 100%; background: white;">
                    ${rooms.map(rm => `<option value="${rm.id}" ${rm.id === b.roomId ? 'selected' : ''}>Phòng ${rm.id}</option>`).join('')}
                </select>
            </div>
        `;

        const overdueWarningHtml = checkOverdue(b) ? `<div style="color:white; font-weight:bold; font-size: 13px; text-align:center; padding: 8px; margin-bottom: 12px; background: #ff9800; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">⚠️ KHÁCH ĐÃ QUÁ GIỜ CHECK-OUT DỰ KIẾN!</div>` : '';

        document.getElementById('mContent').innerHTML = `
            ${overdueWarningHtml}
            <div style="background:#f0f7ff; padding:15px; border-radius:12px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-bottom: 15px; gap: 10px;">
                    ${roomSelectHtml}
                    <div style="flex-shrink:0;">${lbDisplay}</div>
                </div>
                
                <div class="flex-row" style="margin-bottom: 15px;">
                    <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Tên khách</label><input class="f-group" style="margin-bottom:0;" id="dName" type="text" value="${b.guest}"></div>
                    <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">SĐT (Dán SĐT)</label><input class="f-group" style="margin-bottom:0;" id="dPhone" type="tel" value="${b.phone || ''}" oninput="this.value = this.value.replace(/[^0-9+]/g, '')"></div>
                </div>

                <div class="f-group" style="margin-bottom: 15px;">
                    <label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Ghi chú đặt phòng</label>
                    <input class="f-group" style="margin-bottom:0;" id="dNotes" type="text" value="${b.notes || ''}" placeholder="VD: Khách cần thêm gối, hẹn check-in muộn...">
                </div>
                
                <div class="flex-row" style="margin-bottom: 15px;">
                    <div class="flex-col">
                        <label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Ngày đến</label>
                        <div class="date-wrapper">
                            <span class="date-label" id="lblDetStart">${fmt(dStartInput)}</span>
                            <input id="dStart" type="date" value="${dStartInput}" onchange="document.getElementById('lblDetStart').innerText = fmt(this.value)">
                        </div>
                    </div>
                    <div class="flex-col">
                        <label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Ngày đi</label>
                        <div class="date-wrapper">
                            <span class="date-label" id="lblDetEnd">${fmt(dEndInput)}</span>
                            <input id="dEnd" type="date" value="${dEndInput}" onchange="document.getElementById('lblDetEnd').innerText = fmt(this.value)">
                        </div>
                    </div>
                </div>
                
                <div class="flex-row">
                    <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Giá gốc / Đêm</label><input class="f-group" style="margin-bottom:0;" id="dPrice" type="text" inputmode="numeric" value="${numToStr(appliedPrice)}" oninput="formatCur(this)"></div>
                    <div class="flex-col"><label style="font-size: 12px; font-weight: bold; margin-bottom: 6px; display: block;">Tiền đặt cọc phòng</label><input class="f-group" style="margin-bottom:0;" id="dDeposit" type="text" inputmode="numeric" value="${numToStr(deposit)}" oninput="formatCur(this)"></div>
                </div>
                <div style="font-size:11px; color:#777; text-align:right;">Thao tác cuối: <b>${b.created_by || 'Hệ thống'}</b></div>
                <button class="btn btn-p" style="width:100%; padding: 12px; font-size: 14px; margin-top:15px;" onclick="saveBookingChanges('${bid}')">💾 LƯU THÔNG TIN / ĐỔI PHÒNG</button>
            </div>
            
            ${miniHtml}

            <div class="bill-box">
                ${b.type === 'red' ? `<div class="bill-row" style="color:var(--p-blue); font-size:13px; font-weight:bold; margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;"><span>⏱ Giờ vào (thực tế):</span><span>${fmt(bStart, true)}</span></div>` : ''}
                <div class="bill-row"><span>Đơn giá gốc (${nights} đêm):</span><span>${numToStr(appliedPrice)}đ / đêm</span></div>
                <div class="bill-row"><span>Tiền phòng (Đã tính lễ):</span><span>${numToStr(roomCost)}đ</span></div>
                ${miniTotal > 0 ? `<div class="bill-row" style="color:var(--s-purple);"><span>Phụ thu Dịch vụ:</span><span>+ ${numToStr(miniTotal)}đ</span></div>` : ''}
                <div class="bill-row" style="color: var(--s-green);"><span>Đã đặt cọc phòng:</span><span>- ${numToStr(deposit)}đ</span></div>
                ${paidMiniTotal > 0 ? `<div class="bill-row" style="color: #27ae60;"><span>Dịch vụ đã thanh toán:</span><span>- ${numToStr(paidMiniTotal)}đ</span></div>` : ''}
                <div class="bill-row total"><span>CÒN LẠI CẦN THU:</span><span>${numToStr(remaining)}đ</span></div>
            </div>
            <div class="btn-row">${actionButtons}</div>
        `;
    }
    document.getElementById('pmsModal').style.display = 'flex';
    isModalOpen = true;
}

// --- CÁC HÀM XỬ LÝ MINIBAR THÊM/XÓA/THANH TOÁN ---
window.addMbToBooking = async function(bid) {
    const b = bookings.find(x => x.id === bid);
    const itemVal = document.getElementById('mbItem').value;
    const qty = parseInt(document.getElementById('mbQty').value) || 1;
    
    if(!itemVal || qty < 1) return;
    
    const [name, priceStr] = itemVal.split('|');
    const price = parseInt(priceStr);
    
    let miniItems = [];
    try { miniItems = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []); } catch(e) { miniItems = []; }
    miniItems.push({ name, price, qty, paid: false });
    const newTotal = (parseInt(b.minibar_total) || 0) + (price * qty);
    
    const actionBy = currentUser ? currentUser.name : 'Unknown';
    const { error } = await _supabase.from('bookings').update({ 
        minibar_total: newTotal,
        minibar_items: JSON.stringify(miniItems),
        created_by: actionBy
    }).eq('id', bid);

    if(error) return alert("Lỗi khi thêm dịch vụ: " + error.message);
    needRefresh = false; 
    await loadData();
    openDetail(bid); 
}

window.addMbAndPay = async function(bid) {
    const b = bookings.find(x => x.id === bid);
    const itemVal = document.getElementById('mbItem').value;
    const qty = parseInt(document.getElementById('mbQty').value) || 1;
    
    if(!itemVal || qty < 1) return;
    
    const [name, priceStr] = itemVal.split('|');
    const price = parseInt(priceStr);
    const cost = price * qty;
    
    let miniItems = [];
    try { miniItems = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []); } catch(e) { miniItems = []; }
    miniItems.push({ name, price, qty, paid: true }); 
    const newTotal = (parseInt(b.minibar_total) || 0) + cost;
    
    const actionBy = currentUser ? currentUser.name : 'Unknown';
    const { error } = await _supabase.from('bookings').update({ 
        minibar_total: newTotal,
        minibar_items: JSON.stringify(miniItems),
        created_by: actionBy
    }).eq('id', bid);

    if(error) return alert("Lỗi khi thêm dịch vụ: " + error.message);
    needRefresh = false; 
    await loadData();
    openDetail(bid); 
}

window.removeMb = async function(bid, idx) {
    const b = bookings.find(x => x.id === bid);
    let miniItems = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []);
    if(idx < 0 || idx >= miniItems.length) return;
    
    const targetItem = miniItems[idx];
    if(targetItem.paid) {
        if(!confirm("Chú ý: Món này khách ĐÃ THANH TOÁN TIỀN NGAY lúc gọi.\nBạn có chắc chắn muốn xóa khỏi danh sách không?")) return;
    }
    
    const removed = miniItems.splice(idx, 1)[0];
    const newTotal = Math.max((parseInt(b.minibar_total) || 0) - (removed.price * removed.qty), 0);
    
    const actionBy = currentUser ? currentUser.name : 'Unknown';
    const { error } = await _supabase.from('bookings').update({ 
        minibar_total: newTotal,
        minibar_items: JSON.stringify(miniItems),
        created_by: actionBy
    }).eq('id', bid);
    
    if(error) return alert("Lỗi khi xóa dịch vụ: " + error.message);
    needRefresh = false;
    await loadData();
    openDetail(bid);
}

// --- LƯU THAY ĐỔI & LOGIC ĐỔI PHÒNG & LOGIC MÀU SẮC THÔNG MINH ---
async function saveBookingChanges(bid) {
    const b = bookings.find(x => x.id === bid);
    const newRoomId = document.getElementById('dRoomId').value; 
    const newName = document.getElementById('dName').value;
    const newPhone = document.getElementById('dPhone').value.trim();
    const newNotes = document.getElementById('dNotes').value.trim();
    const newStartD = document.getElementById('dStart').value;
    const newEndD = document.getElementById('dEnd').value;
    const newPrice = getNum(document.getElementById('dPrice').value);
    const newDeposit = getNum(document.getElementById('dDeposit').value);

    if(!newName || newStartD >= newEndD) return alert("Vui lòng kiểm tra lại thông tin ngày tháng!");

    const oldStartTime = (b.start && b.start.includes('T')) ? b.start.substring(11, 16) : '14:00';
    const oldEndTime = (b.end && b.end.includes('T')) ? b.end.substring(11, 16) : '12:00';

    const newStart = `${newStartD}T${oldStartTime}`;
    const newEnd = `${newEndD}T${oldEndTime}`;

    const overlap = bookings.some(x => x.id !== bid && x.roomId === newRoomId && (newStart < x.end && newEnd > x.start));
    if(overlap) return alert(`Lỗi: Không thể thực hiện vì Phòng ${newRoomId} đã có khách đặt trong khoảng thời gian này!`);

    let newType = b.type;
    if (newDeposit > 0 && newType === 'blue') newType = 'purple';
    else if (newDeposit === 0 && newType === 'purple') newType = 'blue';

    const actionBy = currentUser ? currentUser.name : 'Unknown';

    const { error } = await _supabase.from('bookings').update({ 
        roomId: newRoomId, 
        guest: newName, phone: newPhone, start: newStart, 
        end: newEnd, price: newPrice, deposit: newDeposit, type: newType, 
        notes: newNotes, created_by: actionBy
    }).eq('id', bid);

    if (error) return alert("Lỗi khi lưu thông tin phòng: " + error.message);

    if (b.roomId !== newRoomId && b.type === 'red') {
        await _supabase.from('rooms').update({ status: 'dirty' }).eq('id', b.roomId);
    }

    closeModal(); 
}

async function checkOut(bid) {
    if(confirm("Xác nhận khách đã thanh toán đủ và trả phòng?")) {
        const b = bookings.find(x => x.id === bid);
        const oldDate = b.end ? b.end.substring(0, 10) : realTodayStr;
        const actualOut = `${oldDate}T${getCurrentTimeStr()}`; 
        
        const actionBy = currentUser ? currentUser.name : 'Unknown';
        
        const { error } = await _supabase.from('bookings').update({ type: 'grey', end: actualOut, created_by: actionBy }).eq('id', bid);
        if (error) return alert("Lỗi hệ thống khi Checkout: " + error.message);

        await _supabase.from('rooms').update({ status: 'dirty' }).eq('id', b.roomId);
        closeModal(); 
    }
}

async function updateBK(bid, type) { 
    let updateData = { type: type };
    if (type === 'red') {
        const b = bookings.find(x => x.id === bid);
        const oldDate = b.start ? b.start.substring(0, 10) : realTodayStr;
        updateData.start = `${oldDate}T${getCurrentTimeStr()}`;
    }
    updateData.created_by = currentUser ? currentUser.name : 'Unknown';
    
    const { error } = await _supabase.from('bookings').update(updateData).eq('id', bid);
    if (error) return alert("Lỗi cập nhật trạng thái: " + error.message);
    closeModal(); 
}

async function delBK(bid) { 
    const p = getPerms(currentUser);
    const canDelete = currentUser.role === 'admin' || p.can_delete_room;
    if(!canDelete) return alert("Bạn không có quyền xóa lịch sử!");

    if(confirm("Bạn có chắc chắn muốn xóa dữ liệu này?")) { 
        const { error } = await _supabase.from('bookings').delete().eq('id', bid);
        if (error) return alert("Lỗi xóa: " + error.message);
        closeModal(); 
    } 
}

// --- TÍNH NĂNG XUẤT EXCEL DẠNG TIMELINE (BẢN GỐC ĐẦY ĐỦ) ---
window.exportExcel = function() {
    const p = getPerms(currentUser);
    if (currentUser?.role !== 'admin' && !p.can_export_excel) return alert("Bạn không có quyền xuất dữ liệu Excel!");

    if(bookings.length === 0 && rooms.length === 0) return alert("Chưa có dữ liệu để xuất!");
    
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"></head>
        <body>
        <table border="1" style="border-collapse: collapse; font-family: Arial, sans-serif;">
            <thead>
                <tr style="background-color: #f3f2f1; height: 40px;">
                    <th style="width: 80px;">Mã LB</th>
                    <th style="width: 100px;">Tên Phòng</th>
                    <th style="width: 150px;">Ghi chú</th>
    `;
    
    for(let i = 1; i <= daysInMonth; i++) {
        html += `<th style="width: 150px; text-align: center;">${String(i).padStart(2, '0')}/${String(month+1).padStart(2, '0')}</th>`;
    }
    html += `</tr></thead><tbody>`;

    rooms.forEach(r => {
        html += `<tr style="height: 60px;">
                    <td style="text-align: center; font-weight: bold; color: #8e44ad;">${r.lockbox || ''}</td>
                    <td style="text-align: center; font-weight: bold; background-color: #e8f5e9;">${r.id}</td>
                    <td style="font-size: 11px;">${r.notes || ''}</td>`;
        
        let d = 1;
        while(d <= daysInMonth) {
            let currentDateStr = getLocalISODate(new Date(year, month, d, 12, 0, 0));
            
            let b = bookings.find(bk => {
                let bkStartD = bk.start ? bk.start.substring(0, 10) : '';
                let bkEndD = bk.end ? bk.end.substring(0, 10) : '';
                return bk.roomId === r.id && bkStartD <= currentDateStr && bkEndD > currentDateStr;
            });

            if(b) {
                let bkStartD = b.start ? b.start.substring(0, 10) : '';
                let bkEndD = b.end ? b.end.substring(0, 10) : '';
                
                let actualStartD = bkStartD < currentDateStr ? currentDateStr : bkStartD; 
                let lastDayOfMonthStr = getLocalISODate(new Date(year, month, daysInMonth, 12));
                let actualEndD = bkEndD > lastDayOfMonthStr ? getLocalISODate(new Date(year, month, daysInMonth + 1, 12)) : bkEndD;

                let sCal = new Date(actualStartD + 'T00:00:00');
                let eCal = new Date(actualEndD + 'T00:00:00');
                let colspan = Math.max((eCal - sCal) / 86400000, 1);

                if (d + colspan - 1 > daysInMonth) colspan = daysInMonth - d + 1;

                let ciTime = b.start ? b.start.substring(11, 16) : '14:00';
                let coTime = b.end ? b.end.substring(11, 16) : '12:00';
                let appliedPrice = b.price !== undefined ? b.price : r.price;
                
                // Áp dụng thuật toán tính tiền chuẩn xác có phụ thu ngày lễ
                let totalCost = calcRoomCost(appliedPrice, actualStartD, actualEndD) + (parseInt(b.minibar_total) || 0);
                let dep = b.deposit || 0;

                let bgColor = '#fff', fontColor = '#fff';
                if(b.type === 'blue') bgColor = '#0071c2'; 
                if(b.type === 'purple') bgColor = '#a332c3'; 
                if(b.type === 'red') bgColor = '#d4111e'; 
                if(b.type === 'grey') { bgColor = '#bdc3c7'; fontColor = '#333'; }

                let text = `${b.guest} - Cọc ${numToStr(dep/1000)}k - Thu ${numToStr(totalCost/1000)}k - CI ${ciTime} CO ${coTime}`;

                html += `<td colspan="${colspan}" style="background-color: ${bgColor}; color: ${fontColor}; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 12px; font-weight: bold; border: 1px solid #fff;">${text}</td>`;
                d += colspan;
            } else {
                html += `<td></td>`;
                d++;
            }
        }
        html += `</tr>`;
    });
    
    html += `</tbody></table></body></html>`;

    let blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.href = url;
    let monthStr = String(month + 1).padStart(2, '0');
    link.download = `T${monthStr}_${year}_LICH_BOOK_PHONG.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function closeModal() { 
    document.getElementById('pmsModal').style.display = 'none'; 
    isModalOpen = false;
    if (needRefresh) {
        needRefresh = false;
        loadData(); 
    }
}

// Bắt đầu khởi tạo dữ liệu
document.addEventListener('DOMContentLoaded', () => {
    // Inject Version Badge
    const brandEl = document.querySelector('.brand');
    if (brandEl) {
        brandEl.innerHTML = `ULTIMATE PMS <span style="font-size:11px; background:#e2e8f0; color:#333; padding:2px 6px; border-radius:6px; margin-left:8px; vertical-align: middle;">${APP_VERSION}</span>`;
    }

    if (typeof window.supabase === 'undefined') {
        alert("Lỗi mạng: Không tải được thư viện Supabase! Vui lòng kiểm tra lại kết nối.");
    } else {
        checkAuthAndLoad();
    }
});
