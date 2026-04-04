require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/kyc', require('./routes/kycRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/risk', require('./routes/riskRoutes'));
app.use('/api/policies', require('./routes/policyRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/claims', require('./routes/claimRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// Basic health check route
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        const result = await db.query('SELECT NOW()');
        res.status(200).json({
            status: 'success',
            message: 'Rent-Sure API is running!',
            db_time: result.rows[0].now
        });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to connect to the database',
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
