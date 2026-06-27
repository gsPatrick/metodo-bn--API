// src/config/constants.js — enums e constantes de domínio compartilhadas.
// Centralizar aqui evita divergência entre models, services e validações.

const ROLES = Object.freeze({
  ADMIN: 'admin',
  NUTRITIONIST: 'nutritionist',
  PATIENT: 'patient',
});

const NOTIFICATION_TYPES = Object.freeze({
  DIET_APPROVED: 'diet_approved',
  BUDGET_WARNING: 'budget_warning',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  NEW_MESSAGE: 'new_message',
  SYSTEM_ALERT: 'system_alert',
});

const DEVICE_PLATFORMS = Object.freeze({
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web',
});

const DIET_PLAN_STATUS = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
});

const SHOPPING_LIST_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RECEIVED: 'received',
  FAILED: 'failed',
  REFUNDED: 'refunded',
});

const PAYMENT_METHODS = Object.freeze({
  PIX: 'pix',
  BOLETO: 'boleto',
  CREDIT_CARD: 'credit_card',
});

const ACTIVITY_LEVELS = Object.freeze({
  SEDENTARY: 'sedentary',
  LIGHT: 'light',
  MODERATE: 'moderate',
  ACTIVE: 'active',
  VERY_ACTIVE: 'very_active',
});

const GOALS = Object.freeze({
  LOSE_WEIGHT: 'lose_weight',
  MAINTAIN: 'maintain',
  GAIN_MUSCLE: 'gain_muscle',
});

const SEX = Object.freeze({ MALE: 'male', FEMALE: 'female', OTHER: 'other' });

const RESTRICTION_TYPES = Object.freeze({
  ALLERGY: 'allergy',
  INTOLERANCE: 'intolerance',
  PREFERENCE: 'preference',
});

// Status de consumo de um item do plano no dia (registro do paciente).
const MEAL_LOG_STATUS = Object.freeze({
  CONSUMED: 'consumed', // comeu como no plano
  SWAPPED: 'swapped', // comeu uma substituição
  SKIPPED: 'skipped', // não comeu
});

// Tipos de mensagem no chat nutri <-> paciente.
const MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
  DOC: 'doc',
  AUDIO: 'audio',
});

// Lembretes do paciente.
const REMINDER_TYPES = Object.freeze({
  WATER: 'water',
  MEAL: 'meal',
  WORKOUT: 'workout',
  CUSTOM: 'custom',
});

// Catálogo de conquistas (badges) — código estável + metadados de exibição.
const ACHIEVEMENTS = Object.freeze({
  first_day: { code: 'first_day', title: 'Primeiro dia', description: 'Registrou o primeiro dia completo.', icon: 'star' },
  water_goal: { code: 'water_goal', title: 'Hidratação em dia', description: 'Bateu a meta de água.', icon: 'water' },
  streak_7: { code: 'streak_7', title: '7 dias seguidos', description: 'Manteve a sequência por 7 dias.', icon: 'flame' },
  streak_30: { code: 'streak_30', title: '30 dias seguidos', description: 'Um mês de constância!', icon: 'flame' },
  perfect_day: { code: 'perfect_day', title: 'Dia perfeito', description: 'Treino, sono e água no mesmo dia.', icon: 'check' },
  plan_follower: { code: 'plan_follower', title: 'Fiel ao plano', description: 'Consumiu o plano inteiro num dia.', icon: 'leaf' },
});

const values = (obj) => Object.values(obj);

module.exports = {
  ROLES,
  NOTIFICATION_TYPES,
  DEVICE_PLATFORMS,
  DIET_PLAN_STATUS,
  SHOPPING_LIST_STATUS,
  SUBSCRIPTION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  ACTIVITY_LEVELS,
  GOALS,
  SEX,
  RESTRICTION_TYPES,
  MEAL_LOG_STATUS,
  MESSAGE_TYPES,
  REMINDER_TYPES,
  ACHIEVEMENTS,
  values,
};
