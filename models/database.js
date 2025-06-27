const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DATABASE_PATH || './database.sqlite',
    logging: false
});

// スケジュールモデル
const Schedule = sequelize.define('Schedule', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    targetType: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['individual', 'group', 'broadcast']]
        }
    },
    targetId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cronExpression: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    nextRun: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

// 通知履歴モデル
const NotificationHistory = sequelize.define('NotificationHistory', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    scheduleId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    targetType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    targetId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['success', 'failed']]
        }
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    sentAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

// グループ/個人管理モデル
const Target = sequelize.define('Target', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lineId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['individual', 'group']]
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
});

// アソシエーション
Schedule.hasMany(NotificationHistory, { foreignKey: 'scheduleId' });
NotificationHistory.belongsTo(Schedule, { foreignKey: 'scheduleId' });

module.exports = {
    sequelize,
    Schedule,
    NotificationHistory,
    Target
};