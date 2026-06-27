// src/features/meal-log/meal-log.routes.js — registro diário de consumo do plano.
const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const controller = require('./meal-log.controller');

const router = Router();
router.use(authenticate);

// Dia (itens marcados + extras). ?patientProfileId=&date=YYYY-MM-DD
router.get('/', controller.listDay);

// Upsert do status de um item do plano. body: { patientProfileId, date?, status, swappedFoodId?, swappedFoodName? }
router.put('/items/:mealItemId', controller.setItem);
router.delete('/items/:mealItemId', controller.clearItem); // ?patientProfileId=&date=

// Extras ("comeu a mais").
router.post('/extras', controller.addExtra); // body: { patientProfileId, date?, mealId?, foodId?, foodName, quantityG, kcal, carbsG, proteinG, fatG }
router.delete('/extras/:extraId', controller.removeExtra); // ?patientProfileId=

module.exports = router;
