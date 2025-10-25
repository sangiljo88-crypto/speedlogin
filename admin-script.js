// ==================== Firebase 설정 ====================
const firebaseConfig = {
  apiKey: "AIzaSyA7eBsXhWAZBvaus9aovVf0GQeMEzvr1R4",
  authDomain: "speedlanding-dc186.firebaseapp.com",
  projectId: "speedlanding-dc186",
  storageBucket: "speedlanding-dc186.firebasestorage.app",
  messagingSenderId: "392587509521",
  appId: "1:392587509521:web:2679d3da4f9bb2e23156b0",
  measurementId: "G-ZG0N9R3LGF"
};

const GAS_URL = "/.netlify/functions/sheets-proxy";
const ADMIN_EMAIL = "jsicoffee@naver.com";
const TAX_RATE = 0.033;

try {
  firebase.initializeApp(firebaseConfig);
  console.log("✅ Firebase 초기화 성공");
} catch (error) {
  console.error("❌ Firebase 초기화 오류:", error);
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let allDbs = [];
let partnersData = {};
let partnerStats = [];
let settlementData = [];
let currentApprovalData = null;

// ==================== 로그인 체크 ====================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('admin-email').textContent = user.email;
        
        if (user.email !== ADMIN_EMAIL) {
            alert("관리자 권한이 없습니다.");
            auth.signOut();
            window.location.href = "index.html";
            return;
        }
        
        loadPartnersData();
        loadAllDbs();
        initializeMonthSelects();
    } else {
        window.location.href = "index.html";
    }
});

// ==================== 로그아웃 ====================
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
});

// ==================== 탭 전환 ====================
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // 탭 버튼 활성화
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // 탭 컨텐츠 표시
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // 탭별 데이터 로드
        if (tabName === 'partners') {
            loadPartnerStats();
        } else if (tabName === 'settlement') {
            loadSettlementData();
        }
    });
});

// ==================== 월 선택 초기화 ====================
function initializeMonthSelects() {
    const now = new Date();
    
    // 영업자별 관리 월 선택
    const partnerSelect = document.getElementById('partnerMonth');
    for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const text = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        partnerSelect.appendChild(option);
    }
    
    // 월별 정산 관리 월 선택
    const settlementSelect = document.getElementById('settlementMonth');
    for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const text = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        settlementSelect.appendChild(option);
    }
    
    // 이벤트 리스너
    partnerSelect.addEventListener('change', loadPartnerStats);
    document.getElementById('partnerSearch').addEventListener('input', filterPartnerStats);
    document.getElementById('partnerSort').addEventListener('change', filterPartnerStats);
    settlementSelect.addEventListener('change', loadSettlementData);
}

// ==================== 파트너 데이터 로드 ====================
async function loadPartnersData() {
    try {
        const snapshot = await db.collection('users').where('referralCode', '!=', null).get();
        const container = document.getElementById('partnersContainer');
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-sm text-gray-500">등록된 파트너가 없습니다.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.referralCode) return;
            
            partnersData[data.referralCode] = {
                id: doc.id,
                email: data.email,
                fullName: data.fullName || data.username || '',
                commissionRate: data.commissionRate || 20
            };

            const partnerDiv = document.createElement('div');
            partnerDiv.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
            partnerDiv.innerHTML = `
                <div>
                    <div class="font-medium">${data.email}</div>
                    <div class="text-xs text-gray-500">코드: ${data.referralCode}</div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" 
                           value="${data.commissionRate || 20}" 
                           min="0" max="100" step="1"
                           data-partner-id="${doc.id}"
                           data-ref-code="${data.referralCode}"
                           class="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                           placeholder="20">
                    <span class="text-sm text-gray-600">%</span>
                    <button onclick="updateCommissionRate('${doc.id}', '${data.referralCode}')" 
                            class="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
                        저장
                    </button>
                </div>
            `;
            container.appendChild(partnerDiv);
        });

    } catch (error) {
        console.error("파트너 데이터 로드 실패:", error);
    }
}

// ==================== 수익률 업데이트 ====================
window.updateCommissionRate = async function(partnerId, refCode) {
    const input = document.querySelector(`input[data-partner-id="${partnerId}"]`);
    const rate = parseInt(input.value);

    if (isNaN(rate) || rate < 0 || rate > 100) {
        alert('수익률은 0~100 사이의 숫자여야 합니다.');
        return;
    }

    try {
        await db.collection('users').doc(partnerId).update({
            commissionRate: rate
        });

        partnersData[refCode].commissionRate = rate;
        showSuccess(`수익률이 ${rate}%로 업데이트되었습니다.`);
    } catch (error) {
        console.error('수익률 업데이트 실패:', error);
        alert('수익률 업데이트에 실패했습니다.');
    }
};

// ==================== DB 목록 로드 ====================
async function loadAllDbs() {
    try {
        showLoading(true);
        hideError();

        const response = await fetch(`${GAS_URL}?action=getAllDbs`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || "데이터를 불러올 수 없습니다.");
        }

        allDbs = result.data;
        renderTable();
        showLoading(false);

    } catch (error) {
        console.error("DB 로드 실패:", error);
        showError("데이터를 불러오는데 실패했습니다: " + error.message);
        showLoading(false);
    }
}

// ==================== 테이블 렌더링 ====================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (allDbs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">아직 유입된 DB가 없습니다.</td></tr>';
        document.getElementById('tableContainer').classList.remove('hidden');
        return;
    }

    allDbs.forEach(db => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = db.status === '승인됨' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const statusText = db.status || '대기중';
        
        const saleAmount = db.saleAmount ? `₩${parseInt(db.saleAmount).toLocaleString()}` : '미입력';
        const finalAmount = db.finalAmount ? `₩${parseInt(db.finalAmount).toLocaleString()}` : '₩0';

        row.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-900">${db.submittedAt || 'N/A'}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${db.customerName || 'N/A'}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${db.referralCode || 'N/A'}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${saleAmount}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${finalAmount}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4">
                <button onclick="openApprovalModal(${db.rowNumber})" 
                        class="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    ${db.status === '승인됨' ? '수정' : '승인'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('tableContainer').classList.remove('hidden');
}

// ==================== 승인 모달 ====================
window.openApprovalModal = function(rowNumber) {
    const db = allDbs.find(d => d.rowNumber === rowNumber);
    if (!db) return;

    currentApprovalData = {
        rowNumber: rowNumber,
        customerName: db.customerName,
        referralCode: db.referralCode,
        commissionRate: partnersData[db.referralCode]?.commissionRate || 20,
        saleAmount: db.saleAmount || 0
    };

    document.getElementById('modalCustomerName').textContent = db.customerName || 'N/A';
    document.getElementById('modalRefCode').textContent = db.referralCode || 'N/A';
    document.getElementById('saleAmountInput').value = db.saleAmount || '';
    
    if (db.saleAmount) {
        calculateAndShow();
    } else {
        document.getElementById('calculationArea').classList.add('hidden');
    }

    document.getElementById('approvalModal').style.display = 'block';
};

document.getElementById('saleAmountInput').addEventListener('input', function() {
    const saleAmount = parseInt(this.value);
    if (saleAmount > 0) {
        calculateAndShow();
    } else {
        document.getElementById('calculationArea').classList.add('hidden');
    }
});

function calculateAndShow() {
    const saleAmount = parseInt(document.getElementById('saleAmountInput').value) || 0;
    if (saleAmount <= 0) return;

    const commissionRate = currentApprovalData.commissionRate / 100;
    const commission = Math.round(saleAmount * commissionRate);
    const tax = Math.round(commission * TAX_RATE);
    const finalAmount = commission - tax;

    document.getElementById('calcSaleAmount').textContent = `₩${saleAmount.toLocaleString()}`;
    document.getElementById('calcCommissionRate').textContent = `${currentApprovalData.commissionRate}%`;
    document.getElementById('calcCommission').textContent = `₩${commission.toLocaleString()}`;
    document.getElementById('calcTax').textContent = `-₩${tax.toLocaleString()}`;
    document.getElementById('calcFinalAmount').textContent = `₩${finalAmount.toLocaleString()}`;

    document.getElementById('calculationArea').classList.remove('hidden');
}

document.getElementById('modalCancelBtn').addEventListener('click', () => {
    document.getElementById('approvalModal').style.display = 'none';
    currentApprovalData = null;
});

document.getElementById('modalApproveBtn').addEventListener('click', async () => {
    const saleAmount = parseInt(document.getElementById('saleAmountInput').value);
    
    if (!saleAmount || saleAmount <= 0) {
        alert('판매금액을 입력해주세요.');
        return;
    }

    const commissionRate = currentApprovalData.commissionRate;
    const commission = Math.round(saleAmount * (commissionRate / 100));
    const tax = Math.round(commission * TAX_RATE);
    const finalAmount = commission - tax;

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateDbStatus',
                rowNumber: currentApprovalData.rowNumber,
                status: '승인됨',
                saleAmount: saleAmount,
                commissionRate: commissionRate,
                commission: commission,
                withholdingTax: tax,
                finalAmount: finalAmount
            })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('approvalModal').style.display = 'none';
            showSuccess('승인이 완료되었습니다!');
            loadAllDbs();
        } else {
            throw new Error(result.message || '승인 실패');
        }
    } catch (error) {
        console.error('승인 실패:', error);
        alert('승인에 실패했습니다: ' + error.message);
    }
});

// ==================== 영업자별 통계 ====================
async function loadPartnerStats() {
    const month = document.getElementById('partnerMonth').value;
    
    try {
        showPartnerLoading(true);
        hidePartnerError();

        const response = await fetch(`${GAS_URL}?action=getPartnerStats&month=${month}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || "영업자 데이터를 불러올 수 없습니다.");
        }

        partnerStats = result.data;
        filterPartnerStats();
        showPartnerLoading(false);

    } catch (error) {
        console.error("영업자 데이터 로드 실패:", error);
        showPartnerError("영업자 데이터를 불러오는데 실패했습니다: " + error.message);
        showPartnerLoading(false);
    }
}

function filterPartnerStats() {
    const searchTerm = document.getElementById('partnerSearch').value.toLowerCase();
    const sortBy = document.getElementById('partnerSort').value;
    
    // 검색 필터
    let filtered = partnerStats.filter(stat => {
        const refCode = stat.referralCode.toLowerCase();
        const fullName = (partnersData[stat.referralCode]?.fullName || '').toLowerCase();
        return refCode.includes(searchTerm) || fullName.includes(searchTerm);
    });
    
    // 정렬
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'sales-desc':
                return b.totalSales - a.totalSales;
            case 'sales-asc':
                return a.totalSales - b.totalSales;
            case 'code-asc':
                return a.referralCode.localeCompare(b.referralCode);
            case 'code-desc':
                return b.referralCode.localeCompare(a.referralCode);
            case 'date-asc':
                return (a.paymentDate || '').localeCompare(b.paymentDate || '');
            case 'date-desc':
                return (b.paymentDate || '').localeCompare(a.paymentDate || '');
            default:
                return 0;
        }
    });
    
    renderPartnerTable(filtered);
}

function renderPartnerTable(stats) {
    const tbody = document.getElementById('partnerTableBody');
    tbody.innerHTML = '';

    if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">데이터가 없습니다.</td></tr>';
        document.getElementById('partnerTableContainer').classList.remove('hidden');
        return;
    }

    stats.forEach(stat => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const fullName = partnersData[stat.referralCode]?.fullName || '-';
        const paymentDate = stat.paymentDate ? `${stat.paymentDate} (익월 10일)` : '-';

        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${stat.referralCode}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${fullName}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${stat.dbCount}건</td>
            <td class="px-6 py-4 text-sm text-gray-900">₩${stat.totalSales.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-blue-600 font-semibold">₩${stat.totalCommission.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-red-600">-₩${stat.totalTax.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-green-600 font-bold">₩${stat.totalFinalAmount.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${paymentDate}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('partnerTableContainer').classList.remove('hidden');
}

// ==================== 월별 정산 ====================
async function loadSettlementData() {
    const month = document.getElementById('settlementMonth').value;
    if (!month) return;

    try {
        showSettlementLoading(true);
        hideSettlementError();

        const response = await fetch(`${GAS_URL}?action=getMonthlySettlement&month=${month}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || "정산 데이터를 불러올 수 없습니다.");
        }

        settlementData = result.data;
        renderSettlementTable();
        showSettlementLoading(false);

    } catch (error) {
        console.error("정산 데이터 로드 실패:", error);
        showSettlementError("정산 데이터를 불러오는데 실패했습니다: " + error.message);
        showSettlementLoading(false);
    }
}

function renderSettlementTable() {
    const tbody = document.getElementById('settlementTableBody');
    tbody.innerHTML = '';

    if (settlementData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">해당 월에 정산할 데이터가 없습니다.</td></tr>';
        document.getElementById('settlementTableContainer').classList.remove('hidden');
        return;
    }

    settlementData.forEach(item => {
        const row = document.createElement('tr');
        const allPaid = item.paidCount === item.dbCount;
        row.className = allPaid ? 'paid-row' : 'hover:bg-gray-50';

        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.referralCode}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${item.dbCount}건</td>
            <td class="px-6 py-4 text-sm text-gray-900">₩${item.totalSales.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-blue-600 font-semibold">₩${item.totalCommission.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-red-600">-₩${item.totalTax.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm text-green-600 font-bold">₩${item.totalFinalAmount.toLocaleString()}</td>
            <td class="px-6 py-4 text-sm">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${allPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                    ${item.paidCount}/${item.dbCount} 완료
                </span>
            </td>
            <td class="px-6 py-4">
                <button onclick="openSettlementDetail('${item.referralCode}')" 
                        class="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    상세보기
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('settlementTableContainer').classList.remove('hidden');
}

window.openSettlementDetail = function(refCode) {
    const item = settlementData.find(s => s.referralCode === refCode);
    if (!item) return;

    document.getElementById('detailRefCode').textContent = refCode;

    const tableHtml = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">DB 유입일</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">승인일</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">고객명</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">판매금액</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">정산액</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">입금여부</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${item.details.map(detail => {
                    const paid = detail.paymentStatus === '입금완료';
                    return `
                        <tr class="${paid ? 'bg-gray-100' : ''}">
                            <td class="px-4 py-2 text-sm">${detail.submittedAt || 'N/A'}</td>
                            <td class="px-4 py-2 text-sm">${detail.approvedAt ? new Date(detail.approvedAt).toLocaleDateString('ko-KR') : 'N/A'}</td>
                            <td class="px-4 py-2 text-sm">${detail.customerName || 'N/A'}</td>
                            <td class="px-4 py-2 text-sm">₩${(detail.saleAmount || 0).toLocaleString()}</td>
                            <td class="px-4 py-2 text-sm text-green-600 font-semibold">₩${(detail.finalAmount || 0).toLocaleString()}</td>
                            <td class="px-4 py-2 text-sm">
                                <input type="checkbox" 
                                       ${paid ? 'checked' : ''}
                                       onchange="togglePaymentStatus(${detail.rowNumber}, this.checked)"
                                       class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                                <span class="ml-2 text-xs ${paid ? 'text-green-600' : 'text-gray-500'}">
                                    ${paid ? '입금완료' : '대기중'}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('settlementDetailTable').innerHTML = tableHtml;
    document.getElementById('settlementDetailModal').style.display = 'block';
};

window.togglePaymentStatus = async function(rowNumber, checked) {
    const paymentStatus = checked ? '입금완료' : '대기중';
    
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updatePaymentStatus',
                rowNumber: rowNumber,
                paymentStatus: paymentStatus,
                paymentDate: checked ? new Date().toISOString() : null
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ 입금 상태 업데이트 성공');
            loadSettlementData(); // 정산 데이터 새로고침
        } else {
            throw new Error(result.message || '업데이트 실패');
        }
    } catch (error) {
        console.error('입금 상태 업데이트 실패:', error);
        alert('입금 상태 업데이트에 실패했습니다.');
    }
};

document.getElementById('detailModalCloseBtn').addEventListener('click', () => {
    document.getElementById('settlementDetailModal').style.display = 'none';
});

// ==================== UI 헬퍼 ====================
function showLoading(show) {
    document.getElementById('loadingArea').classList.toggle('hidden', !show);
}

function showError(message) {
    const errorArea = document.getElementById('errorArea');
    errorArea.textContent = message;
    errorArea.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorArea').classList.add('hidden');
}

function showSuccess(message) {
    const successArea = document.getElementById('successArea');
    successArea.textContent = message;
    successArea.classList.remove('hidden');
    setTimeout(() => successArea.classList.add('hidden'), 3000);
}

function showPartnerLoading(show) {
    document.getElementById('partnerLoadingArea').classList.toggle('hidden', !show);
}

function showPartnerError(message) {
    const errorArea = document.getElementById('partnerErrorArea');
    errorArea.textContent = message;
    errorArea.classList.remove('hidden');
}

function hidePartnerError() {
    document.getElementById('partnerErrorArea').classList.add('hidden');
}

function showSettlementLoading(show) {
    document.getElementById('settlementLoadingArea').classList.toggle('hidden', !show);
}

function showSettlementError(message) {
    const errorArea = document.getElementById('settlementErrorArea');
    errorArea.textContent = message;
    errorArea.classList.remove('hidden');
}

function hideSettlementError() {
    document.getElementById('settlementErrorArea').classList.add('hidden');
}
