require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
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
app.use('/api/admin', require('./routes/adminRoutes'));

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

// ── Policy Expiry Cron (runs daily at midnight) ───────────────────────────────
// Finds all 'active' policies where expiry_date < TODAY and marks them 'expired'
cron.schedule('0 0 * * *', async () => {
    try {
        const result = await db.query(`
            UPDATE Policies
            SET status = 'expired'
            WHERE status = 'active' AND expiry_date < CURRENT_DATE
            RETURNING policy_id;
        `);
        if (result.rows.length > 0) {
            console.log(`[CRON] Expired ${result.rows.length} policies:`, result.rows.map(r => r.policy_id));
        }
    } catch (err) {
        console.error('[CRON] Policy expiry job failed:', err.message);
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
