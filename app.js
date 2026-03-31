// --- KHỞI TẠO SUPABASE ---
const supabaseUrl = 'https://awxkvzkigfxoidnvmxew.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eGt2emtpZ2Z4b2lkbnZteGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzUwNTcsImV4cCI6MjA4NTg1MTA1N30.eBGQc3rp9-H4ipsCDhUdLTC7aJB6HHDh6CKwsvV9b3A';
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- BIẾN TRẠNG THÁI ---
let isModalOpen = false;
let needRefresh = false;

let rooms = [];
let bookings = [];
let services = []; 

let currentFilter = 'all';
let searchCriteria = null; 

// --- CÁC HÀM HỖ TRỢ (HELPER FUNCTIONS) ---
window.formatCur = function(input) { 
    let val = input.value.replace(/[^0-9]/g, ''); 
    input.value = val ? parseInt(val, 10).toLocaleString('en-US') : ''; 
}

window.getNum = function(val) { 
    return parseInt(String(val).replace(/,/g, ''), 10) || 0; 
}

window.numToStr = function(num) { 
    return (num || 0).toLocaleString('en-US'); 
}

window.getLocalISODate = function(d) { 
    const offset = d.getTimezoneOffset() * 60000; 
    return new Date(d.getTime() - offset).toISOString().substring(0, 10); 
}

window.getCurrentTimeStr = function() { 
    const now = new Date(); 
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; 
}

window.fmt = function(isoDateStr, includeTime = false) {
    if(!isoDateStr) return ''; 
    const parts = isoDateStr.replace(' ', 'T').split('T'); 
    const dArr = parts[0].split('-');
    if (dArr.length !== 3) return parts[0]; 
    const txt = `${dArr[2]}/${dArr[1]}/${dArr[0]}`;
    return (includeTime && parts.length > 1) ? `${parts[1].substring(0, 5)} - ${txt}` : txt;
}

window.checkOverdue = function(booking) {
    if (booking.type === 'grey' || !booking.end) return false;
    return new Date().getTime() > new Date(booking.end.replace(' ', 'T')).getTime();
}

const realTodayStr = window.getLocalISODate(new Date()); 
let currentViewDate = new Date(); 
currentViewDate.setHours(12, 0, 0, 0); 

// --- ĐỒNG BỘ THỜI GIAN THỰC (REALTIME) ---
_supabase.channel('public-changes').on('postgres_changes', { event: '*', schema: 'public' }, () => {
    if (isModalOpen) {
        needRefresh = true;
    } else {
        loadData();
    }
}).subscribe();

// --- TẢI DỮ LIỆU TỪ SUPABASE ---
async function loadData() {
    const { data: rms } = await _supabase.from('rooms').select('*').order('id', { ascending: true });
    const { data: bks } = await _supabase.from('bookings').select('*');
    const { data: svs } = await _supabase.from('services').select('*').order('name', { ascending: true });
    
    rooms = rms || []; 
    services = svs || []; 
    
    bookings = (bks || []).map(b => {
        if (b.start && b.start.includes(' ')) b.start = b.start.replace(' ', 'T');
        if (b.end && b.end.includes(' ')) b.end = b.end.replace(' ', 'T');
        return b;
    });
    
    render();
}

// --- HIỂN THỊ DỮ LIỆU (RENDER) ---
window.render = function() {
    renderDashboard();
    renderTimeline(); // Gọi hàm render Unified Table
}

window.renderDashboard = function() {
    const active = bookings.filter(b => {
        const bStartD = b.start ? b.start.substring(0, 10) : '';
        const bEndD = b.end ? b.end.substring(0, 10) : '';
        return realTodayStr >= bStartD && realTodayStr < bEndD && b.type === 'red';
    }).length;
    
    const totalRev = bookings.reduce((sum, b) => {
        const startCal = new Date((b.start ? b.start.substring(0, 10) : realTodayStr) + 'T00:00:00');
        const endCal = new Date((b.end ? b.end.substring(0, 10) : realTodayStr) + 'T00:00:00');
        const nights = Math.max((endCal - startCal) / 86400000, 1);
        const appliedPrice = b.price !== undefined ? b.price : (rooms.find(rm => rm.id === b.roomId)?.price || 0);
        const miniTotal = parseInt(b.minibar_total) || 0; 
        return sum + (nights * appliedPrice) + miniTotal; 
    }, 0);

    document.getElementById('topStats').innerHTML = `
        <div class="stat-card"><small>ĐANG Ở</small><b>${active}</b></div>
        <div class="stat-card"><small>TỔNG DOANH THU</small><b>${window.numToStr(totalRev/1000)}k</b></div>
    `;
}

// --- HÀM TẠO BẢNG ĐỒNG NHẤT (UNIFIED GRID) ---
window.renderTimeline = function() {
    const container = document.getElementById('mainTimeline');
    container.innerHTML = '';

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    document.getElementById('monthPicker').value = `${year}-${String(month + 1).padStart(2, '0')}`;
    document.getElementById('monthLabel').innerText = `${month + 1}/${year}`;

    let dateArr = [];
    for(let i = 1; i <= daysInMonth; i++) {
        dateArr.push(window.getLocalISODate(new Date(year, month, i, 12, 0, 0)));
    }
    const viewStartStr = dateArr[0];

    // Khởi tạo bảng Table
    let table = document.createElement('table');
    
    // 1. Tạo Header Ngày
    let thead = document.createElement('thead');
    let trHead = document.createElement('tr');
    
    trHead.innerHTML = `
        <th class="sticky-corner">
            <div style="font-size: 14px; font-weight: 800; color: var(--p-blue)">PHÒNG \\ NGÀY</div>
        </th>
    `;
    
    dateArr.forEach((ds, index) => {
        let d = new Date(year, month, index + 1);
        const isToday = ds === realTodayStr ? 'background: #fff9db; border-bottom: 3px solid var(--p-gold);' : '';
        
        trHead.innerHTML += `
            <th class="sticky-header" style="${isToday}">
                <div style="font-size: 12px; font-weight: normal; color: #555;">${d.toLocaleDateString('vi-VN', {weekday: 'short'})}</div>
                <div style="font-size: 14px; font-weight: bold; color: #1e293b;">${d.getDate()}/${d.getMonth()+1}</div>
            </th>
        `;
    });
    
    thead.appendChild(trHead);
    table.appendChild(thead);

    // 2. Tạo Body Lưới
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

        // Cột Thông tin Số Phòng
        const activeBk = bookings.find(b => {
            const bStartD = b.start ? b.start.substring(0, 10) : '';
            const bEndD = b.end ? b.end.substring(0, 10) : '';
            return b.roomId === r.id && realTodayStr >= bStartD && realTodayStr < bEndD && b.type === 'red';
        });
        
        let badgeColor = 'var(--s-green)';
        let sttText = 'Sạch - Sẵn sàng';
        
        if (activeBk) { 
            if (window.checkOverdue(activeBk)) {
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

        let thRoom = document.createElement('th');
        thRoom.className = 'sticky-col';
        thRoom.onclick = () => openRoomSettings(r.id);
        thRoom.innerHTML = `
            <div class="room-info" title="Nhấn để thiết lập phòng">
                <b>${r.id}</b>
                <span class="lb-code">${r.lockbox ? 'LB: ' + r.lockbox : 'Chưa có LB'}</span>
                <span class="r-price">${window.numToStr(r.price)}đ</span>
                <span class="r-notes">${r.notes || '---'}</span>
                <div class="badge-status" style="background:${badgeColor}" onclick="toggleDirty('${r.id}', event)" title="${sttText}"></div>
            </div>
        `;
        tr.appendChild(thRoom);

        // Các ô Lịch trình (Timeline Cells) ngang theo ngày
        dateArr.forEach(date => {
            let td = document.createElement('td');
            td.className = 'grid-cell';
            
            const b = bookings.find(bk => {
                const bkStartD = bk.start ? bk.start.substring(0, 10) : '';
                const bkEndD = bk.end ? bk.end.substring(0, 10) : '';
                return bk.roomId === r.id && (bkStartD === date || (date === viewStartStr && bkStartD < viewStartStr && bkEndD > viewStartStr));
            });

            if(b) {
                const startCal = new Date((b.start ? b.start.substring(0, 10) : realTodayStr) + 'T00:00:00');
                const endCal = new Date((b.end ? b.end.substring(0, 10) : realTodayStr) + 'T00:00:00');
                const duration = Math.max((endCal - startCal) / 86400000, 1);
                
                const width = (duration * (window.innerWidth <= 768 ? 70 : 100)) - 10;
                const label = b.type === 'grey' ? '(Đã xong)' : '';
                const depTxt = (b.deposit && b.deposit > 0) ? ` - Cọc: ${window.numToStr(b.deposit/1000)}k` : '';
                const isCross = (b.start ? b.start.substring(0, 10) : '') < viewStartStr ? 'border-radius: 0 8px 8px 0; border-left: 3px dashed #fff;' : '';
                const overdueCls = window.checkOverdue(b) ? ' tag-overdue' : '';

                td.innerHTML = `
                    <div class="booking-tag tag-${b.type}${overdueCls}" style="width: ${width}px; left: 5px; ${isCross}" onclick="openDetail('${b.id}')">
                        <div style="white-space:nowrap; overflow:hidden">${b.guest} ${label}</div>
                        <small>${duration} đêm${depTxt}</small>
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
}

// --- CÁC TÍNH NĂNG ĐIỀU HƯỚNG VÀ LỌC ---
window.changeMonth = function(delta) { 
    currentViewDate.setMonth(currentViewDate.getMonth() + delta); 
    render(); 
}

window.selectMonth = function() { 
    const parts = document.getElementById('monthPicker').value.split('-'); 
    if (parts) { 
        currentViewDate.setFullYear(parseInt(parts[0])); 
        currentViewDate.setMonth(parseInt(parts[1]) - 1); 
        render(); 
    } 
}

window.applyFilter = function() { 
    currentFilter = document.getElementById('roomFilter').value; 
    if (currentFilter !== 'search') { 
        searchCriteria = null; 
        let opt = document.getElementById('optSearch'); 
        if (opt) opt.style.display = 'none'; 
    } 
    render(); 
}

// --- QUẢN LÝ DỊCH VỤ / MINIBAR ---
window.openMinibarCatalog = function() {
    let html = `
        <div style="margin-bottom: 10px; font-size: 13px; color: #444;">
            Nhập trực tiếp vào ô để sửa dữ liệu tự động đồng bộ.
        </div>
        <div style="overflow-x:auto;">
        <table class="excel-table">
            <tr>
                <th>Tên mặt hàng</th>
                <th>Giá (VNĐ)</th>
                <th style="width: 50px; text-align:center;">Xóa</th>
            </tr>
    `;
    
    services.forEach((item) => {
        html += `
            <tr>
                <td><input type="text" value="${item.name}" onchange="updateCatalog('${item.id}', 'name', this.value)"></td>
                <td><input type="text" inputmode="numeric" value="${window.numToStr(item.price)}" oninput="formatCur(this)" onchange="updateCatalog('${item.id}', 'price', this.value)"></td>
                <td style="text-align: center;"><button style="background: #ffebee; color: var(--p-red);" onclick="deleteCatalog('${item.id}')">✕</button></td>
            </tr>
        `;
    });
    
    html += `
            <tr>
                <td><input type="text" id="newCatName" placeholder="Thêm món mới..." style="background: #f0f7ff;"></td>
                <td><input type="text" inputmode="numeric" id="newCatPrice" placeholder="Giá tiền..." style="background: #f0f7ff;" oninput="formatCur(this)"></td>
                <td style="text-align: center;"><button style="background: var(--s-green); color: white;" onclick="addCatalog()">+</button></td>
            </tr>
        </table>
        </div>
        <button class="btn btn-cancel" style="width:100%; margin-top:10px;" onclick="closeModal()">ĐÓNG LẠI</button>
    `;
    
    document.getElementById('mTitle').innerText = `Dịch vụ / Minibar`; 
    document.getElementById('mContent').innerHTML = html;
    document.getElementById('pmsModal').style.display = 'flex'; 
    isModalOpen = true; 
}

window.updateCatalog = async function(id, field, val) { 
    if(field === 'price') val = window.getNum(val); 
    await _supabase.from('services').update({ [field]: val }).eq('id', id); 
}

window.deleteCatalog = async function(id) { 
    if(confirm("Xóa dịch vụ này?")) { 
        await _supabase.from('services').delete().eq('id', id); 
        window.openMinibarCatalog(); 
    } 
}

window.addCatalog = async function() {
    let name = document.getElementById('newCatName').value.trim();
    let price = window.getNum(document.getElementById('newCatPrice').value);
    if(name) { 
        await _supabase.from('services').insert([{ id: 'SV'+Date.now(), name: name, price: price }]); 
        await loadData(); 
        window.openMinibarCatalog(); 
    }
}

// --- TÌM PHÒNG TRỐNG ---
window.openSearchModal = function() {
    let tmr = new Date(); 
    tmr.setDate(tmr.getDate() + 1);
    
    document.getElementById('mTitle').innerText = `Lọc phòng trống`;
    document.getElementById('mContent').innerHTML = `
        <div class="f-group">
            <label>Ngày Check-in</label>
            <div class="date-wrapper">
                <span class="date-label" id="lblSearchIn">${window.fmt(realTodayStr)}</span>
                <input id="sStart" type="date" value="${realTodayStr}" onchange="document.getElementById('lblSearchIn').innerText = fmt(this.value)">
            </div>
        </div>
        <div class="f-group">
            <label>Ngày Check-out</label>
            <div class="date-wrapper">
                <span class="date-label" id="lblSearchOut">${window.fmt(window.getLocalISODate(tmr))}</span>
                <input id="sEnd" type="date" value="${window.getLocalISODate(tmr)}" onchange="document.getElementById('lblSearchOut').innerText = fmt(this.value)">
            </div>
        </div>
        <div class="btn-row">
            <button class="btn btn-p" onclick="executeSearch()">TÌM PHÒNG</button>
            <button class="btn btn-cancel" onclick="closeModal()">HỦY</button>
        </div>
    `;
    document.getElementById('pmsModal').style.display = 'flex'; 
    isModalOpen = true;
}

window.executeSearch = function() {
    const sStart = document.getElementById('sStart').value;
    const sEnd = document.getElementById('sEnd').value;
    if (sStart >= sEnd) return alert("Ngày đi phải lớn hơn ngày đến!");
    
    searchCriteria = { start: sStart + 'T14:00', end: sEnd + 'T12:00' };
    
    let opt = document.getElementById('optSearch');
    if (!opt) {
        opt = document.createElement('option'); 
        opt.id = 'optSearch'; 
        opt.value = 'search'; 
        document.getElementById('roomFilter').appendChild(opt);
    }
    
    opt.text = `Lọc: ${window.fmt(sStart)} ➔ ${window.fmt(sEnd)}`; 
    opt.style.display = 'block';
    document.getElementById('roomFilter').value = 'search';
    currentFilter = 'search'; 
    
    window.closeModal(); 
    window.render();
}

// --- CÀI ĐẶT PHÒNG ---
window.openRoomSettings = function(rid) {
    const r = rooms.find(x => x.id === rid);
    document.getElementById('mTitle').innerText = `Cài đặt phòng`;
    document.getElementById('mContent').innerHTML = `
        <div class="f-group">
            <label>Tên / Số phòng</label>
            <input id="fRoomId" type="text" value="${r.id}">
        </div>
        <div class="flex-row" style="margin-bottom: 15px;">
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold;">Mã Lockbox</label>
                <input class="f-group" id="fRoomLockbox" type="text" value="${r.lockbox || ''}">
            </div>
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold;">Giá gốc / đêm</label>
                <input class="f-group" id="fRoomPrice" type="text" inputmode="numeric" value="${window.numToStr(r.price)}" oninput="formatCur(this)">
            </div>
        </div>
        <div class="f-group">
            <label>Ghi chú</label>
            <input id="fRoomNotes" type="text" value="${r.notes || ''}">
        </div>
        <div class="btn-row" style="margin-top: 25px;">
            <button class="btn btn-p" onclick="saveRoomSettings('${rid}')">LƯU THAY ĐỔI</button>
            <button class="btn btn-d" onclick="deleteRoom('${rid}')">XÓA</button>
            <button class="btn btn-cancel" onclick="closeModal()">HỦY</button>
        </div>
    `;
    document.getElementById('pmsModal').style.display = 'flex'; 
    isModalOpen = true;
}

window.saveRoomSettings = async function(oldRid) {
    const nId = document.getElementById('fRoomId').value.trim();
    const nPrice = window.getNum(document.getElementById('fRoomPrice').value);
    const nLb = document.getElementById('fRoomLockbox').value.trim();
    const nNotes = document.getElementById('fRoomNotes').value.trim();
    
    if(!nId) return alert("Tên không để trống!");
    if(nId !== oldRid && rooms.some(x => x.id === nId)) return alert("Tên bị trùng!");
    
    if(nId !== oldRid) {
        const r = rooms.find(x => x.id === oldRid);
        await _supabase.from('rooms').insert([{ id: nId, price: nPrice, cat: r.cat || "", status: r.status, lockbox: nLb, notes: nNotes }]);
        await _supabase.from('bookings').update({ roomId: nId }).eq('roomId', oldRid);
        await _supabase.from('rooms').delete().eq('id', oldRid);
    } else {
        await _supabase.from('rooms').update({ price: nPrice, lockbox: nLb, notes: nNotes }).eq('id', oldRid);
    }
    window.closeModal(); 
}

window.deleteRoom = async function(rid) { 
    if(confirm("Bạn muốn xóa phòng này?")) { 
        await _supabase.from('bookings').delete().eq('roomId', rid); 
        await _supabase.from('rooms').delete().eq('id', rid); 
        window.closeModal(); 
    } 
}

window.toggleDirty = async function(rid, event) { 
    if(event) event.stopPropagation(); 
    const r = rooms.find(x => x.id === rid); 
    await _supabase.from('rooms').update({ status: r.status === 'dirty' ? 'clean' : 'dirty' }).eq('id', rid); 
}

// --- ĐẶT PHÒNG ---
window.checkDepositStatus = function() { 
    const dep = window.getNum(document.getElementById('fDeposit').value);
    const sel = document.getElementById('fType'); 
    if (dep > 0 && sel.value === 'blue') sel.value = 'purple'; 
    else if (dep === 0 && sel.value === 'purple') sel.value = 'blue'; 
};

window.openBooking = function(roomId, date) {
    const r = rooms.find(x => x.id === roomId); 
    let nextDay = new Date(date); 
    nextDay.setDate(nextDay.getDate() + 1); 
    const endD = window.getLocalISODate(nextDay);
    
    document.getElementById('mTitle').innerText = `Đặt phòng ${roomId}`;
    document.getElementById('mContent').innerHTML = `
        <div class="f-group">
            <label>Khách hàng</label>
            <input id="fName" type="text" placeholder="Anh Minh">
        </div>
        <div class="f-group">
            <label>Số điện thoại</label>
            <input id="fPhone" type="tel" oninput="this.value = this.value.replace(/[^0-9+]/g, '')">
        </div>
        <div class="flex-row" style="margin-bottom: 15px;">
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold;">Ngày đến</label>
                <div class="date-wrapper">
                    <span class="date-label" id="lblBkStart">${window.fmt(date)}</span>
                    <input id="fStart" type="date" value="${date}" onchange="document.getElementById('lblBkStart').innerText = fmt(this.value)">
                </div>
            </div>
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold;">Ngày đi</label>
                <div class="date-wrapper">
                    <span class="date-label" id="lblBkEnd">${window.fmt(endD)}</span>
                    <input id="fEnd" type="date" value="${endD}" onchange="document.getElementById('lblBkEnd').innerText = fmt(this.value)">
                </div>
            </div>
        </div>
        <div class="flex-row" style="margin-bottom: 15px;">
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold;">Giá / Đêm</label>
                <input class="f-group" id="fPrice" type="text" inputmode="numeric" value="${window.numToStr(r.price)}" oninput="formatCur(this)">
            </div>
            <div class="flex-col">
                <label style="font-size: 12px; font-weight: bold;">Tiền cọc</label>
                <input class="f-group" id="fDeposit" type="text" inputmode="numeric" value="0" oninput="formatCur(this); checkDepositStatus();">
            </div>
        </div>
        <div class="f-group">
            <label>Trạng thái</label>
            <select id="fType">
                <option value="blue">Chưa cọc (Xanh)</option>
                <option value="purple">Đã đặt cọc (Tím)</option>
                <option value="red">Check-in luôn (Đỏ)</option>
            </select>
        </div>
        <button class="btn btn-p" style="width:100%; margin-top: 10px;" onclick="confirmBooking('${roomId}')">XÁC NHẬN ĐẶT</button>
    `;
    document.getElementById('pmsModal').style.display = 'flex'; 
    isModalOpen = true;
}

window.confirmBooking = async function(roomId) {
    const guest = document.getElementById('fName').value;
    const phone = document.getElementById('fPhone').value.trim();
    const startD = document.getElementById('fStart').value;
    const endD = document.getElementById('fEnd').value;
    const type = document.getElementById('fType').value;
    
    if(!guest || startD >= endD) return alert("Lỗi ngày tháng hoặc tên khách!");
    
    let startStr = `${startD}T${type === 'red' ? window.getCurrentTimeStr() : '14:00'}`;
    let endStr = `${endD}T12:00`;
    
    if(bookings.some(b => b.roomId === roomId && (startStr < b.end && endStr > b.start))) {
        return alert("Bị trùng lịch!");
    }
    
    await _supabase.from('bookings').insert([{ 
        id: 'BK'+Date.now(), 
        roomId: roomId, 
        guest: guest, 
        phone: phone, 
        start: startStr, 
        end: endStr, 
        type: type, 
        price: window.getNum(document.getElementById('fPrice').value), 
        deposit: window.getNum(document.getElementById('fDeposit').value), 
        minibar_total: 0, 
        minibar_items: JSON.stringify([]) 
    }]);
    
    window.closeModal(); 
}

// --- CHI TIẾT ĐẶT PHÒNG ---
window.updatePriceOnChange = function(newRid) { 
    const rm = rooms.find(x => x.id === newRid); 
    if (rm) document.getElementById('dPrice').value = window.numToStr(rm.price); 
};

window.openDetail = function(bid) {
    const b = bookings.find(x => x.id === bid); 
    if(!b) return; 
    
    const r = rooms.find(rm => rm.id === b.roomId);
    let bStart = b.start && b.start.includes('T') ? b.start : (b.start || realTodayStr) + 'T14:00';
    let bEnd = b.end && b.end.includes('T') ? b.end : (b.end || realTodayStr) + 'T12:00';
    
    const dStartInput = bStart.substring(0, 10);
    const dEndInput = bEnd.substring(0, 10);
    const nights = Math.max((new Date(dEndInput + 'T00:00:00') - new Date(dStartInput + 'T00:00:00')) / 86400000, 1);
    
    const appliedPrice = b.price !== undefined ? b.price : r.price;
    const deposit = b.deposit || 0;
    const roomCost = nights * appliedPrice;
    
    let miniItems = []; 
    try { 
        miniItems = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []); 
    } catch(e) {}
    
    let miniTotal = parseInt(b.minibar_total) || 0;
    let totalCost = roomCost + miniTotal;
    let remaining = totalCost - deposit;
    let isComp = b.type === 'grey';

    document.getElementById('mTitle').innerText = isComp ? "Lịch sử lưu trú" : "Chi tiết & Gia hạn";
    
    let miniHtml = isComp ? '' : `
        <div style="background:#fdfaf0; border: 1px solid #fcebb6; padding:15px; border-radius:12px; margin-bottom:15px;">
            <h4 style="margin: 0 0 10px 0; color: var(--p-blue); font-size: 14px;">🛒 Gọi Dịch vụ</h4>
            <div style="display:flex; gap:8px; margin-bottom: 12px;">
                <select id="mbItem" class="mb-select">
                    ${services.map(c => `<option value="${c.name}|${c.price}">${c.name}</option>`).join('')}
                </select>
                <input type="number" id="mbQty" class="mb-qty" value="1" min="1">
                <button class="mb-add-btn" onclick="addMbToBooking('${bid}')">+</button>
            </div>
            <div id="mbList" style="font-size: 14px; color: #444;">
                ${miniItems.map((m, i) => `
                    <div style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px dashed #e0e0e0;">
                        <span>${m.qty}x ${m.name}</span>
                        <span><b>${window.numToStr(m.qty * m.price)}đ</b> <span style="color:var(--p-red); cursor:pointer; font-weight:bold; margin-left:10px;" onclick="removeMb('${bid}', ${i})">✕</span></span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    let actionButtons = isComp ? `
        <button class="btn btn-d" style="grid-column: span 2" onclick="delBK('${bid}')">XÓA HẲN LỊCH SỬ</button>
        <button class="btn btn-cancel" onclick="closeModal()">ĐÓNG</button>
    ` : `
        ${b.type !== 'red' ? `<button class="btn btn-s" onclick="updateBK('${bid}','red')">CHECK-IN</button>` : ''}
        <button class="btn btn-p" style="background:var(--p-gold); color:#000" onclick="checkOut('${bid}')">CHECK-OUT & THU TIỀN</button>
        <button class="btn btn-d" onclick="delBK('${bid}')">HỦY</button>
        <button class="btn btn-cancel" onclick="closeModal()">ĐÓNG</button>
    `;

    let content = isComp ? `
        <div style="background:#f0f7ff; padding:15px; border-radius:12px;">
            <h2 style="margin:0">${b.guest}</h2>
            <p style="margin: 4px 0;">SĐT: <b>${b.phone || 'Không'}</b></p>
            <p style="margin: 4px 0;">Phòng: <b>${b.roomId}</b></p>
        </div>
    ` : `
        ${window.checkOverdue(b) ? `<div style="color:white; font-weight:bold; font-size: 13px; text-align:center; padding: 8px; margin-bottom: 12px; background: #ff9800; border-radius: 8px;">⚠️ KHÁCH ĐÃ QUÁ GIỜ CHECK-OUT!</div>` : ''}
        <div style="background:#f0f7ff; padding:15px; border-radius:12px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-bottom: 15px;">
                <div style="flex:1;">
                    <label style="font-size:12px; font-weight:bold; color:var(--p-blue);">Phòng (Đổi phòng)</label>
                    <select id="dRoomId" onchange="updatePriceOnChange(this.value)" style="padding: 8px; font-size: 16px; font-weight: bold; color: var(--p-blue); border: 2px solid var(--p-blue); border-radius: 8px; width: 100%;">
                        ${rooms.map(rm => `<option value="${rm.id}" ${rm.id === b.roomId ? 'selected' : ''}>Phòng ${rm.id}</option>`).join('')}
                    </select>
                </div>
                <div style="flex-shrink:0; margin-left:10px;">
                    ${r.lockbox ? `<b style="color:var(--s-purple); background:#f4e8f9; padding:2px 5px; border-radius:4px; font-size:11px;">LB: ${r.lockbox}</b>` : ''}
                </div>
            </div>
            
            <div class="flex-row" style="margin-bottom: 15px;">
                <div class="flex-col">
                    <label style="font-size: 12px; font-weight: bold;">Tên khách</label>
                    <input class="f-group" id="dName" type="text" value="${b.guest}">
                </div>
                <div class="flex-col">
                    <label style="font-size: 12px; font-weight: bold;">SĐT</label>
                    <input class="f-group" id="dPhone" type="tel" value="${b.phone || ''}">
                </div>
            </div>
            
            <div class="flex-row" style="margin-bottom: 15px;">
                <div class="flex-col">
                    <label style="font-size: 12px; font-weight: bold;">Ngày đến</label>
                    <div class="date-wrapper">
                        <span class="date-label" id="lblDetStart">${window.fmt(dStartInput)}</span>
                        <input id="dStart" type="date" value="${dStartInput}" onchange="document.getElementById('lblDetStart').innerText = fmt(this.value)">
                    </div>
                </div>
                <div class="flex-col">
                    <label style="font-size: 12px; font-weight: bold;">Ngày đi</label>
                    <div class="date-wrapper">
                        <span class="date-label" id="lblDetEnd">${window.fmt(dEndInput)}</span>
                        <input id="dEnd" type="date" value="${dEndInput}" onchange="document.getElementById('lblDetEnd').innerText = fmt(this.value)">
                    </div>
                </div>
            </div>
            
            <div class="flex-row">
                <div class="flex-col">
                    <label style="font-size: 12px; font-weight: bold;">Giá / Đêm</label>
                    <input class="f-group" id="dPrice" type="text" inputmode="numeric" value="${window.numToStr(appliedPrice)}" oninput="formatCur(this)">
                </div>
                <div class="flex-col">
                    <label style="font-size: 12px; font-weight: bold;">Tiền cọc</label>
                    <input class="f-group" id="dDeposit" type="text" inputmode="numeric" value="${window.numToStr(deposit)}" oninput="formatCur(this)">
                </div>
            </div>
            <button class="btn btn-p" style="width:100%; padding: 12px; margin-top:15px;" onclick="saveBookingChanges('${bid}')">💾 LƯU / ĐỔI PHÒNG</button>
        </div>
        ${miniHtml}
    `;
    
    document.getElementById('mContent').innerHTML = content + `
        <div class="bill-box">
            ${b.type === 'red' && !isComp ? `<div class="bill-row" style="color:var(--p-blue); font-size:13px; font-weight:bold; margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;"><span>⏱ Giờ vào:</span><span>${window.fmt(bStart, true)}</span></div>` : ''}
            ${isComp ? `<div class="bill-row" style="color:var(--p-red); font-size:13px; font-weight:bold; margin-bottom: 12px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;"><span>🚪 Giờ ra:</span><span>${window.fmt(bEnd, true)}</span></div>` : ''}
            <div class="bill-row">
                <span>Đơn giá (${nights} đêm):</span>
                <span>${window.numToStr(appliedPrice)}đ / đêm</span>
            </div>
            <div class="bill-row">
                <span>Tiền phòng:</span>
                <span>${window.numToStr(roomCost)}đ</span>
            </div>
            ${miniTotal > 0 ? `<div class="bill-row" style="color:var(--s-purple);"><span>Phụ thu Dịch vụ:</span><span>+ ${window.numToStr(miniTotal)}đ</span></div>` : ''}
            <div class="bill-row" style="color: var(--s-green);">
                <span>Đã đặt cọc:</span>
                <span>- ${window.numToStr(deposit)}đ</span>
            </div>
            <div class="bill-row total">
                <span>CÒN LẠI CẦN THU:</span>
                <span>${window.numToStr(remaining)}đ</span>
            </div>
        </div>
        <div class="btn-row">${actionButtons}</div>
    `;
    
    document.getElementById('pmsModal').style.display = 'flex'; 
    isModalOpen = true;
}

// --- GỌI & HỦY MINIBAR TRONG BOOKING ---
window.addMbToBooking = async function(bid) { 
    const b = bookings.find(x => x.id === bid);
    const [name, priceStr] = document.getElementById('mbItem').value.split('|');
    const price = parseInt(priceStr);
    const qty = parseInt(document.getElementById('mbQty').value) || 1; 
    
    let m = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []); 
    m.push({ name, price, qty }); 
    
    await _supabase.from('bookings').update({ 
        minibar_total: (parseInt(b.minibar_total) || 0) + (price * qty), 
        minibar_items: JSON.stringify(m) 
    }).eq('id', bid); 
    
    needRefresh = false; 
    await loadData(); 
    window.openDetail(bid); 
}

window.removeMb = async function(bid, idx) { 
    const b = bookings.find(x => x.id === bid); 
    let m = typeof b.minibar_items === 'string' ? JSON.parse(b.minibar_items) : (b.minibar_items || []); 
    const rm = m.splice(idx, 1)[0]; 
    
    await _supabase.from('bookings').update({ 
        minibar_total: Math.max((parseInt(b.minibar_total) || 0) - (rm.price * rm.qty), 0), 
        minibar_items: JSON.stringify(m) 
    }).eq('id', bid); 
    
    needRefresh = false; 
    await loadData(); 
    window.openDetail(bid); 
}

// --- CÁC HÀM CẬP NHẬT BOOKING ---
window.saveBookingChanges = async function(bid) { 
    const b = bookings.find(x => x.id === bid);
    const nId = document.getElementById('dRoomId').value;
    const nSt = `${document.getElementById('dStart').value}T${(b.start && b.start.includes('T')) ? b.start.substring(11, 16) : '14:00'}`;
    const nEn = `${document.getElementById('dEnd').value}T${(b.end && b.end.includes('T')) ? b.end.substring(11, 16) : '12:00'}`; 
    
    if(bookings.some(x => x.id !== bid && x.roomId === nId && (nSt < x.end && nEn > x.start))) {
        return alert("Lỗi trùng phòng!");
    }
    
    await _supabase.from('bookings').update({ 
        roomId: nId, 
        guest: document.getElementById('dName').value, 
        phone: document.getElementById('dPhone').value.trim(), 
        start: nSt, 
        end: nEn, 
        price: window.getNum(document.getElementById('dPrice').value), 
        deposit: window.getNum(document.getElementById('dDeposit').value) 
    }).eq('id', bid); 
    
    if (b.roomId !== nId && b.type === 'red') {
        await _supabase.from('rooms').update({ status: 'dirty' }).eq('id', b.roomId);
    }
    window.closeModal(); 
}

window.checkOut = async function(bid) { 
    if(confirm("Khách đã thanh toán đủ?")) { 
        const b = bookings.find(x => x.id === bid); 
        await _supabase.from('bookings').update({ 
            type: 'grey', 
            end: `${b.end ? b.end.substring(0, 10) : realTodayStr}T${window.getCurrentTimeStr()}` 
        }).eq('id', bid); 
        
        await _supabase.from('rooms').update({ status: 'dirty' }).eq('id', b.roomId); 
        window.closeModal(); 
    } 
}

window.updateBK = async function(bid, type) { 
    let dat = { type: type }; 
    if (type === 'red') {
        const b = bookings.find(x => x.id === bid);
        dat.start = `${b.start.substring(0, 10)}T${window.getCurrentTimeStr()}`;
    }
    await _supabase.from('bookings').update(dat).eq('id', bid); 
    window.closeModal(); 
}

window.delBK = async function(bid) { 
    if(confirm("Xóa lịch sử này?")) { 
        await _supabase.from('bookings').delete().eq('id', bid); 
        window.closeModal(); 
    } 
}

window.addRoom = async function() { 
    const id = prompt("Số phòng:");
    const price = prompt("Giá mỗi đêm:", "350000"); 
    if(id && price) {
        await _supabase.from('rooms').insert([{ 
            id: id, 
            price: window.getNum(price), 
            cat: "", 
            status: "clean", 
            lockbox: "", 
            notes: "" 
        }]);
    }
}

// --- XUẤT EXCEL TIMELINE ---
window.exportExcel = function() {
    if(bookings.length === 0 && rooms.length === 0) return alert("Không có dữ liệu!");
    
    const y = currentViewDate.getFullYear();
    const m = currentViewDate.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    
    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"></head>
        <body>
        <table border="1">
        <thead>
            <tr style="background:#f3f2f1; height:40px;">
                <th style="width:80px;">Mã LB</th>
                <th style="width:100px;">Tên Phòng</th>
                <th style="width:150px;">Ghi chú</th>
    `;
    
    for(let i=1; i<=dim; i++) {
        html += `<th style="width:150px;">${String(i).padStart(2,'0')}/${String(m+1).padStart(2,'0')}</th>`; 
    }
    
    html += `</tr></thead><tbody>`;
    
    rooms.forEach(r => {
        html += `
            <tr style="height:60px;">
                <td style="text-align:center; color:#8e44ad;">${r.lockbox||''}</td>
                <td style="text-align:center; background:#e8f5e9;">${r.id}</td>
                <td>${r.notes||''}</td>
        `;
        
        let d = 1; 
        while(d <= dim) {
            let cur = window.getLocalISODate(new Date(y, m, d, 12, 0, 0));
            let b = bookings.find(bk => {
                const bkSt = bk.start ? bk.start.substring(0, 10) : '';
                const bkEn = bk.end ? bk.end.substring(0, 10) : '';
                return bkSt <= cur && bkEn > cur && bk.roomId === r.id;
            });
            
            if(b) {
                let st = (b.start ? b.start.substring(0, 10) : '') < cur ? cur : (b.start ? b.start.substring(0, 10) : '');
                let en = (b.end ? b.end.substring(0, 10) : '') > window.getLocalISODate(new Date(y, m, dim, 12)) ? window.getLocalISODate(new Date(y, m, dim+1, 12)) : (b.end ? b.end.substring(0, 10) : '');
                
                let cs = Math.max((new Date(en+'T00:00:00') - new Date(st+'T00:00:00')) / 86400000, 1); 
                if (d + cs - 1 > dim) cs = dim - d + 1;
                
                let totalDays = Math.max((new Date((b.end ? b.end.substring(0, 10) : '') + 'T00:00:00') - new Date((b.start ? b.start.substring(0, 10) : '') + 'T00:00:00')) / 86400000, 1);
                let actualPrice = b.price !== undefined ? b.price : r.price;
                let mTotal = parseInt(b.minibar_total) || 0;
                
                let txt = `${b.guest} - Thu ${window.numToStr(((totalDays * actualPrice) + mTotal) / 1000)}k`;
                
                let bg = '#fff', c = '#fff'; 
                if(b.type === 'blue') bg = '#0071c2'; 
                if(b.type === 'purple') bg = '#a332c3'; 
                if(b.type === 'red') bg = '#d4111e'; 
                if(b.type === 'grey') { bg = '#bdc3c7'; c = '#333'; }
                
                html += `<td colspan="${cs}" style="background:${bg}; color:${c}; text-align:center; white-space:nowrap; font-weight:bold;">${txt}</td>`; 
                d += cs;
            } else { 
                html += `<td></td>`; 
                d++; 
            }
        } 
        html += `</tr>`;
    });
    
    html += `</tbody></table></body></html>`;
    
    let a = document.createElement("a"); 
    a.href = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' }));
    a.download = `T${String(m+1).padStart(2,'0')}_${y}_LICH_PHONG.xls`; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
}

// --- ĐÓNG MODAL THÔNG MINH ---
window.closeModal = function() { 
    document.getElementById('pmsModal').style.display = 'none'; 
    isModalOpen = false; 
    if (needRefresh) { 
        needRefresh = false; 
        loadData(); 
    } 
}

// --- KHỞI CHẠY APP ---
loadData();