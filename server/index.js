const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./db/knex'); // Initialize database connection

const app = express();

// Configure CORS
app.use(cors({
  origin: 'http://localhost:3000', // React app's address
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Mount user routes
const userRoutes = require('./routes/userRoutes');
app.use('/api', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
