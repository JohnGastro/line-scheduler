let targets = [];
let schedules = [];

document.addEventListener('DOMContentLoaded', () => {
    checkConfiguration();
    loadTargets();
    loadSchedules();
    loadHistory();
    initializeDebugTab();
    
    // フォームイベントリスナー
    document.getElementById('schedule-form').addEventListener('submit', handleScheduleSubmit);
    document.getElementById('target-form').addEventListener('submit', handleTargetSubmit);
    
    // 送信先タイプ変更時の処理
    const targetTypeRadios = document.querySelectorAll('input[name="targetType"]');
    targetTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleTargetTypeChange);
    });
    
    // 簡単設定の初期表示
    updateSimpleSchedule();
    
    // 簡単設定の変更監視
    document.getElementById('frequency').addEventListener('change', updateSimpleSchedule);
    document.getElementById('weekday').addEventListener('change', updateSimpleSchedule);
    document.getElementById('monthday').addEventListener('change', updateSimpleSchedule);
    document.getElementById('specific-date').addEventListener('change', updateSimpleSchedule);
    document.getElementById('hour').addEventListener('change', updateSimpleSchedule);
    document.getElementById('minute').addEventListener('change', updateSimpleSchedule);
});

// タブ切り替え
function showTab(tabName) {
    // すべてのタブコンテンツとボタンを非アクティブに
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 選択されたタブをアクティブに
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // データを再読み込み
    if (tabName === 'schedules') loadSchedules();
    if (tabName === 'targets') loadTargets();
    if (tabName === 'history') loadHistory();
}

// 設定チェック
async function checkConfiguration() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (!data.configured) {
            document.getElementById('config-warning').style.display = 'block';
        }
    } catch (error) {
        console.error('設定の確認に失敗しました:', error);
    }
}

// 送信先タイプ変更時の処理
function handleTargetTypeChange(e) {
    const targetSelectGroup = document.getElementById('target-select-group');
    if (e.target.value === 'broadcast') {
        targetSelectGroup.style.display = 'none';
    } else {
        targetSelectGroup.style.display = 'block';
        updateTargetSelect(e.target.value);
    }
}

// 送信先セレクトボックスの更新
function updateTargetSelect(type) {
    const select = document.getElementById('target-select');
    select.innerHTML = '<option value="">選択してください</option>';
    
    const filteredTargets = targets.filter(t => t.type === type);
    filteredTargets.forEach(target => {
        const option = document.createElement('option');
        option.value = target.lineId;
        option.textContent = target.name;
        select.appendChild(option);
    });
}

// Cron式のプリセット設定
function setCronExpression(expression) {
    document.getElementById('cron-expression').value = expression;
}

// 送信先の読み込み
async function loadTargets() {
    try {
        const response = await fetch('/api/targets');
        targets = await response.json();
        displayTargets();
        updateTargetSelect('individual');
    } catch (error) {
        console.error('送信先の読み込みに失敗しました:', error);
    }
}

// 送信先の表示
function displayTargets() {
    const container = document.getElementById('targets-list');
    
    if (targets.length === 0) {
        container.innerHTML = '<div class="empty-state">送信先が登録されていません</div>';
        return;
    }
    
    container.innerHTML = targets.map(target => `
        <div class="list-item">
            <h3>${escapeHtml(target.name)}</h3>
            <p><strong>タイプ:</strong> ${target.type === 'individual' ? '個人' : 'グループ'}</p>
            <p><strong>LINE ID:</strong> ${escapeHtml(target.lineId)}</p>
            ${target.description ? `<p><strong>説明:</strong> ${escapeHtml(target.description)}</p>` : ''}
            <div class="actions">
                <button class="action-btn danger" onclick="deleteTarget('${target.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

// スケジュールの読み込み
async function loadSchedules() {
    try {
        const response = await fetch('/api/schedules');
        schedules = await response.json();
        displaySchedules();
    } catch (error) {
        console.error('スケジュールの読み込みに失敗しました:', error);
    }
}

// スケジュールの表示
function displaySchedules() {
    const container = document.getElementById('schedules-list');
    
    if (schedules.length === 0) {
        container.innerHTML = '<div class="empty-state">スケジュールが登録されていません</div>';
        return;
    }
    
    container.innerHTML = schedules.map(schedule => `
        <div class="list-item">
            <h3>${escapeHtml(schedule.name)}</h3>
            <p><strong>メッセージ:</strong> ${escapeHtml(schedule.message)}</p>
            <p><strong>送信先:</strong> ${getTargetDisplay(schedule)}</p>
            <p><strong>スケジュール:</strong> ${escapeHtml(schedule.cronExpression)}</p>
            <p>
                <span class="status ${schedule.isActive ? 'active' : 'inactive'}">
                    ${schedule.isActive ? '有効' : '無効'}
                </span>
            </p>
            <div class="actions">
                <button class="action-btn primary" onclick="runSchedule('${schedule.id}')">今すぐ実行</button>
                <button class="action-btn secondary" onclick="toggleSchedule('${schedule.id}', ${!schedule.isActive})">
                    ${schedule.isActive ? '無効化' : '有効化'}
                </button>
                <button class="action-btn danger" onclick="deleteSchedule('${schedule.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

// 送信履歴の読み込み
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const history = await response.json();
        displayHistory(history);
    } catch (error) {
        console.error('履歴の読み込みに失敗しました:', error);
    }
}

// 送信履歴の表示
function displayHistory(history) {
    const container = document.getElementById('history-list');
    
    if (history.length === 0) {
        container.innerHTML = '<div class="empty-state">送信履歴がありません</div>';
        return;
    }
    
    container.innerHTML = history.map(item => `
        <div class="list-item">
            <h3>${item.Schedule ? escapeHtml(item.Schedule.name) : 'スケジュール削除済み'}</h3>
            <p><strong>送信日時:</strong> ${formatDateTime(item.sentAt)}</p>
            <p><strong>メッセージ:</strong> ${escapeHtml(item.message)}</p>
            <p><strong>送信先:</strong> ${getTargetDisplayFromHistory(item)}</p>
            <p>
                <span class="status ${item.status}">
                    ${item.status === 'success' ? '成功' : '失敗'}
                </span>
            </p>
            ${item.error ? `<p><strong>エラー:</strong> ${escapeHtml(item.error)}</p>` : ''}
        </div>
    `).join('');
}

// 送信先の表示文字列を取得
function getTargetDisplay(schedule) {
    if (schedule.targetType === 'broadcast') {
        return '全体配信';
    }
    const target = targets.find(t => t.lineId === schedule.targetId);
    if (target) {
        return `${target.name} (${schedule.targetType === 'individual' ? '個人' : 'グループ'})`;
    }
    return `${schedule.targetId} (${schedule.targetType === 'individual' ? '個人' : 'グループ'})`;
}

function getTargetDisplayFromHistory(item) {
    if (item.targetType === 'broadcast') {
        return '全体配信';
    }
    const target = targets.find(t => t.lineId === item.targetId);
    if (target) {
        return `${target.name} (${item.targetType === 'individual' ? '個人' : 'グループ'})`;
    }
    return `${item.targetId} (${item.targetType === 'individual' ? '個人' : 'グループ'})`;
}

// スケジュール送信ハンドラ
async function handleScheduleSubmit(e) {
    e.preventDefault();
    
    const targetType = document.querySelector('input[name="targetType"]:checked').value;
    const targetId = targetType === 'broadcast' ? null : document.getElementById('target-select').value;
    
    if ((targetType === 'individual' || targetType === 'group') && !targetId) {
        alert('送信先を選択してください');
        return;
    }
    
    const data = {
        name: document.getElementById('schedule-name').value,
        message: document.getElementById('schedule-message').value,
        targetType: targetType,
        targetId: targetId,
        cronExpression: document.getElementById('cron-expression').value,
        isActive: true
    };
    
    try {
        const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('スケジュールを作成しました');
            e.target.reset();
            loadSchedules();
        } else {
            const error = await response.json();
            alert('エラー: ' + error.error);
        }
    } catch (error) {
        alert('スケジュールの作成に失敗しました');
    }
}

// 送信先登録ハンドラ
async function handleTargetSubmit(e) {
    e.preventDefault();
    
    const data = {
        name: document.getElementById('target-name').value,
        lineId: document.getElementById('target-line-id').value,
        type: document.querySelector('input[name="targetTypeRegister"]:checked').value,
        description: document.getElementById('target-description').value
    };
    
    try {
        const response = await fetch('/api/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('送信先を登録しました');
            e.target.reset();
            loadTargets();
        } else {
            const error = await response.json();
            alert('エラー: ' + error.error);
        }
    } catch (error) {
        alert('送信先の登録に失敗しました');
    }
}

// スケジュールの手動実行
async function runSchedule(id) {
    if (!confirm('このスケジュールを今すぐ実行しますか？')) return;
    
    try {
        const response = await fetch(`/api/schedules/${id}/run`, {
            method: 'POST'
        });
        
        const result = await response.json();
        if (result.success) {
            alert('通知を送信しました');
            loadHistory();
        } else {
            alert('送信に失敗しました: ' + (result.error || '不明なエラー'));
        }
    } catch (error) {
        alert('実行に失敗しました');
    }
}

// スケジュールの有効/無効切り替え
async function toggleSchedule(id, isActive) {
    try {
        const response = await fetch(`/api/schedules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive })
        });
        
        if (response.ok) {
            loadSchedules();
        } else {
            alert('更新に失敗しました');
        }
    } catch (error) {
        alert('更新に失敗しました');
    }
}

// スケジュールの削除
async function deleteSchedule(id) {
    if (!confirm('このスケジュールを削除しますか？')) return;
    
    try {
        const response = await fetch(`/api/schedules/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadSchedules();
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        alert('削除に失敗しました');
    }
}

// 送信先の削除
async function deleteTarget(id) {
    if (!confirm('この送信先を削除しますか？')) return;
    
    try {
        const response = await fetch(`/api/targets/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTargets();
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        alert('削除に失敗しました');
    }
}

// 日時フォーマット
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP');
}

// スケジュールモードの切り替え
function toggleScheduleMode() {
    const mode = document.querySelector('input[name="scheduleMode"]:checked').value;
    const simpleSchedule = document.getElementById('simple-schedule');
    const advancedSchedule = document.getElementById('advanced-schedule');
    
    if (mode === 'simple') {
        simpleSchedule.style.display = 'block';
        advancedSchedule.style.display = 'none';
        updateSimpleSchedule();
    } else {
        simpleSchedule.style.display = 'none';
        advancedSchedule.style.display = 'block';
    }
}

// 簡単設定の更新
function updateSimpleSchedule() {
    const frequency = document.getElementById('frequency').value;
    const weekdayGroup = document.getElementById('weekday-group');
    const monthdayGroup = document.getElementById('monthday-group');
    const specificDateGroup = document.getElementById('specific-date-group');
    
    // 表示/非表示の制御
    weekdayGroup.style.display = frequency === 'weekly' ? 'block' : 'none';
    monthdayGroup.style.display = frequency === 'monthly' ? 'block' : 'none';
    specificDateGroup.style.display = frequency === 'once' ? 'block' : 'none';
    
    // プレビューとCron式の生成
    generateCronFromSimple();
}

// 簡単設定からCron式を生成
function generateCronFromSimple() {
    const frequency = document.getElementById('frequency').value;
    const hour = document.getElementById('hour').value;
    const minute = document.getElementById('minute').value;
    const weekday = document.getElementById('weekday').value;
    const monthday = document.getElementById('monthday').value;
    const specificDate = document.getElementById('specific-date').value;
    
    let cronExpression = '';
    let previewText = '';
    
    switch (frequency) {
        case 'once':
            if (specificDate) {
                const date = new Date(specificDate);
                const day = date.getDate();
                const month = date.getMonth() + 1;
                const year = date.getFullYear();
                
                // 特定の日付のCron式: 分 時 日 月 曜日 年
                cronExpression = `${minute} ${hour} ${day} ${month} * ${year}`;
                previewText = `${year}年${month}月${day}日 ${hour}:${minute.padStart(2, '0')}（1回のみ）`;
            } else {
                cronExpression = '';
                previewText = '日付を選択してください';
            }
            break;
        case 'daily':
            cronExpression = `${minute} ${hour} * * *`;
            previewText = `毎日${hour}:${minute.padStart(2, '0')}`;
            break;
        case 'weekdays':
            cronExpression = `${minute} ${hour} * * 1-5`;
            previewText = `平日${hour}:${minute.padStart(2, '0')}`;
            break;
        case 'weekly':
            const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
            cronExpression = `${minute} ${hour} * * ${weekday}`;
            previewText = `毎週${weekdayNames[weekday]}曜日${hour}:${minute.padStart(2, '0')}`;
            break;
        case 'monthly':
            if (monthday && monthday !== '') {
                if (monthday === '31') {
                    cronExpression = `${minute} ${hour} 28-31 * *`;
                    previewText = `毎月末${hour}:${minute.padStart(2, '0')}`;
                } else {
                    cronExpression = `${minute} ${hour} ${monthday} * *`;
                    previewText = `毎月${monthday}日${hour}:${minute.padStart(2, '0')}`;
                }
            } else {
                cronExpression = '';
                previewText = '日付を入力してください（1-31）';
            }
            break;
    }
    
    // 隠しフィールドに設定（フォーム送信時に使用）
    document.getElementById('cron-expression').value = cronExpression;
    document.getElementById('schedule-preview-text').textContent = previewText;
}

// スケジュール送信ハンドラの更新
async function handleScheduleSubmit(e) {
    e.preventDefault();
    
    const scheduleMode = document.querySelector('input[name="scheduleMode"]:checked').value;
    let cronExpression;
    
    if (scheduleMode === 'simple') {
        // 簡単設定の場合は自動生成されたCron式を使用
        cronExpression = document.getElementById('cron-expression').value;
    } else {
        // 詳細設定の場合は入力されたCron式を使用
        cronExpression = document.getElementById('cron-expression').value;
        if (!cronExpression) {
            alert('Cron式を入力してください');
            return;
        }
    }
    
    const targetType = document.querySelector('input[name="targetType"]:checked').value;
    const targetId = targetType === 'broadcast' ? null : document.getElementById('target-select').value;
    
    if ((targetType === 'individual' || targetType === 'group') && !targetId) {
        alert('送信先を選択してください');
        return;
    }
    
    const data = {
        name: document.getElementById('schedule-name').value,
        message: document.getElementById('schedule-message').value,
        targetType: targetType,
        targetId: targetId,
        cronExpression: cronExpression,
        isActive: true
    };
    
    try {
        const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('スケジュールを作成しました');
            e.target.reset();
            // 簡単設定モードにリセット
            document.querySelector('input[name="scheduleMode"][value="simple"]').checked = true;
            toggleScheduleMode();
            loadSchedules();
        } else {
            const error = await response.json();
            alert('エラー: ' + error.error);
        }
    } catch (error) {
        alert('スケジュールの作成に失敗しました');
    }
}

// デバッグタブの初期化
function initializeDebugTab() {
    // WebhookURLにIPアドレスを設定
    updateWebhookUrl();
}

// WebhookURLの更新
function updateWebhookUrl() {
    // クラウドデプロイ用プレースホルダー
    const webhookUrl = `https://your-app.railway.app/webhook`;
    document.getElementById('webhook-url').textContent = webhookUrl;
}

// WebhookURLをクリップボードにコピー
function copyWebhookUrl() {
    const webhookUrl = document.getElementById('webhook-url').textContent;
    navigator.clipboard.writeText(webhookUrl).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'コピー済み!';
        btn.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '#007bff';
        }, 2000);
    }).catch(err => {
        console.error('コピーに失敗しました:', err);
        alert('コピーに失敗しました。手動でコピーしてください:\n' + webhookUrl);
    });
}

// ログをクリア
function clearLogs() {
    const logsContainer = document.getElementById('debug-logs');
    logsContainer.innerHTML = '<p class="log-message">💡 ログをクリアしました。新しいイベントを待機中...</p>';
}

// デバッグログに追加（実際には使用されないが、将来の拡張用）
function addDebugLog(message, type = 'info') {
    const logsContainer = document.getElementById('debug-logs');
    const logElement = document.createElement('p');
    logElement.className = 'log-message';
    
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'group' ? '🎯' : '📝';
    
    logElement.innerHTML = `[${timestamp}] ${emoji} ${escapeHtml(message)}`;
    
    logsContainer.appendChild(logElement);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // ログが多くなりすぎた場合、古いものを削除
    const logs = logsContainer.querySelectorAll('.log-message');
    if (logs.length > 50) {
        logs[0].remove();
    }
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}