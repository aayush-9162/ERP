require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { applyPostSyncIndexes } = require('./db/postSyncIndexes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Global middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API routes ---
app.use('/api', routes);

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start ---
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync models (use { alter: true } in dev; schema.sql in prod)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Models synchronized.');

    // Apply custom indexes that Sequelize sync() can't express
    // (NULL-safe inventory unique, covering indexes for reports)
    await applyPostSyncIndexes(sequelize);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
