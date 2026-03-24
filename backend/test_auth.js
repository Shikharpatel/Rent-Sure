const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000/api/auth';

async function runTests() {
    console.log('--- Starting Auth API Tests ---');
    let token = '';

    try {
        // 1. Test Registration
        console.log('\nTesting Registration...');
        const regRes = await axios.post(`${BASE_URL}/register`, {
            name: 'Test Tenant',
            email: `tenant_${Date.now()}@example.com`,
            password: 'password123',
            role: 'tenant'
        });
        console.log('Registration Success:', regRes.data.email);
        token = regRes.data.token;

        // 2. Test Login
        const loginEmail = regRes.data.email;
        console.log('\nTesting Login...');
        const loginRes = await axios.post(`${BASE_URL}/login`, {
            email: loginEmail,
            password: 'password123'
        });
        console.log('Login Success:', loginRes.data.email);

        // Update token just to be sure
        token = loginRes.data.token;

        // 3. Test Profile Fetching
        console.log('\nTesting Profile Fetch...');
        const profileRes = await axios.get(`${BASE_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Profile Fetch Success:', profileRes.data.email);
        console.log('Role:', profileRes.data.role);

        console.log('\n--- All Tests Passed Successfully ---');
    } catch (error) {
        console.error('\n!!! Test Failed !!!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

runTests();
