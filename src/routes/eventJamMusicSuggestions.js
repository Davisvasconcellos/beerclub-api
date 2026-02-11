const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireModule } = require('../middlewares/auth');
const { Op } = require('sequelize');
const { EventJamMusicSuggestion, EventJamMusicSuggestionParticipant, User, EventJam, EventJamSong, EventJamSongInstrumentSlot, EventJamSongCandidate, EventGuest, Event, EventJamMusicCatalog } = require('../models');

const router = express.Router();

/**
 * 0. Buscar Amigos (Usuários no mesmo evento)
 * GET /api/v1/music-suggestions/friends
 * Query Params:
 *  - event_id: UUID do evento (obrigatório)
 *  - q: Filtro por nome (opcional)
 */
router.get('/friends', authenticateToken, requireModule('events'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { q, event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'Validation Error', message: 'event_id é obrigatório' });
    }

    // Buscar o evento pelo UUID para pegar o ID interno
    const event = await Event.findOne({ where: { id_code: event_id } });
    
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    // Buscar usuários checked-in neste evento específico
    const whereClause = {
      event_id: event.id,
      check_in_at: { [Op.ne]: null },
      user_id: { [Op.ne]: null, [Op.ne]: userId } // Exclui guests sem user vinculado e o próprio usuário
    };

    // Filtro por nome
    const userWhere = {};
    if (q) {
      userWhere.name = { [Op.like]: `%${q}%` };
    }

    const friends = await EventGuest.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        where: userWhere,
        attributes: ['id', 'id_code', 'name', 'avatar_url', 'email']
      }],
      limit: 20 // Limitar resultados
    });

    // Mapear para formato simples
    const data = friends.map(g => ({
      user_id: g.user.id_code, // UUID para o front (usado para convidar)
      id: g.user.id_code, // Alias para compatibilidade com componentes de UI que esperam 'id'
      value: g.user.id_code, // Alias para componentes do tipo Select
      label: g.user.name, // Alias para componentes do tipo Select
      guest_id: g.id, // ID interno do guest (útil para debug ou admin)
      name: g.user.name,
      avatar_url: g.user.avatar_url,
      check_in_at: g.check_in_at,
      instrument: null // Placeholder para o front preencher/selecionar
    }));

    return res.json({ success: true, data });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * 1. Listagem e Detalhes
 * GET /api/v1/music-suggestions
 * Query Params:
 *  - event_id: UUID do evento (obrigatório)
 */
router.get('/', authenticateToken, requireModule('events'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'Validation Error', message: 'event_id é obrigatório' });
    }

    const event = await Event.findOne({ where: { id_code: event_id } });
    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    }

    // Configurar cláusula where baseada no papel do usuário
    let whereClause = {
      event_id: event.id
    };

    // Se for Admin ou Master, permite ver sugestões SUBMITTED (para aprovação)
    // ou filtrar por status via query param
    if (['admin', 'master'].includes(req.user.role)) {
      const { status } = req.query;
      
      if (status && status !== 'ALL') {
        whereClause.status = status;
      } else if (!status) {
        // Por padrão, se não especificar status, admin vê as que precisam de atenção (SUBMITTED)
        // Mas se quiser ver todas (incluindo DRAFT dos outros? talvez não DRAFT), 
        // vamos definir que por padrão admin vê SUBMITTED se não passar nada.
        // Se passar status=ALL, vê tudo.
        whereClause.status = 'SUBMITTED';
      }
      // Nota: Admin não tem filtro de user_id, vê de todos
    } else {
      // Usuário comum: vê apenas as suas (criador ou participante)
      whereClause[Op.or] = [
        { created_by_user_id: userId },
        { '$participants.user_id$': userId }
      ];
    }

    const suggestions = await EventJamMusicSuggestion.findAll({
      include: [
        {
          model: EventJamMusicSuggestionParticipant,
          as: 'participants',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'id_code', 'name', 'avatar_url', 'email']
          }]
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'id_code', 'name', 'avatar_url']
        }
      ],
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    // Processar sugestões para adicionar campos computados úteis para o front
    const data = suggestions.map(s => {
      const sJSON = s.toJSON();
      
      // Contagens de status
      const totalParticipants = s.participants.length;
      const acceptedCount = s.participants.filter(p => p.status === 'ACCEPTED').length;
      const pendingCount = s.participants.filter(p => p.status === 'PENDING').length;
      const rejectedCount = s.participants.filter(p => p.status === 'REJECTED').length;

      // Flag para saber se o usuário atual já aceitou (se for convidado)
      const myParticipation = s.participants.find(p => p.user_id === userId);
      const amICreator = s.created_by_user_id === userId;

      // Status "virtual" para exibição no card
      // Se todos aceitaram e sou o criador, posso enviar
      const canSubmit = amICreator && pendingCount === 0 && rejectedCount === 0 && s.status === 'DRAFT';

      return {
        ...sJSON,
        stats: {
          total: totalParticipants,
          accepted: acceptedCount,
          pending: pendingCount,
          rejected: rejectedCount
        },
        user_context: {
          is_creator: amICreator,
          my_status: myParticipation ? myParticipation.status : null,
          can_submit: canSubmit
        }
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * 2. Criar Nova Sugestão
 * POST /api/v1/music-suggestions
 */
router.post('/',
  authenticateToken,
  requireModule('events'),
  [
    body('event_id').isUUID().withMessage('ID do evento é obrigatório'),
    body('song_name').notEmpty().withMessage('Nome da música é obrigatório'),
    body('artist_name').notEmpty().withMessage('Nome do artista é obrigatório'),
    body('my_instrument').notEmpty().withMessage('Seu instrumento é obrigatório'),
    body('cover_image').optional().isString(),
    body('extra_data').optional(),
    body('invites').optional().isArray(),
    body('invites.*.user_id').isUUID(),
    body('invites.*.instrument').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { event_id, song_name, artist_name, my_instrument, cover_image, extra_data, invites = [], catalog_id } = req.body;
    const userId = req.user.userId;

    const event = await Event.findOne({ where: { id_code: event_id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });

    // Validar catalog_id se fornecido
    let catalogEntry = null;
    if (catalog_id) {
        catalogEntry = await EventJamMusicCatalog.findByPk(catalog_id);
        if (!catalogEntry) {
            // Se não encontrar, segue sem link (ou poderia retornar erro, mas melhor ser resiliente)
            console.warn(`Catalog ID ${catalog_id} not found, ignoring link.`);
        }
    }

    const transaction = await EventJamMusicSuggestion.sequelize.transaction();

    try {
      // Criar a sugestão
      const suggestion = await EventJamMusicSuggestion.create({
        event_id: event.id,
        song_name,
        artist_name,
        cover_image,
        extra_data,
        catalog_id: catalogEntry ? catalogEntry.id : null,
        created_by_user_id: userId,
        status: 'DRAFT'
      }, { transaction });

      // Se veio do catálogo, incrementa o contador
      if (catalogEntry) {
        await catalogEntry.increment('usage_count', { transaction });
      }

      // Adicionar o criador como participante (ACCEPTED)
      await EventJamMusicSuggestionParticipant.create({
        music_suggestion_id: suggestion.id,
        user_id: userId,
        instrument: my_instrument,
        is_creator: true,
        status: 'ACCEPTED'
      }, { transaction });

      // Processar convites
      if (invites.length > 0) {
        // Buscar IDs internos dos usuários baseados nos UUIDs fornecidos
        const uuids = invites.map(i => i.user_id);
        const users = await User.findAll({ where: { id_code: uuids }, attributes: ['id', 'id_code'] });
        const userMap = new Map(users.map(u => [u.id_code, u.id]));

        for (const invite of invites) {
          const guestId = userMap.get(invite.user_id);
          if (guestId) {
            await EventJamMusicSuggestionParticipant.create({
              music_suggestion_id: suggestion.id,
              user_id: guestId,
              instrument: invite.instrument,
              is_creator: false,
              status: 'PENDING'
            }, { transaction });
          }
        }
      }

      await transaction.commit();

      // Recarregar com associações para retorno
      const fullSuggestion = await EventJamMusicSuggestion.findByPk(suggestion.id, {
        include: [{
          model: EventJamMusicSuggestionParticipant,
          as: 'participants',
          include: [{ model: User, as: 'user', attributes: ['id', 'id_code', 'name', 'avatar_url'] }]
        }]
      });

      return res.status(201).json({ success: true, data: fullSuggestion });

    } catch (error) {
      await transaction.rollback();
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

/**
 * 2.1 Editar Sugestão (PUT)
 * PUT /api/v1/music-suggestions/:id
 */
router.put('/:id',
  authenticateToken,
  requireModule('events'),
  [
    body('song_name').optional().notEmpty(),
    body('artist_name').optional().notEmpty(),
    body('cover_image').optional().isString(),
    body('extra_data').optional()
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const suggestion = await EventJamMusicSuggestion.findOne({ 
        where: { 
          [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }]
        } 
      });

      if (!suggestion) return res.status(404).json({ error: 'Not Found', message: 'Sugestão não encontrada' });

      // Permitir admin ou criador
      if (suggestion.created_by_user_id !== userId && !['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Apenas o criador ou admin pode editar' });
      }

      // Se for admin, pode editar em qualquer status. Se for criador, só DRAFT.
      if (!['admin', 'master'].includes(req.user.role) && suggestion.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Bad Request', message: 'Apenas sugestões em rascunho podem ser editadas' });
      }

      await suggestion.update(req.body);

      return res.json({ success: true, data: suggestion });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

/**
 * 2.2 Rejeitar Sugestão (REJECT)
 * POST /api/v1/music-suggestions/:id/reject
 */
router.post('/:id/reject', authenticateToken, requireModule('events'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Apenas admins podem rejeitar
    if (!['admin', 'master'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Apenas administradores podem rejeitar sugestões' });
    }

    const suggestion = await EventJamMusicSuggestion.findOne({ 
      where: { 
        [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }]
      } 
    });

    if (!suggestion) return res.status(404).json({ error: 'Not Found', message: 'Sugestão não encontrada' });

    if (suggestion.status === 'REJECTED') {
      return res.status(400).json({ error: 'Bad Request', message: 'Sugestão já está rejeitada' });
    }

    suggestion.status = 'REJECTED';
    await suggestion.save();

    return res.json({ success: true, message: 'Sugestão rejeitada com sucesso', data: suggestion });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * 2.3 Excluir Sugestão (DELETE)
 * DELETE /api/v1/music-suggestions/:id
 */
router.delete('/:id', authenticateToken, requireModule('events'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const suggestion = await EventJamMusicSuggestion.findOne({ 
      where: { 
        [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }]
      } 
    });

    if (!suggestion) return res.status(404).json({ error: 'Not Found', message: 'Sugestão não encontrada' });

    if (suggestion.created_by_user_id !== userId && !['admin', 'master'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Apenas o criador ou admin pode excluir' });
    }

    await suggestion.destroy();
    return res.json({ success: true, message: 'Sugestão excluída com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * 2.3 Enviar Sugestão (SUBMIT)
 * POST /api/v1/music-suggestions/:id/submit
 */
router.post('/:id/submit', authenticateToken, requireModule('events'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const suggestion = await EventJamMusicSuggestion.findOne({ 
      where: { 
        [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }]
      },
      include: [{ model: EventJamMusicSuggestionParticipant, as: 'participants' }]
    });

    if (!suggestion) return res.status(404).json({ error: 'Not Found', message: 'Sugestão não encontrada' });

    if (suggestion.created_by_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'Apenas o criador pode enviar a sugestão' });
    }

    // Validação: Todos os convidados devem estar ACCEPTED
    // Filtra participantes que NÃO são o criador e que NÃO estão ACCEPTED
    const pendingParticipants = suggestion.participants.filter(p => !p.is_creator && p.status !== 'ACCEPTED');

    if (pendingParticipants.length > 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Todos os convidados devem aceitar o convite antes do envio.',
        pending_participants: pendingParticipants.map(p => p.id)
      });
    }

    suggestion.status = 'SUBMITTED';
    await suggestion.save();

    return res.json({ success: true, data: suggestion, message: 'Sugestão enviada para aprovação!' });

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * 3. Gerenciamento de Participantes
 * POST /api/v1/music-suggestions/:id/participants
 */
router.post('/:id/participants', 
  authenticateToken, 
  requireModule('events'),
  [
    body('user_id').isUUID().withMessage('ID do usuário inválido'),
    body('instrument').notEmpty().withMessage('Instrumento é obrigatório')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const { user_id, instrument } = req.body;
      const creatorId = req.user.userId;

      const suggestion = await EventJamMusicSuggestion.findOne({ 
        where: { [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }] }
      });

      if (!suggestion) return res.status(404).json({ error: 'Not Found' });
      if (suggestion.created_by_user_id !== creatorId) return res.status(403).json({ error: 'Forbidden' });
      if (suggestion.status !== 'DRAFT') return res.status(400).json({ error: 'Sugestão não está em rascunho' });

      const guestUser = await User.findOne({ where: { id_code: user_id } });
      if (!guestUser) return res.status(404).json({ error: 'Usuário convidado não encontrado' });

      // Verificar se já existe
      const existing = await EventJamMusicSuggestionParticipant.findOne({
        where: { music_suggestion_id: suggestion.id, user_id: guestUser.id }
      });

      if (existing) return res.status(400).json({ error: 'Usuário já está na lista' });

      const participant = await EventJamMusicSuggestionParticipant.create({
        music_suggestion_id: suggestion.id,
        user_id: guestUser.id,
        instrument,
        is_creator: false,
        status: 'PENDING'
      });

      return res.status(201).json({ success: true, data: participant });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * 3.1 Remover Participante
 * DELETE /api/v1/music-suggestions/:id/participants/:participantId
 * Note: participantId pode ser o ID do participante (PK) ou UUID do user.
 * Vamos assumir que recebemos o UUID do USUÁRIO para remover o convite dele.
 */
router.delete('/:id/participants/:targetUserId', authenticateToken, requireModule('events'), async (req, res) => {
  try {
    const { id, targetUserId } = req.params;
    const creatorId = req.user.userId;

    const suggestion = await EventJamMusicSuggestion.findOne({ 
      where: { [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }] }
    });

    if (!suggestion) return res.status(404).json({ error: 'Not Found' });
    if (suggestion.created_by_user_id !== creatorId) return res.status(403).json({ error: 'Forbidden' });

    // Buscar ID do user alvo
    const targetUser = await User.findOne({ where: { id_code: targetUserId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const deleted = await EventJamMusicSuggestionParticipant.destroy({
      where: {
        music_suggestion_id: suggestion.id,
        user_id: targetUser.id,
        is_creator: false // Não pode se auto-remover por essa rota (ou criador não sai)
      }
    });

    if (!deleted) return res.status(404).json({ error: 'Participante não encontrado nesta sugestão' });

    return res.json({ success: true, message: 'Participante removido' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 4. Ações do Convidado (Aceitar/Recusar)
 * PATCH /api/v1/music-suggestions/:id/participants/me/status
 */
router.patch('/:id/participants/me/status', 
  authenticateToken, 
  requireModule('events'),
  [
    body('status').isIn(['ACCEPTED', 'REJECTED']).withMessage('Status inválido')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.userId;

      const suggestion = await EventJamMusicSuggestion.findOne({ 
        where: { [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }] }
      });

      if (!suggestion) return res.status(404).json({ error: 'Not Found' });

      const participant = await EventJamMusicSuggestionParticipant.findOne({
        where: { music_suggestion_id: suggestion.id, user_id: userId }
      });

      if (!participant) return res.status(403).json({ error: 'Você não é um participante desta sugestão' });

      participant.status = status;
      await participant.save();

      return res.json({ success: true, data: participant });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * 5. Aprovação do Admin (Transformar em Jam Song)
 * POST /api/v1/music-suggestions/:id/approve
 */
router.post('/:id/approve',
  authenticateToken,
  requireModule('events'),
  [
    body('jam_id').optional().isString().withMessage('Jam ID deve ser string (UUID)'),
    body('target_jam_slug').optional().isString(), // Alternativa se quiser buscar por slug
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { jam_id, target_jam_slug } = req.body;
      const adminId = req.user.userId;

      // Verificar permissão de admin/master
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Apenas administradores podem aprovar sugestões' });
      }

      const suggestion = await EventJamMusicSuggestion.findOne({ 
        where: { 
          [Op.or]: [{ id_code: id }, { id: isNaN(id) ? 0 : id }]
        },
        include: [{ model: EventJamMusicSuggestionParticipant, as: 'participants' }]
      });

      if (!suggestion) return res.status(404).json({ error: 'Not Found', message: 'Sugestão não encontrada' });

      // Se for admin/master, permite aprovar mesmo que não esteja em SUBMITTED (ex: DRAFT)
      // Isso facilita testes e permite que o admin crie a sugestão e aprove direto
      if (suggestion.status !== 'SUBMITTED' && !['admin', 'master'].includes(req.user.role)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Apenas sugestões submetidas podem ser aprovadas' });
      }

      // Buscar a Jam (tenta por id_code UUID ou ID numérico)
      let targetJam = null;
      if (jam_id) {
        targetJam = await EventJam.findOne({ 
          where: { 
            [Op.or]: [
              { id_code: jam_id },
              // Se jam_id for numérico, também tenta buscar por ID
              ...(!isNaN(jam_id) ? [{ id: jam_id }] : [])
            ]
          }
        });
      } else if (target_jam_slug) {
        targetJam = await EventJam.findOne({ where: { slug: target_jam_slug } });
      }

      if (!targetJam) {
        return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
      }

      // Iniciar transação para criar tudo
      const transaction = await EventJamMusicSuggestion.sequelize.transaction();

      try {
        const { instrument_slots, pre_approved_candidates } = req.body;

        // 1. Criar a música (EventJamSong)
        const newSong = await EventJamSong.create({
          jam_id: targetJam.id,
          title: suggestion.song_name,
          artist: suggestion.artist_name,
          cover_image: suggestion.cover_image,
          extra_data: suggestion.extra_data,
          catalog_id: suggestion.catalog_id, // Herda o ID do catálogo
          status: 'planned', // Vai para a coluna 'planned'
          ready: false,
          order_index: 999 // Final da fila
        }, { transaction });

        // Increment usage count for catalog item
        if (suggestion.catalog_id) {
          try {
            await EventJamMusicCatalog.increment('usage_count', { where: { id: suggestion.catalog_id }, transaction });
          } catch (e) {
            console.error('Erro ao incrementar usage_count:', e);
          }
        }

        // 2. Processar Instrument Slots e Candidatos
        // Se o frontend enviou estrutura personalizada (instrument_slots), usa ela (Override)
        // Caso contrário, usa a lógica padrão baseada nos participantes da sugestão

        const shouldUseCustomStructure = Array.isArray(instrument_slots) && instrument_slots.length > 0;

        if (shouldUseCustomStructure) {
          // Lógica de Override (Custom Structure)
          for (const s of instrument_slots) {
            await EventJamSongInstrumentSlot.create({ 
              jam_song_id: newSong.id, 
              instrument: s.instrument, 
              slots: s.slots || 1, 
              required: s.required !== undefined ? !!s.required : true, 
              fallback_allowed: s.fallback_allowed !== undefined ? !!s.fallback_allowed : true 
            }, { transaction });
          }

          if (Array.isArray(pre_approved_candidates) && pre_approved_candidates.length) {
            for (const candidate of pre_approved_candidates) {
              if (!candidate.user_id || !candidate.instrument) continue;
              
              const userIdClean = String(candidate.user_id).trim();
              // Frontend sends id_code (UUID) as user_id. Find the internal numeric ID first.
              const user = await User.findOne({ where: { id_code: userIdClean }, transaction });
              if (!user) continue;

              const eventId = targetJam.event_id;
              const guest = await EventGuest.findOne({ where: { event_id: eventId, user_id: user.id }, transaction });
              
              if (guest) {
                 await EventJamSongCandidate.create({
                   jam_song_id: newSong.id,
                   instrument: candidate.instrument,
                   event_guest_id: guest.id,
                   status: 'approved',
                   approved_at: new Date(),
                   approved_by_user_id: adminId
                 }, { transaction });
              }
            }
          }

        } else {
          // Lógica Padrão (Baseada nos participantes da Sugestão)
          // Agrupar participantes por instrumento para saber quantos slots criar
          const participantsByInstrument = {};
          for (const p of suggestion.participants) {
            if (!participantsByInstrument[p.instrument]) {
              participantsByInstrument[p.instrument] = [];
            }
            participantsByInstrument[p.instrument].push(p);
          }

          for (const [instrument, participants] of Object.entries(participantsByInstrument)) {
            // Criar Slot para esse instrumento
            // Quantidade de slots = quantidade de participantes aceitos
            const approvedParticipants = participants.filter(p => p.status === 'ACCEPTED');
            
            if (approvedParticipants.length > 0) {
              await EventJamSongInstrumentSlot.create({
                jam_song_id: newSong.id,
                instrument: instrument,
                slots: approvedParticipants.length,
                required: true,
                fallback_allowed: true
              }, { transaction });

              // Criar Candidatos (EventJamSongCandidate)
              for (const p of approvedParticipants) {
                const eventId = targetJam.event_id;
                const guest = await EventGuest.findOne({
                  where: { event_id: eventId, user_id: p.user_id },
                  transaction // IMPORTANTE: Passar transaction
                });

                if (guest) {
                  await EventJamSongCandidate.create({
                    jam_song_id: newSong.id,
                    instrument: instrument,
                    event_guest_id: guest.id,
                    status: 'approved',
                    applied_at: new Date(),
                    approved_at: new Date(),
                    approved_by_user_id: adminId
                  }, { transaction });
                } else {
                  console.warn(`EventGuest não encontrado para usuário ${p.user_id} no evento ${eventId}`);
                }
              }
            }
          }
        }

        // 3. Atualizar status da sugestão
        suggestion.status = 'APPROVED';
        await suggestion.save({ transaction });

        await transaction.commit();

        return res.json({ 
          success: true, 
          message: 'Sugestão aprovada e adicionada à Jam!',
          data: {
            suggestion_id: suggestion.id,
            jam_song_id: newSong.id,
            jam_id: targetJam.id
          }
        });

      } catch (err) {
        await transaction.rollback();
        throw err;
      }

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

module.exports = router;
