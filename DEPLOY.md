# 🚀 クラウドデプロイガイド

## 🔥 Railway（推奨・最も簡単）

### 1. Railwayアカウント作成
- [Railway.app](https://railway.app/) にアクセス
- GitHubアカウントでサインアップ（無料）

### 2. デプロイ手順
1. **「New Project」をクリック**
2. **「Deploy from GitHub repo」を選択**
3. **このリポジトリを選択**
4. **自動デプロイ開始** 🎉

### 3. 環境変数設定
- プロジェクトページで**「Variables」タブ**
- 以下を追加：
```
LINE_CHANNEL_ACCESS_TOKEN=あなたのトークン
PORT=3000
DATABASE_PATH=./database.sqlite
```

### 4. URLを確認
- **「Settings」→「Domains」**
- 表示されたURL: `https://your-app.railway.app`

---

## 🎨 Render（無料プラン豊富）

### 1. Renderアカウント作成
- [Render.com](https://render.com/) にアクセス
- GitHubアカウントでサインアップ

### 2. デプロイ手順
1. **「New」→「Web Service」**
2. **GitHubリポジトリを接続**
3. **設定:**
   - Name: `line-scheduler`
   - Build Command: `npm install`
   - Start Command: `npm start`

### 3. 環境変数設定
```
LINE_CHANNEL_ACCESS_TOKEN=あなたのトークン
NODE_ENV=production
```

---

## ⚡ Vercel（フロントエンド特化）

### 1. Vercelアカウント作成
- [Vercel.com](https://vercel.com/) にアクセス

### 2. デプロイ手順
1. **「Import Project」**
2. **GitHubリポジトリを選択**
3. **自動デプロイ**

---

## 🛠 デプロイ後の設定

### 1. LINE Developers設定
```
Webhook URL: https://your-app.railway.app/webhook
```

### 2. 動作確認
1. アプリにアクセス: `https://your-app.railway.app`
2. BOTをグループに招待
3. メッセージ送信でIDを確認

### 3. 環境変数の確認
- アプリが正常に動作しない場合
- 環境変数が正しく設定されているか確認

---

## 💡 おすすめクラウドサービス比較

| サービス | 料金 | 簡単さ | HTTPS | 特徴 |
|----------|------|--------|-------|------|
| **Railway** | 無料枠あり | ⭐⭐⭐⭐⭐ | ✅ | 最も簡単、GitHub連携 |
| **Render** | 無料枠あり | ⭐⭐⭐⭐ | ✅ | 豊富な無料プラン |
| **Vercel** | 無料枠あり | ⭐⭐⭐ | ✅ | フロントエンド最適化 |

## 🎯 初心者におすすめ: **Railway**
- 設定が最も簡単
- GitHubと自動連携
- 無料で十分使える

---

## 🆘 トラブルシューティング

### デプロイが失敗する場合
1. **Node.jsバージョン確認**: 18以上推奨
2. **package.json確認**: enginesフィールドが設定済み
3. **環境変数確認**: 必要な変数が設定されているか

### アプリが起動しない場合
1. **ログ確認**: クラウドサービスのログを確認
2. **ポート設定**: `process.env.PORT`を使用
3. **データベース**: SQLiteファイルの権限確認

頑張って！初クラウドデプロイ 🚀✨