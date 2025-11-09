const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Event, EventQuestion, EventResponse, EventAnswer, User, EventGuest } = require('../models');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized (reuse if already initialized in auth)
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
  } catch (err) {
    console.error('Firebase Admin initialization error (eventsOpen):', err);
  }
}

const router = express.Router();

/**
 * @swagger
 * /api/events/public:
 *   get:
 *     summary: Listar eventos públicos com paginação e filtros
 *     tags: [Events Public]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, start_datetime, end_datetime, name]
 *           default: start_datetime
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *       - in: query
 *         name: slug
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, ongoing, past]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lista pública paginada de eventos
 */
// GET /api/events/public - Lista pública de eventos com paginação/filtros
router.get('/public', async (req, res) => {
  try {
    // Query params
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const order = (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortByAllowed = ['created_at', 'start_datetime', 'end_datetime', 'name'];
    const sortBy = sortByAllowed.includes(req.query.sort_by) ? req.query.sort_by : 'start_datetime';
    const { name, slug, status, from, to, date } = req.query;

    const where = {};
    if (name) where.name = { [Op.like]: `%${name}%` };
    if (slug) where.slug = { [Op.like]: `%${slug}%` };
    if (from || to) {
      where.start_datetime = {};
      if (from) where.start_datetime[Op.gte] = new Date(from);
      if (to) where.start_datetime[Op.lte] = new Date(to);
    }
    if (date) {
      const d = new Date(date);
      // Evento ocorrendo na data informada
      where.start_datetime = Object.assign(where.start_datetime || {}, { [Op.lte]: d });
      where.end_datetime = { [Op.gte]: d };
    }
    if (status) {
      const now = new Date();
      if (status === 'upcoming') {
        where.start_datetime = Object.assign(where.start_datetime || {}, { [Op.gt]: now });
      } else if (status === 'ongoing') {
        where.start_datetime = Object.assign(where.start_datetime || {}, { [Op.lte]: now });
        where.end_datetime = { [Op.gte]: now };
      } else if (status === 'past') {
        where.end_datetime = { [Op.lt]: now };
      }
    }

    const offset = (page - 1) * limit;
    const total = await Event.count({ where });
    const rows = await Event.findAll({
      where,
      attributes: ['id', 'id_code', 'name', 'slug', 'banner_url', 'start_datetime', 'end_datetime', 'public_url', 'gallery_url', 'place', 'description', 'color_1', 'color_2', 'card_background', 'created_at'],
      order: [[sortBy, order]],
      offset,
      limit
    });

    return res.json({
      success: true,
      data: { events: rows },
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Public list events error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/events/public/{slug}:
 *   get:
 *     summary: Detalhes públicos do evento por slug
 *     tags: [Events Public]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados do evento com perguntas visíveis
 *       404:
 *         description: Evento não encontrado
 */
// GET /api/events/public/:slug
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const event = await Event.findOne({
      where: { slug },
      include: [{
        model: EventQuestion,
        as: 'questions',
        where: { show_results: true },
        required: false,
        attributes: ['id', 'question_text', 'question_type', 'options'],
        order: [['order_index', 'ASC']]
      }]
    });

    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    const payload = {
      id: event.id,
      id_code: event.id_code,
      name: event.name,
      slug: event.slug,
      description: event.description,
      banner_url: event.banner_url,
      public_url: event.public_url,
      gallery_url: event.gallery_url,
      place: event.place,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      color_1: event.color_1,
      color_2: event.color_2,
      card_background: event.card_background,
      questions: (event.questions || []).map(q => ({
        id: q.id,
        text: q.question_text,
        type: q.question_type,
        options: q.options || null
      }))
    };

    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Public event by slug error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/events/{id}/responses:
 *   post:
 *     summary: Enviar respostas de evento
 *     tags: [Events Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guest_code, answers]
 *             properties:
 *               guest_code:
 *                 type: string
 *               selfie_url:
 *                 type: string
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [question_id]
 *                   properties:
 *                     question_id:
 *                       type: integer
 *                     answer_text:
 *                       type: string
 *                     answer_json:
 *                       type: object
 *     responses:
 *       201:
 *         description: Respostas registradas com sucesso
 *       404:
 *         description: Evento não encontrado
 *       409:
 *         description: guest_code já utilizado
 */
// POST /api/events/:id/responses
router.post('/:id/responses', [
  body('guest_code').isLength({ min: 1, max: 20 }).trim().withMessage('guest_code é obrigatório'),
  body('selfie_url').optional().isURL().withMessage('selfie_url inválida'),
  body('answers').isArray({ min: 1 }).withMessage('answers deve ser uma lista')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  const { id } = req.params;
  const { guest_code, selfie_url, answers } = req.body;

  try {
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    const existing = await EventResponse.findOne({ where: { guest_code } });
    if (existing) {
      return res.status(409).json({ error: 'Duplicate entry', message: 'guest_code já utilizado' });
    }

    const t = await sequelize.transaction();
    try {
      // valida perguntas pertencem ao evento
      const eventQuestions = await EventQuestion.findAll({ where: { event_id: event.id }, attributes: ['id'], transaction: t });
      const validQuestionIds = new Set(eventQuestions.map(q => q.id));

      for (const ans of answers) {
        if (!validQuestionIds.has(ans.question_id)) {
          throw Object.assign(new Error(`Pergunta ${ans.question_id} não pertence ao evento`), { statusCode: 400 });
        }
        if (ans.answer_text == null && ans.answer_json == null) {
          throw Object.assign(new Error('Cada resposta deve ter answer_text ou answer_json'), { statusCode: 400 });
        }
      }

      const response = await EventResponse.create({
        event_id: event.id,
        guest_code,
        selfie_url: selfie_url || null
      }, { transaction: t });

      const toCreate = answers.map(a => ({
        response_id: response.id,
        question_id: a.question_id,
        answer_text: a.answer_text || null,
        answer_json: a.answer_json || null
      }));

      await EventAnswer.bulkCreate(toCreate, { transaction: t });

      await t.commit();
      return res.status(201).json({ success: true, response_id: response.id });
    } catch (err) {
      await t.rollback();
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: 'Validation error', message: err.message });
      }
      throw err;
    }
  } catch (error) {
    console.error('Create event response error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/events/{id}/checkin/google:
 *   post:
 *     summary: Check-in via login Google (evento aberto)
 *     tags: [Events Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Check-in realizado
 *       404:
 *         description: Evento não encontrado
 *       409:
 *         description: Convidado já checkado
 */
router.post('/:id/checkin/google', [
  body('idToken').isString().withMessage('idToken é obrigatório')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation error', message: 'Dados inválidos', details: errors.array() });
    }

    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    const { idToken } = req.body;
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token', message: 'Token do Google inválido ou expirado' });
    }

    const { email, name, picture, sub, email_verified } = decoded;
    if (!email) {
      return res.status(400).json({ error: 'Email required', message: 'Email não disponível no token do Google' });
    }

    // Localiza ou cria usuário com base no Google UID ou email
    let user = await User.findOne({ where: { [Op.or]: [{ google_uid: sub }, { google_id: sub }, { email }] } });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      user = await User.create({
        name: name || (email ? email.split('@')[0] : 'Usuário Google'),
        email,
        password: randomPassword,
        role: 'customer',
        google_uid: sub,
        google_id: sub,
        avatar_url: picture || null,
        email_verified: !!email_verified
      });
    } else {
      // Atualiza dados úteis se necessário
      await user.update({
        google_uid: user.google_uid || sub,
        google_id: user.google_id || sub,
        name: user.name || name || email,
        avatar_url: user.avatar_url || picture || null,
        email_verified: user.email_verified || !!email_verified
      });
    }

    // Verifica se já existe convidado vinculado ao usuário
    let guest = await EventGuest.findOne({ where: { event_id: event.id, user_id: user.id } });
    if (guest) {
      if (guest.check_in_at) {
        return res.status(409).json({ error: 'Already checked in', message: 'Convidado já realizou check-in' });
      }
      await guest.update({
        guest_name: guest.guest_name || user.name,
        guest_email: guest.guest_email || user.email,
        check_in_at: new Date(),
        check_in_method: 'google_login',
        source: 'walk_in',
        authorized_by_user_id: null
      });
    } else {
      guest = await EventGuest.create({
        event_id: event.id,
        user_id: user.id,
        guest_name: user.name,
        guest_email: user.email,
        guest_phone: user.phone || null,
        guest_document_type: null,
        guest_document_number: null,
        type: 'normal',
        source: 'walk_in',
        rsvp_confirmed: false,
        rsvp_at: null,
        invited_at: new Date(),
        invited_by_user_id: null,
        check_in_at: new Date(),
        check_in_method: 'google_login',
        authorized_by_user_id: null
      });
    }

    return res.json({ success: true, data: { guest } });
  } catch (error) {
    console.error('Public Google check-in error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/events/{id}/responses:
 *   get:
 *     summary: Listar respostas de evento com paginação e filtros
 *     tags: [Events Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [submitted_at, guest_code]
 *           default: submitted_at
 *       - in: query
 *         name: guest_code
 *         schema:
 *           type: string
 *       - in: query
 *         name: has_selfie
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: question_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: answer_contains
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista paginada de respostas
 *       404:
 *         description: Evento não encontrado
 */
// GET /api/events/:id/responses
// Suporta paginação e filtros via query params:
// page, limit, order (asc|desc), sort_by (submitted_at|guest_code), guest_code, has_selfie (true|false), from, to, question_id, answer_contains
router.get('/:id/responses', async (req, res) => {
  try {
  const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    // Query params
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const order = (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortBy = ['submitted_at', 'guest_code'].includes(req.query.sort_by) ? req.query.sort_by : 'submitted_at';
    const { guest_code, has_selfie, from, to } = req.query;
    const questionId = req.query.question_id ? parseInt(req.query.question_id, 10) : undefined;
    const answerContains = req.query.answer_contains;

    // Base where
    const where = { event_id: event.id };
    if (guest_code) {
      where.guest_code = { [Op.like]: `%${guest_code}%` };
    }
    if (typeof has_selfie !== 'undefined') {
      if (String(has_selfie).toLowerCase() === 'true') {
        where.selfie_url = { [Op.ne]: null };
      } else if (String(has_selfie).toLowerCase() === 'false') {
        where.selfie_url = { [Op.is]: null };
      }
    }
    if (from || to) {
      where.submitted_at = {};
      if (from) where.submitted_at[Op.gte] = new Date(from);
      if (to) where.submitted_at[Op.lte] = new Date(to);
    }

    // Include de respostas, opcionalmente com filtro por pergunta/resposta
    const answersInclude = {
      model: EventAnswer,
      as: 'answers',
      required: !!questionId || !!answerContains,
      where: {}
    };
    if (questionId) {
      answersInclude.where.question_id = questionId;
    }
    if (answerContains) {
      // Filtro de texto somente em answer_text
      answersInclude.where.answer_text = { [Op.like]: `%${answerContains}%` };
    }
    // Remover where vazio para evitar side effects
    if (Object.keys(answersInclude.where).length === 0) {
      delete answersInclude.where;
      answersInclude.required = false;
    }

    const offset = (page - 1) * limit;
    const { rows, count } = await EventResponse.findAndCountAll({
      where,
      include: [answersInclude],
      order: [[sortBy, order]],
      offset,
      limit,
      distinct: true
    });

    const data = rows.map(r => {
      const answersObj = {};
      (r.answers || []).forEach(a => {
        const key = `q${a.question_id}`;
        answersObj[key] = a.answer_text != null ? a.answer_text : a.answer_json;
      });
      return {
        guest_code: r.guest_code,
        selfie_url: r.selfie_url,
        submitted_at: r.submitted_at,
        answers: answersObj
      };
    });

    return res.json({
      success: true,
      data,
      meta: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('List event responses error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

// GET /api/events/:id/responses/export
/**
 * @swagger
 * /api/events/{id}/responses/export:
 *   get:
 *     summary: Exportar respostas de evento em CSV
 *     tags: [Events Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *     responses:
 *       200:
 *         description: CSV com respostas do evento
 *       404:
 *         description: Evento não encontrado
 */
router.get('/:id/responses/export', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id }, include: [{ model: EventQuestion, as: 'questions', order: [['order_index', 'ASC']] }] });
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    const responses = await EventResponse.findAll({
      where: { event_id: event.id },
      include: [{ model: EventAnswer, as: 'answers' }],
      order: [['submitted_at', 'DESC']]
    });

    // campos dinâmicos por perguntas do evento
    const questionFields = (event.questions || []).map(q => ({
      id: q.id,
      header: `Q${q.id} - ${q.question_text}`
    }));

    const rows = responses.map(r => {
      const base = {
        guest_code: r.guest_code,
        selfie_url: r.selfie_url || '',
        submitted_at: r.submitted_at
      };
      for (const qf of questionFields) {
        const ans = (r.answers || []).find(a => a.question_id === qf.id);
        base[qf.header] = ans ? (ans.answer_text != null ? ans.answer_text : JSON.stringify(ans.answer_json)) : '';
      }
      return base;
    });

    // Lazy require para evitar custo quando não usado
    const { Parser } = require('json2csv');
    const fields = ['guest_code', 'selfie_url', 'submitted_at', ...questionFields.map(q => q.header)];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event_${event.id}_responses.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Export responses CSV error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

module.exports = router;