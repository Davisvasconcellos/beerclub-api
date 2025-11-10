const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middlewares/auth');
const { sequelize } = require('../config/database');
const { Op, fn, col } = require('sequelize');
const { Event, EventQuestion, EventResponse, EventAnswer, User, EventGuest } = require('../models');

const router = express.Router();

/**
 * @swagger
 * /api/v1/events:
 *   post:
 *     summary: Criar evento (admin/master)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug, description, start_datetime, end_datetime, place]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               banner_url:
 *                 type: string
 *               description:
 *                 type: string
 *               public_url:
 *                 type: string
 *               gallery_url:
 *                 type: string
 *               place:
 *                 type: string
 *               resp_email:
 *                 type: string
 *                 format: email
 *               resp_name:
 *                 type: string
 *               resp_phone:
 *                 type: string
 *               color_1:
 *                 type: string
 *               color_2:
 *                 type: string
 *               card_background:
 *                 type: string
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [text, textarea, radio, checkbox, rating, music_preference]
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                     is_required:
 *                       type: boolean
 *                     show_results:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Evento criado com sucesso
 */
// POST /api/v1/events - Cria evento + perguntas
router.post('/', authenticateToken, requireRole('admin', 'master'), [
  body('name').isLength({ min: 2 }).withMessage('Nome é obrigatório.'),
  body('slug').isLength({ min: 2 }).withMessage('Slug é obrigatório.'),
  body('banner_url').optional().isURL({ require_tld: false }).withMessage('banner_url inválida'),
  body('description').isLength({ min: 1 }).withMessage('Descrição é obrigatória.'),
  body('public_url').optional().isURL({ require_tld: false }).withMessage('public_url inválida'),
  body('gallery_url').optional().isURL({ require_tld: false }).withMessage('gallery_url inválida'),
  body('place').isLength({ min: 2 }).withMessage('Local é obrigatório.'),
  body('resp_email').optional().isEmail().withMessage('resp_email inválido'),
  body('resp_name').optional().isString(),
  body('resp_phone').optional().isString(),
  body('color_1').optional().isString(),
  body('color_2').optional().isString(),
  body('card_background').optional().isString(),
  body('start_datetime').isISO8601().toDate().withMessage('start_datetime é obrigatório e deve ser uma data válida.'),
  body('end_datetime').isISO8601().toDate().withMessage('end_datetime é obrigatório e deve ser uma data válida.'),
  body('questions').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  const {
    name,
    slug,
    banner_url,
    start_datetime,
    end_datetime,
    description,
    public_url,
    gallery_url,
    place,
    resp_email,
    resp_name,
    resp_phone,
    color_1,
    color_2,
    card_background,
    questions = []
  } = req.body;
  const creatorId = req.user.userId;

  try {
    // Slug único
    const existing = await Event.findOne({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Slug já existe' });
    }

    // Validação de ordem das datas: end_datetime não pode ser anterior a start_datetime
    if (start_datetime && end_datetime && end_datetime < start_datetime) {
      return res.status(400).json({ error: 'Validation error', message: 'end_datetime não pode ser anterior a start_datetime' });
    }

    const t = await sequelize.transaction();
    try {
      const event = await Event.create({
        name,
        slug,
        banner_url,
        start_datetime,
        end_datetime,
        description,
        public_url,
        gallery_url,
        place,
        resp_email,
        resp_name,
        resp_phone,
        color_1,
        color_2,
        card_background,
        created_by: creatorId
      }, { transaction: t });

      // Criar perguntas, se houver
      if (Array.isArray(questions) && questions.length) {
        const payload = questions.map((q, idx) => ({
          event_id: event.id,
          question_text: q.text,
          question_type: q.type || 'text',
          options: q.options || null,
          is_required: q.is_required !== undefined ? !!q.is_required : true,
          show_results: q.show_results !== undefined ? !!q.show_results : true,
          order_index: idx
        }));
        await EventQuestion.bulkCreate(payload, { transaction: t });
      }

      await t.commit();

      const created = await Event.findByPk(event.id, {
        include: [{ model: EventQuestion, as: 'questions', order: [['order_index', 'ASC']] }]
      });

      return res.status(201).json({ success: true, data: { event: created } });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

 

/**
 * @swagger
 * /api/v1/events:
 *   get:
 *     summary: Listar eventos (admin/master) com paginação e filtros
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *           default: created_at
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *       - in: query
 *         name: slug
 *         schema:
 *           type: string
 *       - in: query
 *         name: created_by
 *         schema:
 *           type: integer
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
 *     responses:
 *       200:
 *         description: Lista paginada de eventos
 */
// GET /api/v1/events - Lista eventos do admin (ou todos se master) com paginação/filtros
router.get('/', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const isMaster = req.user.role === 'master';

    // Query params
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const order = (req.query.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortByAllowed = ['created_at', 'start_datetime', 'end_datetime', 'name'];
    const sortBy = sortByAllowed.includes(req.query.sort_by) ? req.query.sort_by : 'created_at';
    const { name, slug, status, from, to } = req.query;
    const createdBy = req.query.created_by ? parseInt(req.query.created_by, 10) : undefined;

    const where = {};
    if (!isMaster) {
      where.created_by = req.user.userId;
    } else if (createdBy) {
      where.created_by = createdBy;
    }
    if (name) {
      where.name = { [Op.like]: `%${name}%` };
    }
    if (slug) {
      where.slug = { [Op.like]: `%${slug}%` };
    }
    if (from || to) {
      // Filtra por intervalo do início do evento
      where.start_datetime = {};
      if (from) where.start_datetime[Op.gte] = new Date(from);
      if (to) where.start_datetime[Op.lte] = new Date(to);
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

    // Contagem total
    const total = await Event.count({ where });

    // Consulta paginada com coluna derivada de quantidade de perguntas via subquery
    const rows = await Event.findAll({
      where,
      attributes: [
        'id_code', 'name', 'slug', 'description', 'banner_url', 'start_datetime', 'end_datetime', 'created_at',
        [sequelize.literal('(SELECT COUNT(*) FROM event_questions AS eq WHERE eq.event_id = Event.id)'), 'questions_count']
      ],
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
    console.error('List events error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}:
 *   get:
 *     summary: Obter detalhes do evento (admin/master)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *         description: Dados do evento e total de respostas
 *       404:
 *         description: Evento não encontrado
 */
// GET /api/v1/events/:id - Detalhes do evento + perguntas ordenadas + total_responses
router.get('/:id', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findOne({
      where: { id_code: id },
      include: [{
        model: EventQuestion,
        as: 'questions',
        order: [['order_index', 'ASC']]
      }]
    });

    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }

    // Controle de acesso: admin só vê seus eventos
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const total_responses = await EventResponse.count({ where: { event_id: event.id } });

    return res.json({ success: true, data: { event, total_responses } });
  } catch (error) {
    console.error('Get event error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}:
 *   patch:
 *     summary: Atualizar parcialmente evento (admin/master)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               banner_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evento atualizado com sucesso
 *       404:
 *         description: Evento não encontrado
 *       409:
 *         description: Slug já existe
 */
// PATCH /api/v1/events/:id - Atualiza apenas campos enviados, valida slug único
router.patch('/:id', authenticateToken, requireRole('admin', 'master'), [
  body('name').optional().isLength({ min: 2 }),
  body('slug').optional().isLength({ min: 2 }),
  body('banner_url').optional().isURL({ require_tld: false }).withMessage('banner_url inválida'),
  body('description').optional().isString(),
  body('public_url').optional().isURL({ require_tld: false }).withMessage('public_url inválida'),
  body('gallery_url').optional().isURL({ require_tld: false }).withMessage('gallery_url inválida'),
  body('place').optional().isString(),
  body('resp_email').optional().isEmail().withMessage('resp_email inválido'),
  body('resp_name').optional().isString(),
  body('resp_phone').optional().isString(),
  body('color_1').optional().isString(),
  body('color_2').optional().isString(),
  body('card_background').optional().isString(),
  body('start_datetime').optional().isISO8601().toDate().withMessage('start_datetime deve ser uma data válida'),
  body('end_datetime').optional().isISO8601().toDate().withMessage('end_datetime deve ser uma data válida')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }

    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const allowed = ['name', 'slug', 'banner_url', 'description', 'public_url', 'gallery_url', 'place', 'resp_email', 'resp_name', 'resp_phone', 'color_1', 'color_2', 'card_background', 'start_datetime', 'end_datetime'];
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    if (updateData.slug && updateData.slug !== event.slug) {
      const exists = await Event.findOne({ where: { slug: updateData.slug, id: { [Op.ne]: event.id } } });
      if (exists) {
        return res.status(409).json({ error: 'Duplicate entry', message: 'Slug já existe' });
      }
    }

    // Validação de ordem das datas no PATCH: calcula valores finais e compara
    const newStart = updateData.start_datetime !== undefined ? updateData.start_datetime : event.start_datetime;
    const newEnd = updateData.end_datetime !== undefined ? updateData.end_datetime : event.end_datetime;
    if (newStart && newEnd && newEnd < newStart) {
      return res.status(400).json({ error: 'Validation error', message: 'end_datetime não pode ser anterior a start_datetime' });
    }

    await event.update(updateData);

    return res.json({ success: true, message: 'Evento atualizado com sucesso', data: { event } });
  } catch (error) {
    console.error('Patch event error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}:
 *   delete:
 *     summary: Remover evento (soft delete)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *         description: Evento removido (soft delete)
 *       404:
 *         description: Evento não encontrado
 */
// DELETE /api/v1/events/:id - Soft delete
router.delete('/:id', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }

    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    // Soft delete
    await event.update({ deleted_at: new Date() });

    return res.json({ success: true, message: 'Evento removido (soft delete)' });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/questions:
 *   get:
 *     summary: Listar perguntas do evento (admin/master)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *         description: Lista de perguntas do evento
 *       404:
 *         description: Evento não encontrado
 */
router.get('/:id/questions', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }

    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const questions = await EventQuestion.findAll({ where: { event_id: event.id }, order: [['order_index', 'ASC']] });
    return res.json({ success: true, data: { questions } });
  } catch (error) {
    console.error('List questions error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/questions:
 *   post:
 *     summary: Criar nova pergunta para o evento (admin/master)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
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
 *             required: [text, type]
 *             properties:
 *               text:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, textarea, radio, checkbox, rating, music_preference]
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_required:
 *                 type: boolean
 *               show_results:
 *                 type: boolean
 *               order_index:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Pergunta criada com sucesso
 *       404:
 *         description: Evento não encontrado
 */
router.post('/:id/questions', authenticateToken, requireRole('admin', 'master'), [
  body('text').isLength({ min: 1 }).withMessage('text é obrigatório'),
  body('type').isIn(['text', 'textarea', 'radio', 'checkbox', 'rating', 'music_preference']).withMessage('type inválido'),
  body('options').optional(),
  body('is_required').optional().isBoolean(),
  body('show_results').optional().isBoolean(),
  body('order_index').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const maxOrder = await EventQuestion.max('order_index', { where: { event_id: event.id } });
    const orderIndex = (req.body.order_index !== undefined) ? parseInt(req.body.order_index, 10) : (Number.isFinite(maxOrder) ? maxOrder + 1 : 0);

    const question = await EventQuestion.create({
      event_id: event.id,
      question_text: req.body.text,
      question_type: req.body.type,
      options: Array.isArray(req.body.options) ? req.body.options : (req.body.options || null),
      is_required: req.body.is_required !== undefined ? !!req.body.is_required : true,
      show_results: req.body.show_results !== undefined ? !!req.body.show_results : true,
      order_index: orderIndex
    });

    return res.status(201).json({ success: true, data: { question } });
  } catch (error) {
    console.error('Create question error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/questions/{questionId}:
 *   patch:
 *     summary: Atualizar pergunta do evento (admin/master)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, textarea, radio, checkbox, rating, music_preference]
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_required:
 *                 type: boolean
 *               show_results:
 *                 type: boolean
 *               order_index:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Pergunta atualizada com sucesso
 *       404:
 *         description: Evento/Pergunta não encontrado
 */
router.patch('/:id/questions/:questionId', authenticateToken, requireRole('admin', 'master'), [
  body('text').optional().isLength({ min: 1 }),
  body('type').optional().isIn(['text', 'textarea', 'radio', 'checkbox', 'rating', 'music_preference']),
  body('options').optional(),
  body('is_required').optional().isBoolean(),
  body('show_results').optional().isBoolean(),
  body('order_index').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  try {
    const { id, questionId } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const question = await EventQuestion.findOne({ where: { id: questionId, event_id: event.id } });
    if (!question) {
      return res.status(404).json({ error: 'Not found', message: 'Pergunta não encontrada' });
    }

    const allowed = ['question_text', 'question_type', 'options', 'is_required', 'show_results', 'order_index'];
    const updateData = {};
    if (req.body.text !== undefined) updateData.question_text = req.body.text;
    if (req.body.type !== undefined) updateData.question_type = req.body.type;
    if (req.body.options !== undefined) updateData.options = Array.isArray(req.body.options) ? req.body.options : req.body.options;
    if (req.body.is_required !== undefined) updateData.is_required = !!req.body.is_required;
    if (req.body.show_results !== undefined) updateData.show_results = !!req.body.show_results;
    if (req.body.order_index !== undefined) updateData.order_index = parseInt(req.body.order_index, 10);

    // Garantir que só campos permitidos sejam atualizados
    for (const key of Object.keys(updateData)) {
      if (!allowed.includes(key)) delete updateData[key];
    }

    await question.update(updateData);
    return res.json({ success: true, message: 'Pergunta atualizada com sucesso', data: { question } });
  } catch (error) {
    console.error('Patch question error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/questions/{questionId}:
 *   delete:
 *     summary: Excluir pergunta do evento (remove respostas relacionadas)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pergunta excluída com sucesso
 *       404:
 *         description: Evento/Pergunta não encontrado
 */
router.delete('/:id/questions/:questionId', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found', message: 'Evento não encontrado' });
    }
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const question = await EventQuestion.findOne({ where: { id: questionId, event_id: event.id } });
    if (!question) {
      return res.status(404).json({ error: 'Not found', message: 'Pergunta não encontrada' });
    }

    // Remover respostas associadas à pergunta (segurança adicional além de constraints)
    await EventAnswer.destroy({ where: { question_id: question.id } });
    await question.destroy();

    return res.json({ success: true, message: 'Pergunta excluída com sucesso' });
  } catch (error) {
    console.error('Delete question error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/checkin/lookup:
 *   post:
 *     summary: Buscar convidados por nome/email/documento (portaria)
 *     tags: [Event Guests]
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Possíveis matches para check-in
 */
router.post('/:id/checkin/lookup', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = req.body;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const where = { event_id: event.id };
    if (query) {
      where[Op.or] = [
        { guest_name: { [Op.like]: `%${query}%` } },
        { guest_email: { [Op.like]: `%${query}%` } },
        { guest_document_number: { [Op.like]: `%${query}%` } }
      ];
    }
    const guests = await EventGuest.findAll({ where, limit: 20 });
    return res.json({ success: true, data: { guests } });
  } catch (error) {
    console.error('Lookup event guests error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/checkin/confirm:
 *   post:
 *     summary: Confirmar check-in de convidado (portaria)
 *     tags: [Event Guests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guest_id]
 *             properties:
 *               guest_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Check-in confirmado
 */
router.post('/:id/checkin/confirm', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const { guest_id } = req.body;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const guest = await EventGuest.findOne({ where: { id: guest_id, event_id: event.id } });
    if (!guest) return res.status(404).json({ error: 'Not Found', message: 'Convidado não encontrado' });

    await guest.update({ check_in_at: new Date(), check_in_method: 'staff_manual', authorized_by_user_id: req.user.userId });
    return res.json({ success: true, data: { guest } });
  } catch (error) {
    console.error('Confirm check-in error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/checkin/manual:
 *   post:
 *     summary: Cadastro rápido e check-in (portaria)
 *     tags: [Event Guests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guest_name]
 *             properties:
 *               guest_name: { type: string }
 *               guest_phone: { type: string }
 *               guest_document_type: { type: string, enum: [rg, cpf, passport] }
 *               guest_document_number: { type: string }
 *               type: { type: string, enum: [normal, vip, premium] }
 *     responses:
 *       201:
 *         description: Convidado criado com check-in
 */
router.post('/:id/checkin/manual', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const { guest_name, guest_phone, guest_document_type, guest_document_number, type } = req.body;
    if (!guest_name) return res.status(400).json({ error: 'Validation error', message: 'guest_name é obrigatório' });

    const payload = {
      event_id: event.id,
      user_id: null,
      guest_name,
      guest_email: null,
      guest_phone: guest_phone || null,
      guest_document_type: guest_document_type || null,
      guest_document_number: guest_document_number || null,
      type: ['normal', 'vip', 'premium'].includes(type) ? type : 'normal',
      source: 'walk_in',
      rsvp_confirmed: false,
      rsvp_at: null,
      invited_at: new Date(),
      invited_by_user_id: req.user.userId,
      check_in_at: new Date(),
      check_in_method: 'staff_manual',
      authorized_by_user_id: req.user.userId
    };

    const created = await EventGuest.create(payload);
    return res.status(201).json({ success: true, data: { guest: created } });
  } catch (error) {
    console.error('Manual check-in error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Convidado duplicado por email/documento/usuário' });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/guests/{guestId}:
 *   patch:
 *     summary: Atualizar convidado do evento
 *     tags: [Event Guests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guest_name: { type: string }
 *               guest_email: { type: string }
 *               guest_phone: { type: string }
 *               guest_document_type: { type: string, enum: [rg, cpf, passport] }
 *               guest_document_number: { type: string }
 *               type: { type: string, enum: [normal, vip, premium] }
 *               rsvp_confirmed: { type: boolean }
 *               rsvp_at: { type: string, format: date-time, nullable: true }
 *               check_in_at: { type: string, format: date-time, nullable: true }
 *     responses:
 *       200:
 *         description: Convidado atualizado com sucesso
 */
router.patch('/:id/guests/:guestId', authenticateToken, requireRole('admin', 'master'), [
  body('guest_email').optional().isEmail(),
  body('guest_phone').optional().isString(),
  body('guest_document_type').optional().isIn(['rg', 'cpf', 'passport']),
  body('type').optional().isIn(['normal', 'vip', 'premium']),
  body('rsvp_confirmed').optional().isBoolean(),
  body('rsvp_at').optional({ nullable: true }).isISO8601().toDate(),
  body('check_in_at').optional({ nullable: true }).isISO8601().toDate(),
  body('check_in_method').optional().isIn(['google', 'staff_manual', 'invited_qr']),
  body('authorized_by_user_id').optional().isInt()
], async (req, res) => {
  try {
    const { id, guestId } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation error', details: errors.array() });
    }

    const guest = await EventGuest.findOne({ where: { id: guestId, event_id: event.id } });
    if (!guest) return res.status(404).json({ error: 'Not Found', message: 'Convidado não encontrado' });

    const update = {};
    const fields = ['guest_name', 'guest_email', 'guest_phone', 'guest_document_type', 'guest_document_number', 'type', 'rsvp_confirmed'];
    for (const f of fields) if (req.body[f] !== undefined) update[f] = req.body[f];
    if (req.body.rsvp_at !== undefined) {
      update.rsvp_at = req.body.rsvp_at ? new Date(req.body.rsvp_at) : null;
      // Se rsvp_confirmed não foi explicitamente enviado, sincroniza com rsvp_at
      if (update.rsvp_confirmed === undefined) {
        update.rsvp_confirmed = !!update.rsvp_at;
      }
    }

    // Permitir remoção/ajuste de check-in
    if (req.body.check_in_at !== undefined) {
      update.check_in_at = req.body.check_in_at ? new Date(req.body.check_in_at) : null;
      if (update.check_in_at === null) {
        update.check_in_method = null;
        update.authorized_by_user_id = null;
      } else {
        // Se está marcando check-in e método/autorizador não foram enviados,
        // definir defaults com base no usuário logado
        if (req.body.check_in_method === undefined && update.check_in_method === undefined) {
          update.check_in_method = 'staff_manual';
        }
        if (req.body.authorized_by_user_id === undefined && update.authorized_by_user_id === undefined) {
          update.authorized_by_user_id = req.user.userId;
        }
      }
    }

    if (req.body.check_in_method !== undefined) {
      update.check_in_method = req.body.check_in_method;
    }
    if (req.body.authorized_by_user_id !== undefined) {
      update.authorized_by_user_id = req.body.authorized_by_user_id;
    }

    await guest.update(update);
    return res.json({ success: true, data: { guest } });
  } catch (error) {
    console.error('Update event guest error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Convidado duplicado por email/documento/usuário' });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/guests:
 *   get:
 *     summary: Listar convidados do evento com filtros
 *     tags: [Event Guests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: id_code do evento (UUID)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [normal, vip, premium]
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [invited, walk_in]
 *       - in: query
 *         name: checked_in
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: checkin
 *         schema:
 *           type: boolean
 *         description: Alias de checked_in
 *       - in: query
 *         name: rsvp
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista unificada de convidados
 */
router.get('/:id/guests', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });

    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size || '20', 10), 1), 100);
    const offset = (page - 1) * pageSize;

    const { search, type, source, checked_in, checkin, rsvp } = req.query;
    const where = { event_id: event.id };
    if (type && ['normal', 'vip', 'premium'].includes(type)) where.type = type;
    if (source && ['invited', 'walk_in'].includes(source)) where.source = source;
    const checkedParam = checked_in !== undefined ? checked_in : checkin;
    if (checkedParam !== undefined) {
      if (String(checkedParam).toLowerCase() === 'true') {
        where.check_in_at = { [Op.ne]: null };
      } else {
        where.check_in_at = null;
      }
    }
    if (rsvp !== undefined) {
      where.rsvp_confirmed = String(rsvp).toLowerCase() === 'true';
    }
    if (search) {
      where[Op.or] = [
        { guest_name: { [Op.like]: `%${search}%` } },
        { guest_email: { [Op.like]: `%${search}%` } },
        { guest_document_number: { [Op.like]: `%${search}%` } }
      ];
    }

    const total = await EventGuest.count({ where });
    const guests = await EventGuest.findAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'id_code', 'name', 'email', 'phone', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    const normalized = guests.map(g => {
      const origin_status = g.source === 'invited'
        ? 'pre_list'
        : (g.check_in_method === 'google' ? 'open_login' : 'front_desk');
      return {
        id: g.id,
        display_name: g.user?.name || g.guest_name,
        avatar_url: g.user?.avatar_url || null,
        email: g.user?.email || g.guest_email || null,
        document: g.guest_document_number ? { type: g.guest_document_type, number: g.guest_document_number } : null,
        phone: g.user?.phone || g.guest_phone || null,
        type: g.type,
        origin_status,
        rsvp: !!g.rsvp_at,
        rsvp_at: g.rsvp_at,
        check_in_at: g.check_in_at,
        checked_in: !!g.check_in_at,
        check_in_method: g.check_in_method
      };
    });

    return res.json({ success: true, data: { guests: normalized }, meta: { total, page, page_size: pageSize, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error('List event guests error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/v1/events/{id}/guests:
 *   post:
 *     summary: Criar convidados (suporta bulk) para o evento
 *     tags: [Event Guests]
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               guests:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [guest_name]
 *                   properties:
 *                     guest_name: { type: string }
 *                     guest_email: { type: string }
 *                     guest_phone: { type: string }
 *                     guest_document_type: { type: string, enum: [rg, cpf, passport] }
 *                     guest_document_number: { type: string }
 *                     type: { type: string, enum: [normal, vip, premium] }
 *                     source: { type: string, enum: [invited, walk_in] }
 *                     rsvp_confirmed:
 *                       type: boolean
 *                       description: Se omitido, será definido como !!rsvp_at
 *                     rsvp_at:
 *                       type: string
 *                       format: date-time
 *                 description: "Se rsvp_confirmed não for enviado, será sincronizado como !!rsvp_at"
 *     responses:
 *       201:
 *         description: Convidados criados
 */
router.post('/:id/guests', authenticateToken, requireRole('admin', 'master'), [
  body('guests').isArray({ min: 1 }).withMessage('guests deve ser uma lista com ao menos 1 item'),
], async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied', message: 'Acesso negado' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation error', details: errors.array() });
    }

    const { guests } = req.body;
    const toCreate = guests.map(g => ({
      event_id: event.id,
      user_id: g.user_id || null,
      guest_name: g.guest_name,
      guest_email: g.guest_email || null,
      guest_phone: g.guest_phone || null,
      guest_document_type: g.guest_document_type || null,
      guest_document_number: g.guest_document_number || null,
      type: ['normal', 'vip', 'premium'].includes(g.type) ? g.type : 'normal',
      source: ['invited', 'walk_in'].includes(g.source) ? g.source : 'invited',
      rsvp_confirmed: g.rsvp_confirmed !== undefined ? !!g.rsvp_confirmed : !!g.rsvp_at,
      rsvp_at: g.rsvp_at ? new Date(g.rsvp_at) : null,
      invited_at: new Date(),
      invited_by_user_id: req.user.userId
    }));

    const created = await EventGuest.bulkCreate(toCreate, { validate: true, returning: true });
    return res.status(201).json({ success: true, data: { guests: created } });
  } catch (error) {
    console.error('Create event guests error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Convidado duplicado por email/documento/usuário' });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

module.exports = router;