const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middlewares/auth');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Event, EventJam, EventJamSong, EventJamSongInstrumentSlot, EventJamSongCandidate, EventJamSongRating, EventGuest, User } = require('../models');

const router = express.Router();

const sseClients = new Map();
const getKey = (eventId, jamId) => `${eventId}-${jamId}`;
const emitEvent = (eventId, jamId, type, payload) => {
  const key = getKey(eventId, jamId);
  const set = sseClients.get(key);
  if (!set) return;
  const data = JSON.stringify({ type, payload });
  for (const res of set) {
    res.write(`data: ${data}\n\n`);
  }
};

router.get('/:id/jams/:jamId/stream', (req, res) => {
  const { id, jamId } = req.params;
  req.headers['x-no-compression'] = 'true';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const key = getKey(id, jamId);
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  const set = sseClients.get(key);
  set.add(res);
  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch {}
  }, 30000);
  req.on('close', () => {
    set.delete(res);
    clearInterval(heartbeat);
  });
});

router.get('/:id/jams', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  if (req.user.role !== 'master' && event.created_by !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  const onlyReal = String(req.query.only_real || 'false').toLowerCase() === 'true';
  const jams = await EventJam.findAll({
    where: { event_id: event.id },
    include: [{
      model: EventJamSong,
      as: 'songs',
      separate: true,
      order: [['order_index', 'ASC']],
      include: [
        { model: EventJamSongInstrumentSlot, as: 'instrumentSlots' },
        { model: EventJamSongCandidate, as: 'candidates', include: [{ model: EventGuest, as: 'guest', include: [{ model: User, as: 'user', attributes: ['id', 'id_code', 'name', 'email', 'avatar_url'] }] }] },
        { model: EventJamSongRating, as: 'ratings' }
      ]
    }]
  });
  const data = jams.map(j => {
    const songs = (j.songs || []).slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map(s => {
      const byInstrument = {};
      for (const slot of (s.instrumentSlots || [])) {
        byInstrument[slot.instrument] = { instrument: slot.instrument, slots: slot.slots, required: slot.required, fallback_allowed: slot.fallback_allowed, approved: [], pending: [] };
      }
      for (const c of (s.candidates || [])) {
        if (onlyReal && !(c.guest && c.guest.user)) continue;
        const bucket = byInstrument[c.instrument] || (byInstrument[c.instrument] = { instrument: c.instrument, slots: 0, required: false, fallback_allowed: true, approved: [], pending: [] });
        const displayName = c.guest?.user?.name || c.guest?.guest_name || null;
        const email = c.guest?.user?.email || c.guest?.guest_email || null;
        const avatar_url = c.guest?.user?.avatar_url || null;
        const entry = { candidate_id: c.id, guest_id: c.event_guest_id, display_name: displayName, email, avatar_url, status: c.status };
        if (c.status === 'approved') bucket.approved.push(entry); else bucket.pending.push(entry);
      }
      const ratings = s.ratings || [];
      const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) : null;
      return {
        id: s.id,
        jam_id: s.jam_id,
        title: s.title,
        artist: s.artist,
        status: s.status,
        ready: !!s.ready,
        order_index: s.order_index,
        release_batch: s.release_batch,
        instrument_buckets: Object.values(byInstrument),
        rating_summary: ratings.length ? { average: Number(avg.toFixed(2)), count: ratings.length } : null
      };
    });
    return { id: j.id, event_id: j.event_id, name: j.name, slug: j.slug, status: j.status, notes: j.notes, order_index: j.order_index, songs };
  });
  return res.json({ success: true, data });
});

router.get('/:id/jams/songs', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  if (req.user.role !== 'master' && event.created_by !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
  const jams = await EventJam.findAll({ where: { event_id: event.id } });
  const jamIds = jams.map(j => j.id);

  const { status, search, release_batch, page = 1, page_size = 20, order = 'asc', sort_by = 'order_index' } = req.query;
  const onlyReal = String(req.query.only_real || 'false').toLowerCase() === 'true';
  const where = { jam_id: { [Op.in]: jamIds } };
  if (status && ['planned','open_for_candidates','on_stage','played','canceled'].includes(status)) where.status = status;
  if (release_batch !== undefined) where.release_batch = release_batch;
  if (search) where.title = { [Op.like]: `%${search}%` };

  const offset = (Math.max(parseInt(page), 1) - 1) * Math.max(parseInt(page_size), 1);
  const limit = Math.max(parseInt(page_size), 1);
  const sortField = ['order_index','title','status','created_at'].includes(sort_by) ? sort_by : 'order_index';
  const sortDir = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const total = await EventJamSong.count({ where });
  const songs = await EventJamSong.findAll({
    where,
    order: [[sortField, sortDir]],
    offset,
    limit,
    include: [
      { model: EventJamSongInstrumentSlot, as: 'instrumentSlots' },
      { model: EventJamSongCandidate, as: 'candidates', include: [{ model: EventGuest, as: 'guest', include: [{ model: User, as: 'user', attributes: ['id', 'id_code', 'name', 'email', 'avatar_url'] }] }] },
      { model: EventJamSongRating, as: 'ratings' }
    ]
  });

  const data = songs.map(s => {
    const byInstrument = {};
    for (const slot of (s.instrumentSlots || [])) {
      byInstrument[slot.instrument] = { instrument: slot.instrument, slots: slot.slots, required: slot.required, fallback_allowed: slot.fallback_allowed, approved: [], pending: [] };
    }
    for (const c of (s.candidates || [])) {
      if (onlyReal && !(c.guest && c.guest.user)) continue;
      const bucket = byInstrument[c.instrument] || (byInstrument[c.instrument] = { instrument: c.instrument, slots: 0, required: false, fallback_allowed: true, approved: [], pending: [] });
      const displayName = c.guest?.user?.name || c.guest?.guest_name || null;
      const email = c.guest?.user?.email || c.guest?.guest_email || null;
      const avatar_url = c.guest?.user?.avatar_url || null;
      const entry = { candidate_id: c.id, guest_id: c.event_guest_id, display_name: displayName, email, avatar_url, status: c.status };
      if (c.status === 'approved') bucket.approved.push(entry); else bucket.pending.push(entry);
    }
    const ratings = s.ratings || [];
    const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) : null;
    return {
      id: s.id,
      jam_id: s.jam_id,
      title: s.title,
      artist: s.artist,
      status: s.status,
      ready: !!s.ready,
      order_index: s.order_index,
      release_batch: s.release_batch,
      instrument_buckets: Object.values(byInstrument),
      rating_summary: ratings.length ? { average: Number(avg.toFixed(2)), count: ratings.length } : null
    };
  });

  return res.json({ success: true, data, meta: { page: parseInt(page), page_size: parseInt(page_size), total } });
});

router.post('/:id/jams', authenticateToken, requireRole('admin', 'master'), [
  body('name').isLength({ min: 2 }),
  body('slug').isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
    const { name, slug, notes, status, order_index } = req.body;

    const exists = await EventJam.findOne({
      where: {
        [Op.or]: [
          { event_id: event.id, name },
          { slug }
        ]
      }
    });
    if (exists) {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Jam já está cadastrada', details: [{ field: exists.slug === slug ? 'slug' : 'name', issue: 'duplicate' }] });
    }

    const jam = await EventJam.create({ event_id: event.id, name, slug, notes: notes || null, status: status || 'active', order_index: order_index || 0 });
    return res.status(201).json({ success: true, data: jam });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Jam já está cadastrada', details: [{ field: 'slug', issue: 'duplicate' }] });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

router.post('/:id/jams/:jamId/songs', authenticateToken, requireRole('admin', 'master'), [
  body('title').isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const { title, artist, key, tempo_bpm, notes, release_batch, status, order_index } = req.body;
  const song = await EventJamSong.create({ jam_id: jam.id, title, artist: artist || null, key: key || null, tempo_bpm: tempo_bpm || null, notes: notes || null, release_batch: release_batch || null, status: status || 'planned', order_index: order_index || 0 });
  emitEvent(id, jamId, 'song_created', { song_id: song.id });
  return res.status(201).json({ success: true, data: song });
});

router.post('/:id/jams/songs', authenticateToken, requireRole('admin', 'master'), [
  body('title').isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
    const { id } = req.params;
    const event = await Event.findOne({ where: { id_code: id } });
    if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
    if (req.user.role !== 'master' && event.created_by !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

    let jam = await EventJam.findOne({ where: { event_id: event.id } });
    if (!jam) {
      const defaultSlug = `jam-${event.slug}`;
      const defaultName = event.name;
      jam = await EventJam.create({ event_id: event.id, name: defaultName, slug: defaultSlug, status: 'active', order_index: 0 });
    }

    const { title, artist, key, tempo_bpm, notes, release_batch, status, order_index, instrument_slots } = req.body;
    const song = await EventJamSong.create({ jam_id: jam.id, title, artist: artist || null, key: key || null, tempo_bpm: tempo_bpm || null, notes: notes || null, release_batch: release_batch || null, status: status || 'planned', order_index: order_index || 0 });

    if (Array.isArray(instrument_slots) && instrument_slots.length) {
      for (const s of instrument_slots) {
        await EventJamSongInstrumentSlot.create({ jam_song_id: song.id, instrument: s.instrument, slots: s.slots || 1, required: s.required !== undefined ? !!s.required : true, fallback_allowed: s.fallback_allowed !== undefined ? !!s.fallback_allowed : true });
      }
      emitEvent(id, String(jam.id), 'instrument_slots_updated', { song_id: song.id });
    }

    emitEvent(id, String(jam.id), 'song_created', { song_id: song.id });
    return res.status(201).json({ success: true, data: { jam, song } });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Slug de jam ou configuração duplicada' });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Erro interno do servidor' });
  }
});

router.post('/:id/jams/:jamId/songs/:songId/instrument-slots', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id, jamId, songId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  const slots = Array.isArray(req.body) ? req.body : (req.body.instrument_slots || []);
  const tx = await EventJamSongInstrumentSlot.sequelize.transaction();
  try {
    await EventJamSongInstrumentSlot.destroy({ where: { jam_song_id: song.id }, transaction: tx });
    for (const s of slots) {
      await EventJamSongInstrumentSlot.create({ jam_song_id: song.id, instrument: s.instrument, slots: s.slots || 1, required: s.required !== undefined ? !!s.required : true, fallback_allowed: s.fallback_allowed !== undefined ? !!s.fallback_allowed : true }, { transaction: tx });
    }
    await tx.commit();
    emitEvent(id, jamId, 'instrument_slots_updated', { song_id: song.id });
    return res.json({ success: true });
  } catch (e) {
    await tx.rollback();
    return res.status(400).json({ error: 'Validation error', message: e.message });
  }
});

router.post('/:id/jams/:jamId/songs/release', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id, jamId } = req.params;
  const { song_ids, action } = req.body || {};
  if (!Array.isArray(song_ids) || !song_ids.length) return res.status(400).json({ error: 'Validation error', message: 'song_ids obrigatório' });
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const maxOpen = parseInt(process.env.JAM_MAX_OPEN_SONGS || '5');
  if (action === 'open') {
    const currentOpen = await EventJamSong.count({ where: { jam_id: jam.id, status: 'open_for_candidates' } });
    if (currentOpen + song_ids.length > maxOpen) return res.status(400).json({ error: 'Validation error', message: 'Limite de músicas abertas excedido' });
    await EventJamSong.update({ status: 'open_for_candidates' }, { where: { id: { [Op.in]: song_ids }, jam_id: jam.id } });
    emitEvent(id, jamId, 'songs_opened', { song_ids });
  } else if (action === 'close') {
    await EventJamSong.update({ status: 'planned', ready: false }, { where: { id: { [Op.in]: song_ids }, jam_id: jam.id } });
    const notApproved = await EventJamSongCandidate.findAll({ where: { jam_song_id: { [Op.in]: song_ids }, status: { [Op.ne]: 'approved' } } });
    for (const c of notApproved) {
      await c.update({ status: 'rejected' });
      emitEvent(id, jamId, 'candidate_rejected', { song_id: c.jam_song_id, instrument: c.instrument });
    }
    emitEvent(id, jamId, 'songs_closed', { song_ids });
  } else {
    return res.status(400).json({ error: 'Validation error', message: 'Ação inválida' });
  }
  return res.json({ success: true });
});

router.get('/:id/jams/:jamId/songs/open', async (req, res) => {
  const { id, jamId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const songs = await EventJamSong.findAll({ where: { jam_id: jam.id, status: 'open_for_candidates' }, order: [['order_index', 'ASC']], include: [{ model: EventJamSongInstrumentSlot, as: 'instrumentSlots' }, { model: EventJamSongCandidate, as: 'candidates' }, { model: EventJamSongRating, as: 'ratings' }] });

  let authUserId = null;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      authUserId = decoded.userId;
    } catch (e) {}
  }
  let myGuest = null;
  if (authUserId) {
    myGuest = await EventGuest.findOne({ where: { event_id: event.id, user_id: authUserId } });
  }
  const data = songs.map(song => {
    const slots = (song.instrumentSlots || []).map(s => {
      const approved = (song.candidates || []).filter(c => c.instrument === s.instrument && c.status === 'approved').length;
      const pending = (song.candidates || []).filter(c => c.instrument === s.instrument && c.status === 'pending').length;
      return { instrument: s.instrument, slots: s.slots, required: s.required, fallback_allowed: s.fallback_allowed, approved_count: approved, pending_count: pending, remaining_slots: Math.max(0, s.slots - approved) };
    });
    const ratings = song.ratings || [];
    const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) : null;
    const requiredCount = slots.filter(s => s.required).length;
    const approvedRequired = slots.filter(s => s.required).reduce((a, s) => a + (s.approved_count > 0 ? 1 : 0), 0);
    const myApp = (myGuest && (song.candidates || []).find(c => c.event_guest_id === myGuest.id)) || null;
    return { id: song.id, jam_id: song.jam_id, title: song.title, artist: song.artist, key: song.key, tempo_bpm: song.tempo_bpm, status: song.status, ready: !!song.ready, order_index: song.order_index, release_batch: song.release_batch, instrument_slots: slots, my_application: myApp ? { instrument: myApp.instrument, status: myApp.status } : null, lineup_completeness: { required_instruments: requiredCount, approved_required: approvedRequired, is_full: approvedRequired === requiredCount }, rating_summary: ratings.length ? { average: Number(avg.toFixed(2)), count: ratings.length } : null };
  });
  return res.json({ success: true, data: { jam: { id: jam.id, event_id: event.id, name: jam.name, status: jam.status }, songs: data } });
});

router.get('/:id/jams/open', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const guest = await EventGuest.findOne({ where: { event_id: event.id, user_id: req.user.userId } });
  if (!guest || !guest.check_in_at) return res.status(403).json({ error: 'Access denied', message: 'Check-in obrigatório para visualizar' });

  const jams = await EventJam.findAll({ where: { event_id: event.id } });
  const jamIds = jams.map(j => j.id);
  const songs = await EventJamSong.findAll({ where: { jam_id: { [Op.in]: jamIds }, status: 'open_for_candidates' }, order: [['order_index', 'ASC']], include: [{ model: EventJamSongInstrumentSlot, as: 'instrumentSlots' }, { model: EventJamSongCandidate, as: 'candidates' }, { model: EventJamSongRating, as: 'ratings' }] });

  const jamsById = jams.reduce((acc, j) => { acc[j.id] = { id: j.id, name: j.name, status: j.status }; return acc; }, {});
  const data = songs.map(song => {
    const slots = (song.instrumentSlots || []).map(s => {
      const approved = (song.candidates || []).filter(c => c.instrument === s.instrument && c.status === 'approved').length;
      const pending = (song.candidates || []).filter(c => c.instrument === s.instrument && c.status === 'pending').length;
      return { instrument: s.instrument, slots: s.slots, required: s.required, fallback_allowed: s.fallback_allowed, approved_count: approved, pending_count: pending, remaining_slots: Math.max(0, s.slots - approved) };
    });
    const ratings = song.ratings || [];
    const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) : null;
    const requiredCount = slots.filter(s => s.required).length;
    const approvedRequired = slots.filter(s => s.required).reduce((a, s) => a + (s.approved_count > 0 ? 1 : 0), 0);
    const myApp = (song.candidates || []).find(c => c.event_guest_id === guest.id) || null;
    return { jam: jamsById[song.jam_id] || { id: song.jam_id }, id: song.id, jam_id: song.jam_id, title: song.title, artist: song.artist, status: song.status, ready: !!song.ready, order_index: song.order_index, release_batch: song.release_batch, instrument_slots: slots, my_application: myApp ? { instrument: myApp.instrument, status: myApp.status } : null, lineup_completeness: { required_instruments: requiredCount, approved_required: approvedRequired, is_full: approvedRequired === requiredCount }, rating_summary: ratings.length ? { average: Number(avg.toFixed(2)), count: ratings.length } : null };
  });
  return res.json({ success: true, data });
});

router.get('/:id/jams/my/on-stage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const guest = await EventGuest.findOne({ where: { event_id: event.id, user_id: req.user.userId } });
  if (!guest || !guest.check_in_at) return res.status(403).json({ error: 'Access denied', message: 'Check-in obrigatório para visualizar' });
  const jams = await EventJam.findAll({ where: { event_id: event.id } });
  const jamIds = jams.map(j => j.id);
  const songs = await EventJamSong.findAll({ where: { jam_id: { [Op.in]: jamIds }, status: 'on_stage' }, order: [['order_index', 'ASC']], include: [{ model: EventJamSongInstrumentSlot, as: 'instrumentSlots' }, { model: EventJamSongCandidate, as: 'candidates' }] });
  const jamsById = jams.reduce((acc, j) => { acc[j.id] = { id: j.id, name: j.name, status: j.status }; return acc; }, {});
  const data = songs.map(song => {
    const myApp = (song.candidates || []).find(c => c.event_guest_id === guest.id && c.status === 'approved') || null;
    if (!myApp) return null;
    const slots = (song.instrumentSlots || []).map(s => ({ instrument: s.instrument, slots: s.slots, required: s.required, fallback_allowed: s.fallback_allowed }));
    return { jam: jamsById[song.jam_id] || { id: song.jam_id }, id: song.id, title: song.title, artist: song.artist, status: song.status, instrument_slots: slots, my_application: { instrument: myApp.instrument, status: myApp.status } };
  }).filter(Boolean);
  return res.json({ success: true, data });
});

router.get('/:id/jam', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const guest = await EventGuest.findOne({ where: { event_id: event.id, user_id: req.user.userId } });
  if (!guest || !guest.check_in_at) return res.status(403).json({ error: 'Access denied', message: 'Check-in obrigatório para visualizar' });
  const jam = await EventJam.findOne({ where: { event_id: event.id }, order: [['order_index', 'ASC']] });
  return res.json({ success: true, data: { jam_id: jam ? jam.id : null } });
});

router.get('/stream-test', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const write = () => {
    const payload = { type: 'stream_test', time: new Date().toISOString(), random: Math.floor(Math.random() * 1000000) };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  write();
  const intervalId = setInterval(write, 2000);
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

router.post('/:id/jams/:jamId/songs/:songId/apply', authenticateToken, [
  body('instrument').isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId, songId } = req.params;
  const { instrument } = req.body;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song || song.status !== 'open_for_candidates') return res.status(400).json({ error: 'Validation error', message: 'Música indisponível para candidatura' });
  const guest = await EventGuest.findOne({ where: { event_id: event.id, user_id: req.user.userId } });
  if (!guest) return res.status(404).json({ error: 'Not Found', message: 'Convidado não encontrado no evento' });
  if (!guest.check_in_at) return res.status(403).json({ error: 'Access denied', message: 'Check-in obrigatório para candidatar-se' });
  const exists = await EventJamSongCandidate.findOne({ where: { jam_song_id: song.id, instrument, event_guest_id: guest.id } });
  if (exists) return res.status(409).json({ error: 'Duplicate entry', message: 'Já candidatado' });
  const created = await EventJamSongCandidate.create({ jam_song_id: song.id, instrument, event_guest_id: guest.id, status: 'pending' });
  emitEvent(id, jamId, 'candidate_applied', { song_id: song.id, instrument });
  return res.status(201).json({ success: true, data: created });
});

router.post('/:id/jams/:jamId/songs/:songId/candidates/:candidateId/approve', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id, jamId, songId, candidateId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  const candidate = await EventJamSongCandidate.findOne({ where: { id: candidateId, jam_song_id: song.id } });
  if (!candidate) return res.status(404).json({ error: 'Not Found', message: 'Candidato não encontrado' });
  const slot = await EventJamSongInstrumentSlot.findOne({ where: { jam_song_id: song.id, instrument: candidate.instrument } });
  if (!slot) return res.status(400).json({ error: 'Validation error', message: 'Instrumento não configurado' });
  const approvedCount = await EventJamSongCandidate.count({ where: { jam_song_id: song.id, instrument: candidate.instrument, status: 'approved' } });
  if (approvedCount >= (slot.slots || 1)) return res.status(400).json({ error: 'Validation error', message: 'Vagas preenchidas' });
  await candidate.update({ status: 'approved', approved_at: new Date(), approved_by_user_id: req.user.userId });
  emitEvent(id, jamId, 'candidate_approved', { song_id: song.id, instrument: candidate.instrument });
  return res.json({ success: true });
});

router.post('/:id/jams/:jamId/songs/:songId/candidates/:candidateId/reject', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id, jamId, songId, candidateId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  const candidate = await EventJamSongCandidate.findOne({ where: { id: candidateId, jam_song_id: song.id } });
  if (!candidate) return res.status(404).json({ error: 'Not Found', message: 'Candidato não encontrado' });
  await candidate.update({ status: 'rejected' });
  emitEvent(id, jamId, 'candidate_rejected', { song_id: song.id, instrument: candidate.instrument });
  return res.json({ success: true });
});

router.post('/:id/jams/:jamId/songs/:songId/move', authenticateToken, requireRole('admin', 'master'), [
  body('status').isIn(['planned','open_for_candidates','on_stage','played','canceled'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId, songId } = req.params;
  const { status } = req.body;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  if (status === 'planned') {
    await song.update({ status: 'planned', ready: false });
  } else if (status === 'open_for_candidates') {
    await song.update({ status: 'open_for_candidates' });
  } else if (status === 'on_stage' || status === 'played') {
    if (!song.ready) return res.status(400).json({ error: 'Validation error', message: 'Música precisa estar aprovada (ready=true) para avançar' });
    await song.update({ status });
  } else if (status === 'canceled') {
    await song.update({ status: 'canceled' });
  }
  emitEvent(id, jamId, 'song_status_changed', { song_id: song.id, status });
  return res.json({ success: true });
});

router.patch('/:id/jams/:jamId/songs/:songId/status', authenticateToken, requireRole('admin', 'master'), [
  body('status').isIn(['planned','open_for_candidates','on_stage','played','canceled'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId, songId } = req.params;
  const { status } = req.body;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  if (status === 'planned') {
    await song.update({ status: 'planned', ready: false });
  } else if (status === 'open_for_candidates') {
    await song.update({ status: 'open_for_candidates' });
  } else if (status === 'on_stage' || status === 'played') {
    if (!song.ready) return res.status(400).json({ error: 'Validation error', message: 'Música precisa estar aprovada (ready=true) para avançar' });
    await song.update({ status });
  } else if (status === 'canceled') {
    await song.update({ status: 'canceled' });
  }
  emitEvent(id, jamId, 'song_status_changed', { song_id: song.id, status });
  return res.json({ success: true });
});

router.patch('/:id/jams/:jamId/songs/:songId/ready', authenticateToken, requireRole('admin', 'master'), [
  body('ready').isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId, songId } = req.params;
  const { ready } = req.body;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  if (song.status !== 'open_for_candidates') return res.status(400).json({ error: 'Validation error', message: 'Toggle permitido apenas em open_for_candidates' });
  await song.update({ ready: !!ready });
  emitEvent(id, jamId, 'song_ready_changed', { song_id: song.id, ready: !!ready });
  return res.json({ success: true });
});

router.patch('/:id/jams/:jamId/songs/order', authenticateToken, requireRole('admin', 'master'), [
  body('status').isIn(['planned','open_for_candidates','on_stage','played','canceled']),
  body('ordered_ids').isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId } = req.params;
  const { status, ordered_ids } = req.body;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const songs = await EventJamSong.findAll({ where: { jam_id: jam.id, status }, order: [['order_index','ASC']] });
  const idsSet = new Set(songs.map(s => s.id));
  const ordered = ordered_ids.map((x) => parseInt(x, 10));
  if (ordered.some((v) => !Number.isFinite(v))) {
    return res.status(400).json({ error: 'Validation error', message: 'ordered_ids deve conter inteiros válidos' });
  }
  for (const sid of ordered) { if (!idsSet.has(sid)) return res.status(400).json({ error: 'Validation error', message: 'ordered_ids contém itens fora do status' }); }
  const byId = new Map(songs.map(s => [s.id, s]));
  let idx = 0;
  for (const sid of ordered) {
    const s = byId.get(sid);
    if (s) { await s.update({ order_index: idx++ }); }
  }
  for (const s of songs) {
    if (!ordered.includes(s.id)) { await s.update({ order_index: idx++ }); }
  }
  emitEvent(id, jamId, 'song_order_changed', { status, ordered_ids: ordered });
  return res.json({ success: true });
});

router.get('/:id/jams/:jamId/users/:userId/queue-position', authenticateToken, async (req, res) => {
  const { id, jamId, userId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  if (req.user.role !== 'master' && req.user.role !== 'admin' && req.user.userId !== parseInt(userId, 10)) return res.status(403).json({ error: 'Access denied' });
  const guest = await EventGuest.findOne({ where: { event_id: event.id, user_id: parseInt(userId, 10) } });
  if (!guest) return res.status(404).json({ error: 'Not Found', message: 'Convidado não encontrado no evento' });
  const queue = await EventJamSong.findAll({ where: { jam_id: jam.id, status: 'open_for_candidates', ready: true }, order: [['order_index','ASC']] });
  const approved = await EventJamSongCandidate.findAll({ where: { event_guest_id: guest.id, status: 'approved', jam_song_id: { [Op.in]: queue.map(s => s.id) } } });
  const positions = approved.map(a => {
    const idx = queue.findIndex(s => s.id === a.jam_song_id);
    return { songId: a.jam_song_id, position: idx >= 0 ? (idx + 1) : null };
  }).filter(p => p.position != null);
  return res.json({ success: true, data: { positions, total: queue.length } });
});

router.delete('/:id/jams/:jamId/songs/:songId', authenticateToken, requireRole('admin', 'master'), async (req, res) => {
  const { id, jamId, songId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  const status = song.status;
  await EventJamSongCandidate.destroy({ where: { jam_song_id: song.id } });
  await EventJamSongInstrumentSlot.destroy({ where: { jam_song_id: song.id } });
  await EventJamSongRating.destroy({ where: { jam_song_id: song.id } });
  await song.destroy();
  const rest = await EventJamSong.findAll({ where: { jam_id: jam.id, status }, order: [['order_index','ASC']] });
  let idx = 0;
  for (const s of rest) { await s.update({ order_index: idx++ }); }
  emitEvent(id, jamId, 'song_deleted', { song_id: parseInt(songId, 10) });
  emitEvent(id, jamId, 'song_order_changed', { status, ordered_ids: rest.map(s => s.id) });
  return res.json({ success: true });
});

router.post('/:id/jams/:jamId/songs/:songId/rate', authenticateToken, [
  body('stars').isInt({ min: 1, max: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });
  const { id, jamId, songId } = req.params;
  const { stars } = req.body;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  if (song.status !== 'played') return res.status(400).json({ error: 'Validation error', message: 'Avaliação permitida apenas após tocar' });
  const [rating, created] = await EventJamSongRating.findOrCreate({ where: { jam_song_id: song.id, user_id: req.user.userId }, defaults: { jam_song_id: song.id, user_id: req.user.userId, stars } });
  if (!created) await rating.update({ stars, rated_at: new Date() });
  const count = await EventJamSongRating.count({ where: { jam_song_id: song.id } });
  const aggregate = await EventJamSongRating.findAll({ where: { jam_song_id: song.id } });
  const avg = aggregate.length ? (aggregate.reduce((a, r) => a + r.stars, 0) / aggregate.length) : 0;
  emitEvent(id, jamId, 'rating_summary_updated', { song_id: song.id, average: Number(avg.toFixed(2)), count });
  return res.json({ success: true });
});

router.get('/:id/jams/:jamId/songs/:songId/ratings', async (req, res) => {
  const { id, jamId, songId } = req.params;
  const event = await Event.findOne({ where: { id_code: id } });
  if (!event) return res.status(404).json({ error: 'Not Found', message: 'Evento não encontrado' });
  const jam = await EventJam.findOne({ where: { id: jamId, event_id: event.id } });
  if (!jam) return res.status(404).json({ error: 'Not Found', message: 'Jam não encontrada' });
  const song = await EventJamSong.findOne({ where: { id: songId, jam_id: jam.id } });
  if (!song) return res.status(404).json({ error: 'Not Found', message: 'Música não encontrada' });
  const ratings = await EventJamSongRating.findAll({ where: { jam_song_id: song.id } });
  const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) : 0;
  return res.json({ success: true, data: { average: ratings.length ? Number(avg.toFixed(2)) : null, count: ratings.length } });
});

module.exports = router;
