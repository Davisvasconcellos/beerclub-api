const { sequelize } = require('../config/database');

// Import models
const Plan = require('./Plan');
const Store = require('./Store');
const User = require('./User');
const TokenBlocklist = require('./TokenBlocklist');
const StoreUser = require('./StoreUser');
const Product = require('./Product');
const FootballTeam = require('./FootballTeam');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const PixPayment = require('./PixPayment');
const Message = require('./Message');
const StoreSchedule = require('./StoreSchedule');
const FinancialTransaction = require('./FinancialTransaction');
const Event = require('./Event');
const EventQuestion = require('./EventQuestion');
const EventResponse = require('./EventResponse');
const EventAnswer = require('./EventAnswer');
const EventGuest = require('./EventGuest');
const EventJam = require('./EventJam');
const EventJamSong = require('./EventJamSong');
const EventJamSongInstrumentSlot = require('./EventJamSongInstrumentSlot');
const EventJamSongCandidate = require('./EventJamSongCandidate');
const EventJamSongRating = require('./EventJamSongRating');

// Define associations

// Plan associations
Plan.hasMany(User, { foreignKey: 'plan_id', as: 'users' });
User.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });

// Store associations
Store.hasMany(Product, { foreignKey: 'store_id', as: 'products' });
Product.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });


Store.hasMany(Order, { foreignKey: 'store_id', as: 'orders' });
Order.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

Store.hasMany(Message, { foreignKey: 'store_id', as: 'messages' });
Message.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// Associação de Proprietário da Loja (Store Owner)
User.hasMany(Store, { foreignKey: 'owner_id', as: 'ownedStores' });
Store.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// Associação de Horários da Loja (Store Schedules)
Store.hasMany(StoreSchedule, { foreignKey: 'store_id', as: 'schedules' });
StoreSchedule.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });



// User associations
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Order, { foreignKey: 'waiter_id', as: 'waiterOrders' });
Order.belongsTo(User, { foreignKey: 'waiter_id', as: 'waiter' });

User.hasMany(Message, { foreignKey: 'from_user_id', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'from_user_id', as: 'fromUser' });

User.hasMany(Message, { foreignKey: 'to_user_id', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'to_user_id', as: 'toUser' });

// StoreUser associations (Many-to-Many between User and Store)
User.belongsToMany(Store, { 
  through: StoreUser, 
  foreignKey: 'user_id', 
  otherKey: 'store_id',
  as: 'stores'
});
Store.belongsToMany(User, { 
  through: StoreUser, 
  foreignKey: 'store_id', 
  otherKey: 'user_id',
  as: 'users'
});

// Product associations
Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Order associations
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(PixPayment, { foreignKey: 'order_id', as: 'pixPayments' });
PixPayment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Team Associações:
User.belongsTo(FootballTeam, { foreignKey: 'team_user', as: 'team' });
FootballTeam.hasMany(User, { foreignKey: 'team_user', as: 'users' });

// Event associations
Event.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Event, { foreignKey: 'created_by', as: 'createdEvents' });

Event.hasMany(EventQuestion, { foreignKey: 'event_id', as: 'questions' });
EventQuestion.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

Event.hasMany(EventResponse, { foreignKey: 'event_id', as: 'responses' });
EventResponse.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
// Vincular respostas ao usuário (quando autenticado)
EventResponse.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(EventResponse, { foreignKey: 'user_id', as: 'eventResponses' });

EventResponse.hasMany(EventAnswer, { foreignKey: 'response_id', as: 'answers' });
EventAnswer.belongsTo(EventResponse, { foreignKey: 'response_id', as: 'response' });

EventQuestion.hasMany(EventAnswer, { foreignKey: 'question_id', as: 'answers' });
EventAnswer.belongsTo(EventQuestion, { foreignKey: 'question_id', as: 'question' });

// EventGuest associations
Event.hasMany(EventGuest, { foreignKey: 'event_id', as: 'guests' });
EventGuest.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
User.hasMany(EventGuest, { foreignKey: 'user_id', as: 'eventGuests' });
EventGuest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Event.hasMany(EventJam, { foreignKey: 'event_id', as: 'jams' });
EventJam.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

EventJam.hasMany(EventJamSong, { foreignKey: 'jam_id', as: 'songs' });
EventJamSong.belongsTo(EventJam, { foreignKey: 'jam_id', as: 'jam' });

EventJamSong.hasMany(EventJamSongInstrumentSlot, { foreignKey: 'jam_song_id', as: 'instrumentSlots' });
EventJamSongInstrumentSlot.belongsTo(EventJamSong, { foreignKey: 'jam_song_id', as: 'song' });

EventJamSong.hasMany(EventJamSongCandidate, { foreignKey: 'jam_song_id', as: 'candidates' });
EventJamSongCandidate.belongsTo(EventJamSong, { foreignKey: 'jam_song_id', as: 'song' });
EventJamSongCandidate.belongsTo(EventGuest, { foreignKey: 'event_guest_id', as: 'guest' });
EventGuest.hasMany(EventJamSongCandidate, { foreignKey: 'event_guest_id', as: 'jamSongCandidates' });

EventJamSong.hasMany(EventJamSongRating, { foreignKey: 'jam_song_id', as: 'ratings' });
EventJamSongRating.belongsTo(EventJamSong, { foreignKey: 'jam_song_id', as: 'song' });
EventJamSongRating.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(EventJamSongRating, { foreignKey: 'user_id', as: 'jamSongRatings' });
EventJamSongRating.belongsTo(EventGuest, { foreignKey: 'event_guest_id', as: 'guest' });
EventGuest.hasMany(EventJamSongRating, { foreignKey: 'event_guest_id', as: 'jamSongRatings' });

User.hasMany(FinancialTransaction, { foreignKey: 'created_by_user_id', as: 'financialTransactions' });
FinancialTransaction.belongsTo(User, { foreignKey: 'created_by_user_id', as: 'createdBy' });

module.exports = {
  sequelize,
  Plan,
  Store,
  User,
  StoreUser,
  Product,
  Order,
  OrderItem,
  PixPayment,
  Message,
  FootballTeam,
  TokenBlocklist,
  StoreSchedule,
  FinancialTransaction,
  Event
  ,EventQuestion
  ,EventResponse
  ,EventAnswer
  ,EventGuest
  ,EventJam
  ,EventJamSong
  ,EventJamSongInstrumentSlot
  ,EventJamSongCandidate
  ,EventJamSongRating
};
