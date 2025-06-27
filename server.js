const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const { sequelize, Schedule, NotificationHistory, Target } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// リアルタイムログ用のクライアント管理
let sseClients = [];

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_MULTICAST_URL = 'https://api.line.me/v2/bot/message/multicast';
const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
};

// アクティブなスケジュールを管理するMap
const activeJobs = new Map();

// LINE通知送信関数
async function sendLineNotification(message, targetType, targetId) {
    const messageData = {
        messages: [{
            type: 'text',
            text: message
        }]
    };

    try {
        let response;
        
        if (targetType === 'individual' && targetId) {
            response = await axios.post(LINE_API_URL, {
                to: targetId,
                ...messageData
            }, { headers });
        } else if (targetType === 'group' && targetId) {
            response = await axios.post(LINE_API_URL, {
                to: targetId,
                ...messageData
            }, { headers });
        } else if (targetType === 'broadcast') {
            response = await axios.post(LINE_BROADCAST_URL, messageData, { headers });
        }

        return { success: true };
    } catch (error) {
        console.error('LINE API エラー:', error.response?.data || error.message);
        return { 
            success: false, 
            error: error.response?.data || error.message 
        };
    }
}

// スケジュールジョブの作成
function createScheduleJob(schedule) {
    // 特定の年月日のスケジュールかチェック
    const yearMatch = schedule.cronExpression.match(/(\d{4})$/);
    const isSpecificDate = yearMatch !== null;
    
    let cronExpr = schedule.cronExpression;
    let targetYear = null;
    
    if (isSpecificDate) {
        targetYear = parseInt(yearMatch[1]);
        // 年の部分を除去してnode-cronで使用可能な形式にする
        cronExpr = schedule.cronExpression.replace(/ \d{4}$/, '');
    }
    
    console.log(`スケジュール登録: ${schedule.name}`);
    console.log(`元のCron式: ${schedule.cronExpression}`);
    console.log(`実行用Cron式: ${cronExpr}`);
    console.log(`特定日付フラグ: ${isSpecificDate}`);
    if (isSpecificDate) {
        console.log(`対象年: ${targetYear}`);
    }
    
    const job = cron.schedule(cronExpr, async () => {
        console.log(`=== スケジュール実行トリガー: ${schedule.name} ===`);
        
        // 特定の日付のスケジュールの場合、年をチェック
        if (isSpecificDate) {
            const currentYear = new Date().getFullYear();
            console.log(`現在年: ${currentYear}, 対象年: ${targetYear}`);
            if (currentYear !== targetYear) {
                console.log(`スケジュール ${schedule.name}: 対象年（${targetYear}年）ではないためスキップ`);
                return;
            }
        }
        
        console.log(`スケジュール実行開始: ${schedule.name}`);
        
        const result = await sendLineNotification(
            schedule.message,
            schedule.targetType,
            schedule.targetId
        );

        // 履歴を記録
        await NotificationHistory.create({
            scheduleId: schedule.id,
            message: schedule.message,
            targetType: schedule.targetType,
            targetId: schedule.targetId,
            status: result.success ? 'success' : 'failed',
            error: result.error
        });

        // 特定の日付のスケジュールの場合、実行後に無効化
        if (isSpecificDate) {
            await schedule.update({ isActive: false });
            console.log(`スケジュール ${schedule.name}: 1回限りの実行のため無効化しました`);
            
            // ジョブを停止
            if (activeJobs.has(schedule.id)) {
                activeJobs.get(schedule.id).stop();
                activeJobs.delete(schedule.id);
            }
        } else {
            // 次回実行時刻を更新（定期実行のみ）
            try {
                const nextRun = cron.schedule(cronExpr).nextDates(1)[0];
                await schedule.update({ nextRun });
            } catch (error) {
                console.error('次回実行時刻の更新に失敗:', error);
            }
        }
    });

    return job;
}

// 起動時に全てのアクティブなスケジュールを開始
async function startAllSchedules() {
    const schedules = await Schedule.findAll({ where: { isActive: true } });
    
    for (const schedule of schedules) {
        const job = createScheduleJob(schedule);
        job.start();
        activeJobs.set(schedule.id, job);
    }
    
    console.log(`${schedules.length}個のスケジュールを開始しました`);
}

// リアルタイムログ用のServer-Sent Events
app.get('/api/logs/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // クライアントを配列に追加
    const clientId = Date.now();
    const client = { id: clientId, res };
    sseClients.push(client);

    // 接続確認メッセージ
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: '🟢 リアルタイムログ接続完了',
        timestamp: new Date().toLocaleTimeString('ja-JP')
    })}\n\n`);

    // クライアントが切断した時の処理
    req.on('close', () => {
        sseClients = sseClients.filter(client => client.id !== clientId);
        console.log(`リアルタイムログクライアント切断: ${clientId}`);
    });
});

// ログをすべてのクライアントに送信する関数
function broadcastLog(logData) {
    const message = `data: ${JSON.stringify(logData)}\n\n`;
    sseClients.forEach(client => {
        try {
            client.res.write(message);
        } catch (error) {
            console.error('SSE送信エラー:', error);
        }
    });
}

// ルートページ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Webhook エンドポイント（LINE IDデバッグ用）
app.post('/webhook', (req, res) => {
    const events = req.body.events;
    
    if (events && events.length > 0) {
        events.forEach(event => {
            // コンソールログ（従来通り）
            console.log('=== LINE Webhook イベント ===');
            console.log('イベントタイプ:', event.type);
            console.log('ユーザーID:', event.source.userId);
            
            // リアルタイムログ用のデータ作成
            const logData = {
                type: 'webhook',
                eventType: event.type,
                userId: event.source.userId,
                timestamp: new Date().toLocaleTimeString('ja-JP')
            };
            
            if (event.source.type === 'group') {
                console.log('🎯 グループID:', event.source.groupId);
                console.log('グループ名取得可能');
                logData.groupId = event.source.groupId;
                logData.sourceType = 'group';
                logData.message = `🎯 グループID: ${event.source.groupId}`;
            } else if (event.source.type === 'room') {
                console.log('🎯 ルームID:', event.source.roomId);
                logData.roomId = event.source.roomId;
                logData.sourceType = 'room';
                logData.message = `🎯 ルームID: ${event.source.roomId}`;
            } else {
                console.log('個人チャット');
                logData.sourceType = 'user';
                logData.message = '👤 個人チャット';
            }
            
            if (event.type === 'message') {
                console.log('メッセージ:', event.message.text);
                logData.messageText = event.message.text;
                logData.message += ` | 💬 メッセージ: ${event.message.text}`;
            }
            
            if (event.type === 'join') {
                console.log('✅ BOTがグループに追加されました');
                console.log('グループID:', event.source.groupId);
                logData.message = `✅ BOTがグループに追加されました | 🎯 グループID: ${event.source.groupId}`;
            }
            
            // リアルタイムログに送信
            broadcastLog(logData);
            
            console.log('==============================');
        });
    }
    
    res.status(200).send('OK');
});

// デバッグ情報取得API
app.get('/api/webhook-logs', (req, res) => {
    // 実際のプロダクションでは、ログをデータベースに保存することを推奨
    res.json({ 
        message: 'Webhookログはサーバーコンソールで確認できます',
        instructions: [
            '1. LINE DevelopersでWebhook URLを設定: http://あなたのURL/webhook',
            '2. BOTをグループに追加',
            '3. グループでメッセージを送信',
            '4. サーバーコンソールでグループIDを確認'
        ]
    });
});

// ターゲット（送信先）のCRUD
app.get('/api/targets', async (req, res) => {
    try {
        const targets = await Target.findAll();
        res.json(targets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/targets', async (req, res) => {
    try {
        const target = await Target.create(req.body);
        res.json(target);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/targets/:id', async (req, res) => {
    try {
        await Target.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// スケジュールのCRUD
app.get('/api/schedules', async (req, res) => {
    try {
        const schedules = await Schedule.findAll();
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/schedules', async (req, res) => {
    try {
        const schedule = await Schedule.create(req.body);
        
        if (schedule.isActive) {
            const job = createScheduleJob(schedule);
            job.start();
            activeJobs.set(schedule.id, job);
        }
        
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/schedules/:id', async (req, res) => {
    try {
        const schedule = await Schedule.findByPk(req.params.id);
        if (!schedule) {
            return res.status(404).json({ error: 'スケジュールが見つかりません' });
        }

        await schedule.update(req.body);

        // 既存のジョブを停止
        if (activeJobs.has(schedule.id)) {
            activeJobs.get(schedule.id).stop();
            activeJobs.delete(schedule.id);
        }

        // アクティブな場合は新しいジョブを開始
        if (schedule.isActive) {
            const job = createScheduleJob(schedule);
            job.start();
            activeJobs.set(schedule.id, job);
        }

        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    try {
        // ジョブを停止
        if (activeJobs.has(req.params.id)) {
            activeJobs.get(req.params.id).stop();
            activeJobs.delete(req.params.id);
        }

        await Schedule.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 通知履歴の取得
app.get('/api/history', async (req, res) => {
    try {
        const history = await NotificationHistory.findAll({
            include: [{ model: Schedule, attributes: ['name'] }],
            order: [['sentAt', 'DESC']],
            limit: 100
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 手動実行
app.post('/api/schedules/:id/run', async (req, res) => {
    try {
        const schedule = await Schedule.findByPk(req.params.id);
        if (!schedule) {
            return res.status(404).json({ error: 'スケジュールが見つかりません' });
        }

        const result = await sendLineNotification(
            schedule.message,
            schedule.targetType,
            schedule.targetId
        );

        await NotificationHistory.create({
            scheduleId: schedule.id,
            message: schedule.message,
            targetType: schedule.targetType,
            targetId: schedule.targetId,
            status: result.success ? 'success' : 'failed',
            error: result.error
        });

        res.json({ 
            success: result.success, 
            message: result.success ? '通知を送信しました' : '通知の送信に失敗しました',
            error: result.error 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 設定確認
app.get('/api/config', (req, res) => {
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    res.json({ configured: hasToken });
});

// データベース初期化とサーバー起動
sequelize.sync().then(() => {
    console.log('データベースを初期化しました');
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`サーバーが起動しました:`);
        console.log(`  ローカル:      http://localhost:${PORT}`);
        console.log(`  ネットワーク:   http://${getLocalIP()}:${PORT}`);
        console.log(`  管理画面:      ブラウザで上記URLにアクセスしてください`);
        startAllSchedules();
    });
});

// ローカルIPアドレスを取得
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    // よく使われるネットワークインターフェースを優先
    const preferredInterfaces = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];
    for (const interfaceName of preferredInterfaces) {
        if (results[interfaceName] && results[interfaceName].length > 0) {
            return results[interfaceName][0];
        }
    }

    // 最初に見つかったIPアドレスを返す
    const allIPs = Object.values(results).flat();
    return allIPs.length > 0 ? allIPs[0] : 'localhost';
}