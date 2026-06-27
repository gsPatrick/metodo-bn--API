// src/routes/index.js — agregador ÚNICO das rotas da versão atual da API.
// Cada feature expõe seu próprio router; aqui apenas montamos os caminhos.
// Não registrar endpoints "soltos" fora das features, exceto health/version.
const { Router } = require('express');

const userRoutes = require('../features/user/user.routes');
const authRoutes = require('../features/auth/auth.routes');
const notificationRoutes = require('../features/notification/notification.routes');
const foodRoutes = require('../features/food/food.routes');
const dietPlanRoutes = require('../features/diet-plan/diet-plan.routes');
const shoppingListRoutes = require('../features/shopping-list/shopping-list.routes');
const marketRoutes = require('../features/market/market.routes');
const purchaseRoutes = require('../features/purchase/purchase.routes');
const monetizationRoutes = require('../features/monetization/monetization.routes');
const billingRoutes = require('../features/billing/billing.routes');
const healthMetricRoutes = require('../features/health-metric/health-metric.routes');
const anamnesisRoutes = require('../features/anamnesis/anamnesis.routes');
const mealLogRoutes = require('../features/meal-log/meal-log.routes');
const messagingRoutes = require('../features/messaging/messaging.routes');
const reminderRoutes = require('../features/reminder/reminder.routes');
const achievementRoutes = require('../features/achievement/achievement.routes');

const router = Router();

// --- Probes de orquestração / health checks ---
router.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));
router.get('/ping', (req, res) => res.json({ success: true, data: 'pong' }));
router.get('/version', (req, res) =>
  res.json({ success: true, data: { version: require('../../package.json').version } }),
);

// --- Features ---
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/foods', foodRoutes);
router.use('/diet-plans', dietPlanRoutes);
router.use('/shopping-lists', shoppingListRoutes);
router.use('/markets', marketRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/monetization', monetizationRoutes);
router.use('/billing', billingRoutes);
router.use('/health-metrics', healthMetricRoutes);
router.use('/anamnesis', anamnesisRoutes);
router.use('/meal-logs', mealLogRoutes);
router.use('/conversations', messagingRoutes);
router.use('/reminders', reminderRoutes);
router.use('/achievements', achievementRoutes);

module.exports = router;
