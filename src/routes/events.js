const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middlewares/auth');
const { sequelize } = require('../config/database');
const { Op, fn, col } = require('sequelize');
const { Event, EventQuestion, EventResponse, EventAnswer, User } = require('../models');

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
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               banner_url:
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
  body('banner_url').optional().isURL().withMessage('banner_url inválida'),
  body('start_datetime').optional().isISO8601().toDate(),
  body('end_datetime').optional().isISO8601().toDate(),
  body('questions').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  const { name, slug, banner_url, start_datetime, end_datetime, questions = [] } = req.body;
  const creatorId = req.user.userId;

  try {
    // Slug único
    const existing = await Event.findOne({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Slug já existe' });
    }

    const t = await sequelize.transaction();
    try {
      const event = await Event.create({
        name,
        slug,
        banner_url,
        start_datetime,
        end_datetime,
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
        'id', 'id_code', 'name', 'slug', 'banner_url', 'start_datetime', 'end_datetime', 'created_at',
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
  body('banner_url').optional().isURL()
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

    const allowed = ['name', 'slug', 'banner_url'];
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

module.exports = router;