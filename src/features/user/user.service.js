// src/features/user/user.service.js — gestão de usuários, perfis e restrições.
// RBAC: admin tem visão global; nutricionista acessa apenas seus pacientes;
// paciente acessa apenas a si mesmo. Toda regra de acesso é validada aqui.
const crypto = require('crypto');
const { User, PatientProfile, PatientRestriction, sequelize } = require('../../models');
const AppError = require('../../utils/app-error');
const { ROLES } = require('../../config/constants');
const mailer = require('../../providers/email/mailer');

// --- Helpers de autorização -------------------------------------------------

function isAdmin(actor) {
  return actor.role === ROLES.ADMIN;
}

// Garante que `actor` pode ver/editar o perfil de paciente informado.
function assertCanAccessProfile(actor, profile) {
  if (!profile) throw AppError.notFound('Perfil não encontrado.', 'PROFILE_NOT_FOUND');
  if (isAdmin(actor)) return;
  if (actor.role === ROLES.NUTRITIONIST && profile.nutritionistId === actor.id) return;
  if (actor.role === ROLES.PATIENT && profile.userId === actor.id) return;
  throw AppError.forbidden('Sem permissão sobre este perfil.', 'PROFILE_FORBIDDEN');
}

// --- Usuários ---------------------------------------------------------------

async function listUsers(actor, { role, isActive } = {}) {
  // Rota já restringe a admin; mantemos a checagem por segurança em profundidade.
  if (!isAdmin(actor)) throw AppError.forbidden();
  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;
  return User.findAll({ where, order: [['createdAt', 'DESC']] });
}

// Lista os pacientes do ator: admin vê todos; nutricionista vê apenas os seus.
async function listMyPatients(actor) {
  if (actor.role === ROLES.PATIENT) throw AppError.forbidden('Apenas nutricionista/admin.', 'FORBIDDEN');
  const where = isAdmin(actor) ? {} : { nutritionistId: actor.id };
  return PatientProfile.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'isActive'] }],
    order: [['createdAt', 'DESC']],
  });
}

async function getUserById(actor, id) {
  const user = await User.findByPk(id, {
    include: [
      { model: PatientProfile, as: 'profile', include: [{ model: PatientRestriction, as: 'restrictions' }] },
    ],
  });
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');

  if (isAdmin(actor)) return user;
  if (actor.id === user.id) return user; // próprio usuário
  // Nutricionista só vê pacientes provisionados por ela.
  if (
    actor.role === ROLES.NUTRITIONIST &&
    user.profile &&
    user.profile.nutritionistId === actor.id
  ) {
    return user;
  }
  throw AppError.forbidden('Sem permissão sobre este usuário.', 'USER_FORBIDDEN');
}

async function createUser(actor, { name, email, password, role, phone }) {
  if (!isAdmin(actor)) throw AppError.forbidden();
  if (!name || !email || !password) {
    throw AppError.badRequest('name, email e password são obrigatórios.', 'MISSING_FIELDS');
  }
  const exists = await User.findOne({ where: { email } });
  if (exists) throw AppError.conflict('E-mail já cadastrado.', 'EMAIL_TAKEN');

  const user = User.build({ name, email, role: role || ROLES.PATIENT, phone });
  await user.setPassword(password);
  await user.save();
  return getUserById(actor, user.id);
}

async function updateUser(actor, id, { name, phone }) {
  const user = await getUserById(actor, id); // já valida acesso
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();
  return user;
}

async function setActive(actor, id, isActive) {
  if (!isAdmin(actor)) throw AppError.forbidden();
  const user = await User.findByPk(id);
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');
  user.isActive = Boolean(isActive);
  await user.save();
  return user;
}

async function updateRole(actor, id, role) {
  if (!isAdmin(actor)) throw AppError.forbidden();
  if (!Object.values(ROLES).includes(role)) {
    throw AppError.badRequest('Papel inválido.', 'INVALID_ROLE');
  }
  const user = await User.findByPk(id);
  if (!user) throw AppError.notFound('Usuário não encontrado.', 'USER_NOT_FOUND');
  user.role = role;
  await user.save();
  return user;
}

// --- Provisionamento de paciente (pela nutricionista) -----------------------

async function provisionPatient(actor, { name, email, password, phone, profile = {} }) {
  if (actor.role !== ROLES.NUTRITIONIST && !isAdmin(actor)) {
    throw AppError.forbidden('Apenas nutricionistas podem provisionar pacientes.', 'NOT_NUTRITIONIST');
  }
  if (!name || !email) {
    throw AppError.badRequest('name e email são obrigatórios.', 'MISSING_FIELDS');
  }
  const exists = await User.findOne({ where: { email } });
  if (exists) throw AppError.conflict('E-mail já cadastrado.', 'EMAIL_TAKEN');

  // Senha temporária gerada se não informada (paciente troca no 1º acesso).
  const tempPassword = password || crypto.randomBytes(6).toString('base64url');
  const nutritionistId = actor.id;

  const result = await sequelize.transaction(async (t) => {
    const user = User.build({ name, email, phone, role: ROLES.PATIENT });
    await user.setPassword(tempPassword);
    await user.save({ transaction: t });

    const createdProfile = await PatientProfile.create(
      {
        userId: user.id,
        nutritionistId,
        birthDate: profile.birthDate ?? null,
        sex: profile.sex ?? null,
        heightCm: profile.heightCm ?? null,
        weightKg: profile.weightKg ?? null,
        activityLevel: profile.activityLevel ?? undefined,
        goal: profile.goal ?? undefined,
        clinicalNotes: profile.clinicalNotes ?? null,
      },
      { transaction: t },
    );

    // Restrições opcionais enviadas junto.
    if (Array.isArray(profile.restrictions) && profile.restrictions.length) {
      await PatientRestriction.bulkCreate(
        profile.restrictions.map((r) => ({
          patientProfileId: createdProfile.id,
          type: r.type,
          label: r.label,
          notes: r.notes ?? null,
        })),
        { transaction: t, validate: true },
      );
    }

    return { user, profile: createdProfile };
  });

  // Convite por e-mail com as credenciais temporárias (best effort).
  await mailer
    .sendPatientInvite(result.user, { nutritionistName: actor.name, tempPassword })
    .catch((e) => console.error('[user] invite email', e));

  const full = await getUserById(actor, result.user.id);
  // Devolve a senha temporária apenas se foi gerada automaticamente (sem e-mail garantido).
  return { user: full, tempPasswordIssued: !password ? tempPassword : undefined };
}

// --- PatientProfile ---------------------------------------------------------

async function getProfile(actor, profileId) {
  const profile = await PatientProfile.findByPk(profileId, {
    include: [
      { model: PatientRestriction, as: 'restrictions' },
      { model: User, as: 'user', attributes: ['id', 'name', 'email', 'isActive'] },
    ],
  });
  assertCanAccessProfile(actor, profile);
  return profile;
}

// Recupera o perfil do próprio paciente autenticado.
async function getMyProfile(actor) {
  const profile = await PatientProfile.findOne({
    where: { userId: actor.id },
    include: [{ model: PatientRestriction, as: 'restrictions' }],
  });
  if (!profile) throw AppError.notFound('Você ainda não possui um perfil clínico.', 'PROFILE_NOT_FOUND');
  return profile;
}

const PROFILE_FIELDS = [
  'birthDate',
  'sex',
  'heightCm',
  'weightKg',
  'activityLevel',
  'goal',
  'clinicalNotes',
  'shoppingBudget', // teto de gastos editável pelo próprio paciente
];

async function updateProfile(actor, profileId, data) {
  const profile = await PatientProfile.findByPk(profileId);
  assertCanAccessProfile(actor, profile);

  // Paciente não edita notas clínicas (campo da nutricionista).
  PROFILE_FIELDS.forEach((field) => {
    if (data[field] === undefined) return;
    if (field === 'clinicalNotes' && actor.role === ROLES.PATIENT) return;
    profile[field] = data[field];
  });
  await profile.save();
  return profile;
}

// --- PatientRestriction -----------------------------------------------------

async function listRestrictions(actor, profileId) {
  const profile = await PatientProfile.findByPk(profileId);
  assertCanAccessProfile(actor, profile);
  return PatientRestriction.findAll({
    where: { patientProfileId: profileId },
    order: [['createdAt', 'ASC']],
  });
}

async function addRestriction(actor, profileId, { type, label, notes }) {
  const profile = await PatientProfile.findByPk(profileId);
  assertCanAccessProfile(actor, profile);
  if (!type || !label) {
    throw AppError.badRequest('type e label são obrigatórios.', 'MISSING_FIELDS');
  }
  return PatientRestriction.create({ patientProfileId: profileId, type, label, notes: notes ?? null });
}

async function updateRestriction(actor, restrictionId, data) {
  const restriction = await PatientRestriction.findByPk(restrictionId, {
    include: [{ model: PatientProfile, as: 'profile' }],
  });
  if (!restriction) throw AppError.notFound('Restrição não encontrada.', 'RESTRICTION_NOT_FOUND');
  assertCanAccessProfile(actor, restriction.profile);

  ['type', 'label', 'notes'].forEach((f) => {
    if (data[f] !== undefined) restriction[f] = data[f];
  });
  await restriction.save();
  return restriction;
}

async function removeRestriction(actor, restrictionId) {
  const restriction = await PatientRestriction.findByPk(restrictionId, {
    include: [{ model: PatientProfile, as: 'profile' }],
  });
  if (!restriction) throw AppError.notFound('Restrição não encontrada.', 'RESTRICTION_NOT_FOUND');
  assertCanAccessProfile(actor, restriction.profile);
  await restriction.destroy();
  return { deleted: true };
}

module.exports = {
  listUsers,
  listMyPatients,
  getUserById,
  createUser,
  updateUser,
  setActive,
  updateRole,
  provisionPatient,
  getProfile,
  getMyProfile,
  updateProfile,
  listRestrictions,
  addRestriction,
  updateRestriction,
  removeRestriction,
};
